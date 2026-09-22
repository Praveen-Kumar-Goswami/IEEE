import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { DeviceLinkStatus, MonitoringStatus, PairingStatus, Viewer } from "@/types/domain";
import {
  ALERT_SELECT,
  healthFrom,
  mapAlert,
  mapNotification,
  mapTask,
  num,
  TASK_SELECT,
  type AlertRow,
  type NotificationRow,
  type TaskRow,
} from "@/services/data/supabase/mappers";
import type { ConnectionState, RealtimeEvent, RealtimeHandler, RealtimeSource } from "./types";

type DeviceRow = { id: string; serial_number: string; patient_id: string | null; pairing_status: PairingStatus; last_seen_at: string | null };
type ReadingRow = {
  device_id: string;
  captured_at: string;
  localized_temperature_c: number | string | null;
  ambient_temperature_c: number | string | null;
  humidity_percent: number | string | null;
  relative_moisture_value: number | null;
  battery_percent: number | string | null;
  device_status: DeviceLinkStatus;
};

/**
 * postgres_changes subscriptions. Realtime applies the same row level security as the
 * REST API, so every event that arrives here is already scoped to the viewer.
 */
export class SupabaseRealtimeSource implements RealtimeSource {
  readonly mode = "supabase" as const;
  private channel: RealtimeChannel | null = null;
  private handlers = new Set<RealtimeHandler>();
  private connectionHandlers = new Set<(state: ConnectionState) => void>();
  private devices = new Map<string, DeviceRow>();

  constructor(
    private db: SupabaseClient,
    private viewer: Viewer,
  ) {}

  subscribe(handler: RealtimeHandler) {
    this.handlers.add(handler);
    return () => void this.handlers.delete(handler);
  }

  onConnectionChange(handler: (state: ConnectionState) => void) {
    this.connectionHandlers.add(handler);
    return () => void this.connectionHandlers.delete(handler);
  }

  private emit(event: RealtimeEvent) {
    this.handlers.forEach((h) => h(event));
  }

  private setConnection(state: ConnectionState) {
    this.connectionHandlers.forEach((h) => h(state));
  }

  private async loadDevices() {
    const { data } = await this.db.from("devices").select("id, serial_number, patient_id, pairing_status, last_seen_at");
    for (const d of (data ?? []) as DeviceRow[]) this.devices.set(d.id, d);
  }

  private async fetchAlert(id: string) {
    const { data } = await this.db.from("indicator_alerts").select(ALERT_SELECT).eq("id", id).maybeSingle();
    return data ? mapAlert(data as unknown as AlertRow) : null;
  }

  private onReading(row: ReadingRow) {
    const device = this.devices.get(row.device_id);
    if (!device?.patient_id) return;
    this.emit({
      type: "reading.created",
      patientId: device.patient_id,
      deviceId: row.device_id,
      reading: {
        capturedAt: row.captured_at,
        localizedTemperatureC: num(row.localized_temperature_c),
        ambientTemperatureC: num(row.ambient_temperature_c),
        humidityPercent: num(row.humidity_percent),
        relativeMoistureValue: num(row.relative_moisture_value),
        batteryPercent: num(row.battery_percent),
        deviceStatus: row.device_status,
      },
    });
  }

  private onDevice(row: DeviceRow) {
    const previous = this.devices.get(row.id);
    this.devices.set(row.id, row);
    const before = previous ? healthFrom(previous.last_seen_at, previous.pairing_status, null) : null;
    const after = healthFrom(row.last_seen_at, row.pairing_status, null);
    if (before === after) return;
    this.emit({ type: "device.status", deviceId: row.id, serial: row.serial_number, patientId: row.patient_id, health: after, at: new Date().toISOString() });
  }

  start() {
    if (this.channel) return;
    this.setConnection("connecting");
    void this.loadDevices();
    const me = this.viewer.id;

    this.channel = this.db
      .channel(`tend-workspace-${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sensor_readings" }, (p) => this.onReading(p.new as ReadingRow))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "indicator_alerts" }, async (p) => {
        const alert = await this.fetchAlert((p.new as { id: string }).id);
        if (alert) this.emit({ type: "alert.created", alert });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "indicator_alerts" }, async (p) => {
        const alert = await this.fetchAlert((p.new as { id: string }).id);
        if (alert) this.emit({ type: "alert.updated", alert });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, (p) => {
        if (p.eventType !== "DELETE") this.onDevice(p.new as DeviceRow);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "patient_profiles" }, (p) => {
        const row = p.new as { profile_id: string; monitoring_status: MonitoringStatus };
        this.emit({ type: "patient.status", patientId: row.profile_id, monitoringStatus: row.monitoring_status });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${me}` }, (p) =>
        this.emit({ type: "notification.created", notification: mapNotification(p.new as NotificationRow) }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${me}` }, (p) => {
        const m = p.new as { id: string; sender_id: string; recipient_id: string; patient_id: string | null; body: string; read_at: string | null; created_at: string };
        this.emit({
          type: "message.created",
          message: { id: m.id, senderId: m.sender_id, recipientId: m.recipient_id, patientId: m.patient_id, body: m.body, readAt: m.read_at, createdAt: m.created_at },
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "care_tasks", filter: `assigned_to=eq.${me}` }, async (p) => {
        if (p.eventType === "DELETE") return;
        const { data } = await this.db.from("care_tasks").select(TASK_SELECT).eq("id", (p.new as { id: string }).id).maybeSingle();
        if (data) this.emit({ type: "task.updated", task: mapTask(data as unknown as TaskRow) });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") this.setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") this.setConnection("reconnecting");
        else if (status === "CLOSED") this.setConnection("offline");
      });
  }

  stop() {
    if (this.channel) void this.db.removeChannel(this.channel);
    this.channel = null;
    this.setConnection("offline");
  }
}
