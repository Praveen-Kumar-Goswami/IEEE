import type { Viewer } from "@/types/domain";
import { ALERT_TYPE_LABEL } from "@/lib/domain/labels";
import { evaluateSample } from "@/lib/domain/rules";
import { MINUTE, sampleAt, sessionBaseline } from "@/services/data/demo/signal";
import { getDemoState, type DemoState } from "@/services/data/demo/state";
import type { ConnectionState, RealtimeEvent, RealtimeHandler, RealtimeSource } from "./types";

const TICK_MS = 1_000;
const BASE_INTERVAL_MS = 5_000;

type RawListener = (event: RealtimeEvent) => void;

/**
 * One simulation loop per tab. Each paired device reports every few seconds from the
 * deterministic signal model; the backend threshold rules decide when an indicator opens.
 */
class DemoEngine {
  private listeners = new Set<RawListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastEmit = new Map<string, number>();
  private online = new Map<string, boolean>();
  private baselines = new Map<string, { at: number; value: number | null }>();
  private minuteBucket = Math.floor(Date.now() / MINUTE);
  private eventsThisMinute = 0;

  constructor(private state: DemoState) {}

  add(listener: RawListener) {
    this.listeners.add(listener);
    if (!this.timer) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private start() {
    const now = Date.now();
    for (const p of this.state.patients) this.online.set(p.id, this.state.deviceHealth(p, now) !== "offline");
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private broadcast(event: RealtimeEvent) {
    this.eventsThisMinute++;
    this.listeners.forEach((l) => l(event));
  }

  private baseline(patientId: string, now: number) {
    const cached = this.baselines.get(patientId);
    if (cached && now - cached.at < MINUTE) return cached.value;
    const p = this.state.patient(patientId)!;
    const value = sessionBaseline(p.profile, now - 5 * MINUTE);
    this.baselines.set(patientId, { at: now, value });
    return value;
  }

  private tick() {
    const now = Date.now();
    this.rollMinute(now);
    this.state.patients.forEach((p, index) => {
      const interval = BASE_INTERVAL_MS + ((index * 397) % 2_000);
      if (now - (this.lastEmit.get(p.id) ?? 0) < interval) return;
      this.lastEmit.set(p.id, now);

      const sample = sampleAt(p.profile, now);
      const wasOnline = this.online.get(p.id) ?? true;

      if (!sample) {
        if (wasOnline) {
          this.online.set(p.id, false);
          this.broadcast({ type: "device.status", deviceId: p.device.id, serial: p.device.serial, patientId: p.id, health: "offline", at: new Date(now).toISOString() });
          const hasOffline = this.state.alerts.some((a) => a.patientId === p.id && a.alertType === "device_offline" && a.status !== "resolved");
          if (!hasOffline) {
            const { alert, notifications } = this.state.createAlert(
              p,
              "device_offline",
              "Device status is offline. Review is recommended. This is a monitoring indicator requiring clinical review, not a diagnosis.",
              "watch",
              now,
            );
            this.broadcast({ type: "alert.created", alert });
            notifications.forEach((n) => this.broadcast({ type: "notification.created", notification: n }));
          }
          this.broadcast({ type: "patient.status", patientId: p.id, monitoringStatus: this.state.summary(p, now).monitoringStatus });
        }
        return;
      }

      if (!wasOnline) {
        this.online.set(p.id, true);
        this.broadcast({ type: "device.status", deviceId: p.device.id, serial: p.device.serial, patientId: p.id, health: this.state.deviceHealth(p, now, sample), at: sample.capturedAt });
      }

      this.broadcast({ type: "reading.created", patientId: p.id, deviceId: p.device.id, reading: sample });

      const baseline = this.baseline(p.id, now);
      const drafts = evaluateSample(sample, baseline == null ? [] : [baseline], this.state.thresholds).filter((d) => d.alertType !== "device_offline");
      for (const draft of drafts) {
        const active = this.state.alerts.some((a) => a.patientId === p.id && a.alertType === draft.alertType && a.status !== "resolved");
        if (active) continue;
        const { alert, notifications } = this.state.createAlert(p, draft.alertType, draft.message, draft.severity, now);
        this.broadcast({ type: "alert.created", alert });
        notifications.forEach((n) => this.broadcast({ type: "notification.created", notification: n }));
        this.broadcast({ type: "patient.status", patientId: p.id, monitoringStatus: this.state.summary(p, now).monitoringStatus });
        this.state.log(null, "indicator_alerts.insert", "indicator_alerts", alert.id, "success", { patient: p.fullName, type: ALERT_TYPE_LABEL[draft.alertType] }, now);
      }
    });
  }

  private rollMinute(now: number) {
    const bucket = Math.floor(now / MINUTE);
    if (bucket === this.minuteBucket) return;
    this.state.eventsPerMinute = [...this.state.eventsPerMinute.slice(-29), this.eventsThisMinute];
    this.eventsThisMinute = 0;
    this.minuteBucket = bucket;
  }
}

let engine: DemoEngine | null = null;

function getEngine() {
  if (!engine) engine = new DemoEngine(getDemoState());
  return engine;
}

/** Viewer-scoped view of the engine, the way Realtime applies RLS to postgres_changes. */
export class DemoRealtimeSource implements RealtimeSource {
  readonly mode = "demo" as const;
  private handlers = new Set<RealtimeHandler>();
  private connectionHandlers = new Set<(state: ConnectionState) => void>();
  private detach: (() => void) | null = null;

  constructor(private viewer: Viewer) {}

  private get state() {
    return getDemoState();
  }

  private visible(event: RealtimeEvent) {
    const canSee = (patientId: string | null) => patientId != null && this.state.canSee(this.viewer.id, this.viewer.role, patientId);
    switch (event.type) {
      case "reading.created":
      case "patient.status":
        return canSee(event.patientId);
      case "alert.created":
      case "alert.updated":
        return canSee(event.alert.patientId);
      case "device.status":
        return this.viewer.role === "admin" || canSee(event.patientId);
      case "notification.created":
        return (event.notification as { recipientId?: string }).recipientId === this.viewer.id;
      case "message.created":
        return event.message.recipientId === this.viewer.id;
      case "task.updated":
        return event.task.assignedTo?.id === this.viewer.id;
    }
  }

  subscribe(handler: RealtimeHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onConnectionChange(handler: (state: ConnectionState) => void) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private setConnection(state: ConnectionState) {
    this.connectionHandlers.forEach((h) => h(state));
  }

  start() {
    if (this.detach) return;
    this.setConnection("connecting");
    this.detach = getEngine().add((event) => {
      if (this.visible(event)) this.handlers.forEach((h) => h(event));
    });
    setTimeout(() => this.setConnection("live"), 450);
  }

  stop() {
    this.detach?.();
    this.detach = null;
    this.setConnection("offline");
  }
}
