import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccessRequest,
  AlertRule,
  AlertThresholds,
  AlertType,
  AnalyticsData,
  AppRole,
  Appointment,
  AppointmentInput,
  AuditEntry,
  CarePlan,
  ChartEvent,
  CheckIn,
  CheckInInput,
  ClinicalNote,
  Conversation,
  DeviceRecord,
  Facility,
  Message,
  PairingStatus,
  PatientDetail,
  ReadingSeries,
  ReportRecord,
  ReportRequest,
  ReviewPriority,
  SeriesPoint,
  ServiceStatus,
  StaffMember,
  StaffRole,
  StaffStatus,
  SystemHealth,
  TimeRange,
  TimelineEvent,
  Viewer,
} from "@/types/domain";
import { env } from "@/lib/env";
import { ALERT_TYPE_LABEL, rangeSpec } from "@/lib/domain/labels";
import { checkClinicalWording, GLOBAL_THRESHOLDS } from "@/lib/domain/rules";
import { mean, round } from "@/utils/math";
import type { AlertFilter, AuditFilter, DataService, TaskFilter, TaskUpdate } from "../types";
import { callApi, pingApi } from "./api";
import {
  ALERT_SELECT,
  healthFrom,
  mapAlert,
  mapNotification,
  mapOverview,
  mapTask,
  num,
  one,
  TASK_SELECT,
  type AlertRow,
  type NotificationRow,
  type OverviewRow,
  type TaskRow,
} from "./mappers";

type BucketRow = {
  bucket_start: string;
  localized_temperature_c: number | string | null;
  ambient_temperature_c: number | string | null;
  humidity_percent: number | string | null;
  relative_moisture_value: number | string | null;
};

/** Throws on a PostgREST error. Rows are typed by the caller; embedded joins are not inferred. */
function check(result: { data: unknown; error: { message: string } | null }): unknown {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

const nowIso = () => new Date().toISOString();

export class SupabaseDataService implements DataService {
  readonly mode = "supabase" as const;

  constructor(
    private db: SupabaseClient,
    readonly viewer: Viewer,
  ) {}

  /* ───────────── patients ───────────── */

  async listPatients() {
    const rows = check(await this.db.from("patient_monitoring_overview").select("*").order("full_name")) as OverviewRow[];
    const checks = check(
      await this.db.from("patient_checkins").select("patient_id, recorded_at").order("recorded_at", { ascending: false }).limit(500),
    ) as { patient_id: string; recorded_at: string }[];
    const lastCheck = new Map<string, string>();
    for (const c of checks) if (!lastCheck.has(c.patient_id)) lastCheck.set(c.patient_id, c.recorded_at);
    return rows.map((r) => mapOverview(r, lastCheck.get(r.patient_id) ?? null));
  }

  async getPatient(patientId: string): Promise<PatientDetail | null> {
    const row = check(await this.db.from("patient_monitoring_overview").select("*").eq("patient_id", patientId).maybeSingle()) as OverviewRow | null;
    if (!row) return null;
    const [profile, plans, sessions, lastCheck] = await Promise.all([
      this.db.from("patient_profiles").select("emergency_contact").eq("profile_id", patientId).maybeSingle(),
      this.listCarePlans(patientId),
      this.db
        .from("monitoring_sessions")
        .select("id, status, started_at, ended_at, simulated_wound_label, device:devices(serial_number), sensor_readings(count), indicator_alerts(count)")
        .eq("patient_id", patientId)
        .order("started_at", { ascending: false })
        .limit(30),
      this.db.from("patient_checkins").select("recorded_at").eq("patient_id", patientId).order("recorded_at", { ascending: false }).limit(1),
    ]);
    type SessionRow = {
      id: string;
      status: "active" | "paused" | "completed";
      started_at: string;
      ended_at: string | null;
      simulated_wound_label: string | null;
      device: { serial_number: string } | null;
      sensor_readings: { count: number }[];
      indicator_alerts: { count: number }[];
    };
    return {
      ...mapOverview(row, (check(lastCheck) as { recorded_at: string }[])[0]?.recorded_at ?? null),
      emergencyContact: (check(profile) as { emergency_contact: string | null } | null)?.emergency_contact ?? null,
      carePlans: plans,
      sessions: (check(sessions) as SessionRow[]).map((s) => ({
        id: s.id,
        patientId,
        deviceSerial: one(s.device)?.serial_number ?? "",
        label: s.simulated_wound_label,
        status: s.status,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        readingCount: s.sensor_readings?.[0]?.count ?? 0,
        alertCount: s.indicator_alerts?.[0]?.count ?? 0,
      })),
    };
  }

  private async buckets(patientId: string, from: number, to: number, bucketSeconds: number) {
    const rows = check(
      await this.db.rpc("reading_buckets", {
        p_patient_id: patientId,
        p_from: new Date(from).toISOString(),
        p_to: new Date(to).toISOString(),
        p_bucket_seconds: bucketSeconds,
      }),
    ) as BucketRow[];
    return rows.map((r) => ({
      t: Date.parse(r.bucket_start) + (bucketSeconds * 1000) / 2,
      localizedTemperatureC: num(r.localized_temperature_c),
      ambientTemperatureC: num(r.ambient_temperature_c),
      humidityPercent: num(r.humidity_percent),
      relativeMoistureValue: num(r.relative_moisture_value),
    }));
  }

  /** Fills missing buckets with nulls so the chart shows gaps instead of joining across them. */
  private fill(points: SeriesPoint[], from: number, to: number, bucketMs: number, shift = 0) {
    const byBucket = new Map(points.map((p) => [Math.floor((p.t - shift - from) / bucketMs), p]));
    const out: SeriesPoint[] = [];
    for (let i = 0, t = from + bucketMs / 2; t < to; i++, t += bucketMs) {
      const p = byBucket.get(i);
      out.push(p ? { ...p, t } : { t, localizedTemperatureC: null, ambientTemperatureC: null, humidityPercent: null, relativeMoistureValue: null });
    }
    return out;
  }

  async getSeries(patientId: string, range: TimeRange): Promise<ReadingSeries> {
    const spec = rangeSpec(range);
    const to = Date.now();
    const from = to - spec.ms;
    const bucketMs = spec.bucketSeconds * 1000;
    const [current, previous, alerts, notes, rules, session] = await Promise.all([
      this.buckets(patientId, from, to, spec.bucketSeconds),
      this.buckets(patientId, from - spec.ms, from, spec.bucketSeconds),
      this.db.from("indicator_alerts").select("created_at, alert_type, severity").eq("patient_id", patientId).gte("created_at", new Date(from).toISOString()),
      this.db.from("clinical_notes").select("created_at, author:profiles!clinical_notes_author_id_fkey(full_name)").eq("patient_id", patientId).gte("created_at", new Date(from).toISOString()),
      this.listAlertRules().catch(() => [] as AlertRule[]),
      this.db.from("monitoring_sessions").select("started_at").eq("patient_id", patientId).in("status", ["active", "paused"]).maybeSingle(),
    ]);
    const events: ChartEvent[] = [
      ...(check(alerts) as { created_at: string; alert_type: AlertType; severity: ChartEvent["severity"] }[]).map((a) => ({
        t: Date.parse(a.created_at),
        kind: a.alert_type === "device_offline" ? ("device" as const) : ("alert" as const),
        label: ALERT_TYPE_LABEL[a.alert_type],
        severity: a.severity,
      })),
      ...(check(notes) as { created_at: string; author: { full_name: string } | null }[]).map((n) => ({
        t: Date.parse(n.created_at),
        kind: "note" as const,
        label: `Note · ${one(n.author)?.full_name ?? "Staff"}`,
      })),
    ].sort((a, b) => a.t - b.t);

    const sessionStart = (check(session) as { started_at: string } | null)?.started_at;
    const inSession = current.filter((p) => !sessionStart || p.t >= Date.parse(sessionStart)).map((p) => p.localizedTemperatureC).filter((v): v is number => v != null);
    const rule = rules.find((r) => r.scope === "global");
    return {
      range,
      from,
      to,
      bucketSeconds: spec.bucketSeconds,
      points: this.fill(current, from, to, bucketMs),
      comparison: this.fill(previous, from - spec.ms, from, bucketMs).map((p) => ({ ...p, t: p.t + spec.ms })),
      baseline: inSession.length ? round(mean(inSession), 2) : null,
      thresholds: rule ? { temperatureDelta: rule.temperatureDelta, humidity: rule.humidity, moisture: rule.moisture } : GLOBAL_THRESHOLDS,
      events,
    };
  }

  async getTimeline(patientId: string): Promise<TimelineEvent[]> {
    const [alerts, notes, checkins, sessions] = await Promise.all([
      this.listAlerts({ patientId }),
      this.listNotes(patientId),
      this.listCheckIns(patientId),
      this.db.from("monitoring_sessions").select("id, started_at, ended_at, simulated_wound_label").eq("patient_id", patientId).order("started_at", { ascending: false }).limit(20),
    ]);
    const events: TimelineEvent[] = [];
    for (const s of check(sessions) as { id: string; started_at: string; ended_at: string | null; simulated_wound_label: string | null }[]) {
      events.push({ id: `${s.id}-start`, at: s.started_at, kind: "session", title: "Monitoring session started", detail: s.simulated_wound_label, actor: null });
      if (s.ended_at) events.push({ id: `${s.id}-end`, at: s.ended_at, kind: "session", title: "Session completed", detail: null, actor: null });
    }
    for (const a of alerts) {
      events.push({ id: `${a.id}-open`, at: a.createdAt, kind: "alert", title: ALERT_TYPE_LABEL[a.alertType], detail: a.message, actor: null, severity: a.severity });
      if (a.acknowledgedAt) events.push({ id: `${a.id}-ack`, at: a.acknowledgedAt, kind: "acknowledged", title: "Indicator acknowledged", detail: ALERT_TYPE_LABEL[a.alertType], actor: a.acknowledgedBy?.name ?? null });
      if (a.resolvedAt) events.push({ id: `${a.id}-res`, at: a.resolvedAt, kind: "resolved", title: "Indicator resolved", detail: ALERT_TYPE_LABEL[a.alertType], actor: null });
    }
    for (const n of notes) events.push({ id: n.id, at: n.createdAt, kind: "note", title: "Clinical note", detail: n.text, actor: n.author.name });
    for (const c of checkins.slice(0, 12)) events.push({ id: c.id, at: c.recordedAt, kind: "checkin", title: "Bedside check-in", detail: c.notes, actor: c.recordedBy.name });
    return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }

  /* ───────────── indicators ───────────── */

  async listAlerts(filter: AlertFilter = {}) {
    let query = this.db.from("indicator_alerts").select(ALERT_SELECT).order("created_at", { ascending: false }).limit(200);
    if (filter.patientId) query = query.eq("patient_id", filter.patientId);
    if (filter.status === "active") query = query.in("status", ["open", "acknowledged"]);
    else if (filter.status) query = query.eq("status", filter.status);
    return (check(await query) as unknown as AlertRow[]).map(mapAlert);
  }

  private async alert(alertId: string) {
    return mapAlert(check(await this.db.from("indicator_alerts").select(ALERT_SELECT).eq("id", alertId).single()) as unknown as AlertRow);
  }

  async acknowledgeAlert(alertId: string) {
    if (env.apiBaseUrl) {
      await callApi(this.db, `/v1/alerts/${alertId}/acknowledge`, {});
    } else {
      check(
        await this.db
          .from("indicator_alerts")
          .update({ status: "acknowledged", acknowledged_by: this.viewer.id, acknowledged_at: nowIso() })
          .eq("id", alertId)
          .eq("status", "open"),
      );
    }
    return this.alert(alertId);
  }

  async resolveAlert(alertId: string) {
    check(await this.db.from("indicator_alerts").update({ status: "resolved", resolved_at: nowIso() }).eq("id", alertId).neq("status", "resolved"));
    return this.alert(alertId);
  }

  async escalateAlert(alertId: string, note?: string) {
    const alert = await this.alert(alertId);
    const doctors = check(
      await this.db.from("clinician_patient_assignments").select("clinician_id").eq("patient_id", alert.patientId).eq("assignment_role", "doctor").eq("active", true),
    ) as { clinician_id: string }[];
    if (doctors.length === 0) throw new Error("No doctor is assigned to this patient.");
    check(
      await this.db.from("notifications").insert(
        doctors.map((d) => ({
          recipient_id: d.clinician_id,
          kind: "alert_escalation",
          title: `${this.viewer.fullName} asked for a review · ${alert.patientName}`,
          body: note?.trim() || `${ALERT_TYPE_LABEL[alert.alertType]}. Bedside review requested.`,
          patient_id: alert.patientId,
          entity_type: "indicator_alerts",
          entity_id: alertId,
          created_by: this.viewer.id,
        })),
      ),
    );
  }

  /* ───────────── notes and plans ───────────── */

  async listNotes(patientId: string): Promise<ClinicalNote[]> {
    const rows = check(
      await this.db
        .from("clinical_notes")
        .select("id, patient_id, note_text, alert_id, created_at, author:profiles!clinical_notes_author_id_fkey(id, full_name, role)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false }),
    ) as { id: string; patient_id: string; note_text: string; alert_id: string | null; created_at: string; author: { id: string; full_name: string; role: StaffRole } | null }[];
    return rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      author: { id: one(r.author)?.id ?? "", name: one(r.author)?.full_name ?? "Staff", role: one(r.author)?.role ?? "nurse" },
      text: r.note_text,
      alertId: r.alert_id,
      createdAt: r.created_at,
    }));
  }

  async addNote(input: { patientId: string; text: string; alertId?: string | null }) {
    const wording = checkClinicalWording(input.text);
    if (wording) throw new Error(wording);
    if (env.apiBaseUrl) {
      await callApi(this.db, "/v1/notes", { patient_id: input.patientId, note_text: input.text.trim(), alert_id: input.alertId ?? undefined });
    } else {
      check(await this.db.from("clinical_notes").insert({ patient_id: input.patientId, author_id: this.viewer.id, note_text: input.text.trim(), alert_id: input.alertId ?? null }));
    }
    return (await this.listNotes(input.patientId))[0];
  }

  async listCarePlans(patientId: string): Promise<CarePlan[]> {
    const rows = check(
      await this.db
        .from("care_plans")
        .select("id, patient_id, title, instructions, dressing_change_interval_hours, review_interval_hours, active, created_at, author:profiles!care_plans_author_id_fkey(id, full_name)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false }),
    ) as {
      id: string;
      patient_id: string;
      title: string;
      instructions: string;
      dressing_change_interval_hours: number | null;
      review_interval_hours: number | null;
      active: boolean;
      created_at: string;
      author: { id: string; full_name: string } | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      author: { id: one(r.author)?.id ?? "", name: one(r.author)?.full_name ?? "Doctor" },
      title: r.title,
      instructions: r.instructions,
      dressingChangeIntervalHours: r.dressing_change_interval_hours,
      reviewIntervalHours: r.review_interval_hours,
      active: r.active,
      createdAt: r.created_at,
    }));
  }

  async addCarePlan(input: Omit<CarePlan, "id" | "author" | "createdAt" | "active">) {
    const wording = checkClinicalWording(input.instructions);
    if (wording) throw new Error(wording);
    await this.db.from("care_plans").update({ active: false }).eq("patient_id", input.patientId).eq("author_id", this.viewer.id);
    check(
      await this.db.from("care_plans").insert({
        patient_id: input.patientId,
        author_id: this.viewer.id,
        title: input.title,
        instructions: input.instructions,
        dressing_change_interval_hours: input.dressingChangeIntervalHours,
        review_interval_hours: input.reviewIntervalHours,
      }),
    );
    return (await this.listCarePlans(input.patientId))[0];
  }

  /* ───────────── tasks and check-ins ───────────── */

  async listTasks(filter: TaskFilter) {
    let query = this.db.from("care_tasks").select(TASK_SELECT).order("due_at");
    if (filter.scope === "mine") query = query.eq("assigned_to", this.viewer.id);
    if (filter.patientId) query = query.eq("patient_id", filter.patientId);
    const day = filter.day ? new Date(filter.day) : new Date();
    day.setHours(0, 0, 0, 0);
    query = query.gte("due_at", day.toISOString()).lt("due_at", new Date(day.getTime() + 86_400_000).toISOString());
    return (check(await query) as unknown as TaskRow[]).map(mapTask);
  }

  async updateTask(taskId: string, update: TaskUpdate) {
    const patch: Record<string, unknown> = { status: update.status, completed_at: null, completed_by: null };
    if (update.status === "completed") Object.assign(patch, { completed_at: nowIso(), completed_by: this.viewer.id });
    if (update.status === "delayed") {
      patch.delayed_until = new Date(Date.now() + (update.delayMinutes ?? 30) * 60_000).toISOString();
      patch.delay_reason = update.delayReason?.trim() || null;
    }
    const row = check(await this.db.from("care_tasks").update(patch).eq("id", taskId).select(TASK_SELECT).single());
    return mapTask(row as unknown as TaskRow);
  }

  async listCheckIns(patientId?: string): Promise<CheckIn[]> {
    let query = this.db
      .from("patient_checkins")
      .select("id, patient_id, task_id, body_temperature_c, pain_score, dressing_condition, device_secure, notes, recorded_at, patient:profiles!patient_checkins_patient_id_fkey(full_name), recorder:profiles!patient_checkins_recorded_by_fkey(id, full_name)")
      .order("recorded_at", { ascending: false })
      .limit(80);
    if (patientId) query = query.eq("patient_id", patientId);
    type Row = {
      id: string;
      patient_id: string;
      task_id: string | null;
      body_temperature_c: number | string | null;
      pain_score: number | null;
      dressing_condition: CheckIn["dressingCondition"];
      device_secure: boolean | null;
      notes: string | null;
      recorded_at: string;
      patient: { full_name: string } | null;
      recorder: { id: string; full_name: string } | null;
    };
    return (check(await query) as unknown as Row[]).map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      patientName: one(r.patient)?.full_name ?? "Patient",
      recordedBy: { id: one(r.recorder)?.id ?? "", name: one(r.recorder)?.full_name ?? "Staff" },
      bodyTemperatureC: num(r.body_temperature_c),
      painScore: r.pain_score,
      dressingCondition: r.dressing_condition,
      deviceSecure: r.device_secure,
      notes: r.notes,
      recordedAt: r.recorded_at,
      taskId: r.task_id,
    }));
  }

  async submitCheckIn(input: CheckInInput) {
    if (input.notes) {
      const wording = checkClinicalWording(input.notes);
      if (wording) throw new Error(wording);
    }
    const session = check(
      await this.db.from("monitoring_sessions").select("id").eq("patient_id", input.patientId).in("status", ["active", "paused"]).maybeSingle(),
    ) as { id: string } | null;
    check(
      await this.db.from("patient_checkins").insert({
        patient_id: input.patientId,
        recorded_by: this.viewer.id,
        session_id: session?.id ?? null,
        task_id: input.taskId ?? null,
        body_temperature_c: input.bodyTemperatureC ?? null,
        pain_score: input.painScore ?? null,
        dressing_condition: input.dressingCondition ?? null,
        device_secure: input.deviceSecure ?? null,
        notes: input.notes?.trim() || null,
      }),
    );
    return (await this.listCheckIns(input.patientId))[0];
  }

  /* ───────────── appointments ───────────── */

  private readonly appointmentSelect =
    "id, patient_id, kind, status, starts_at, ends_at, location, notes, patient:profiles!appointments_patient_id_fkey(full_name), clinician:profiles!appointments_clinician_id_fkey(id, full_name)";

  private mapAppointment(r: {
    id: string;
    patient_id: string;
    kind: Appointment["kind"];
    status: Appointment["status"];
    starts_at: string;
    ends_at: string;
    location: string | null;
    notes: string | null;
    patient: { full_name: string } | null;
    clinician: { id: string; full_name: string } | null;
  }): Appointment {
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: one(r.patient)?.full_name ?? "Patient",
      clinician: { id: one(r.clinician)?.id ?? "", name: one(r.clinician)?.full_name ?? "Clinician" },
      kind: r.kind,
      status: r.status,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      location: r.location,
      notes: r.notes,
    };
  }

  async listAppointments(from: string, to: string) {
    const rows = check(await this.db.from("appointments").select(this.appointmentSelect).gte("starts_at", from).lt("starts_at", to).order("starts_at"));
    return (rows as unknown as Parameters<SupabaseDataService["mapAppointment"]>[0][]).map((r) => this.mapAppointment(r));
  }

  async createAppointment(input: AppointmentInput) {
    const start = Date.parse(input.startsAt);
    const row = check(
      await this.db
        .from("appointments")
        .insert({
          patient_id: input.patientId,
          clinician_id: this.viewer.id,
          created_by: this.viewer.id,
          kind: input.kind,
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(start + input.durationMinutes * 60_000).toISOString(),
          location: input.location ?? null,
          notes: input.notes ?? null,
        })
        .select(this.appointmentSelect)
        .single(),
    );
    return this.mapAppointment(row as unknown as Parameters<SupabaseDataService["mapAppointment"]>[0]);
  }

  async updateAppointmentStatus(id: string, status: Appointment["status"]) {
    const row = check(await this.db.from("appointments").update({ status }).eq("id", id).select(this.appointmentSelect).single());
    return this.mapAppointment(row as unknown as Parameters<SupabaseDataService["mapAppointment"]>[0]);
  }

  /* ───────────── inbox ───────────── */

  async listNotifications() {
    const rows = check(await this.db.from("notifications").select("*").order("created_at", { ascending: false }).limit(60)) as NotificationRow[];
    return rows.map(mapNotification);
  }

  async markNotificationsRead(ids: string[]) {
    if (ids.length === 0) return;
    check(await this.db.from("notifications").update({ read_at: nowIso() }).in("id", ids).is("read_at", null));
  }

  private async staffDirectory() {
    const rows = check(
      await this.db.from("profiles").select("id, full_name, role, staff_profiles(title)").in("role", ["doctor", "nurse", "admin"]).neq("id", this.viewer.id),
    ) as { id: string; full_name: string; role: StaffRole; staff_profiles: { title: string | null } | { title: string | null }[] | null }[];
    return rows.map((r) => ({ id: r.id, name: r.full_name, role: r.role, title: one(r.staff_profiles)?.title ?? null }));
  }

  private mapMessage(r: { id: string; sender_id: string; recipient_id: string; patient_id: string | null; body: string; read_at: string | null; created_at: string }): Message {
    return { id: r.id, senderId: r.sender_id, recipientId: r.recipient_id, patientId: r.patient_id, body: r.body, readAt: r.read_at, createdAt: r.created_at };
  }

  async listConversations(): Promise<Conversation[]> {
    const [peers, messages] = await Promise.all([
      this.staffDirectory(),
      this.db.from("messages").select("*").order("created_at", { ascending: true }).limit(500),
    ]);
    const all = (check(messages) as Parameters<SupabaseDataService["mapMessage"]>[0][]).map((m) => this.mapMessage(m));
    return peers
      .map((peer) => {
        const thread = all.filter((m) => m.senderId === peer.id || m.recipientId === peer.id);
        return {
          peer,
          lastMessage: thread[thread.length - 1] ?? null,
          unreadCount: thread.filter((m) => m.recipientId === this.viewer.id && !m.readAt).length,
        };
      })
      .sort((a, b) => Date.parse(b.lastMessage?.createdAt ?? "1970") - Date.parse(a.lastMessage?.createdAt ?? "1970"));
  }

  async listMessages(peerId: string) {
    const me = this.viewer.id;
    const rows = check(
      await this.db
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${me},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me})`)
        .order("created_at"),
    ) as Parameters<SupabaseDataService["mapMessage"]>[0][];
    await this.db.from("messages").update({ read_at: nowIso() }).eq("sender_id", peerId).eq("recipient_id", me).is("read_at", null);
    return rows.map((r) => this.mapMessage(r));
  }

  async sendMessage(peerId: string, body: string, patientId: string | null = null) {
    const row = check(await this.db.from("messages").insert({ sender_id: this.viewer.id, recipient_id: peerId, patient_id: patientId, body: body.trim() }).select("*").single());
    return this.mapMessage(row as Parameters<SupabaseDataService["mapMessage"]>[0]);
  }

  /* ───────────── reports ───────────── */

  private readonly reportSelect =
    "id, report_type, format, status, period_start, period_end, created_at, completed_at, patient:profiles!reports_patient_id_fkey(id, full_name), creator:profiles!reports_created_by_fkey(id, full_name)";

  private mapReport(r: {
    id: string;
    report_type: ReportRecord["reportType"];
    format: ReportRecord["format"];
    status: ReportRecord["status"];
    period_start: string;
    period_end: string;
    created_at: string;
    completed_at: string | null;
    patient: { id: string; full_name: string } | null;
    creator: { id: string; full_name: string } | null;
  }): ReportRecord {
    const patient = one(r.patient);
    return {
      id: r.id,
      reportType: r.report_type,
      format: r.format,
      status: r.status,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      patient: patient ? { id: patient.id, name: patient.full_name } : null,
      createdBy: { id: one(r.creator)?.id ?? "", name: one(r.creator)?.full_name ?? "Staff" },
      createdAt: r.created_at,
      completedAt: r.completed_at,
    };
  }

  async listReports() {
    const rows = check(await this.db.from("reports").select(this.reportSelect).order("created_at", { ascending: false }).limit(50));
    return (rows as unknown as Parameters<SupabaseDataService["mapReport"]>[0][]).map((r) => this.mapReport(r));
  }

  async requestReport(input: ReportRequest) {
    const row = check(
      await this.db
        .from("reports")
        .insert({
          created_by: this.viewer.id,
          patient_id: input.patientId ?? null,
          report_type: input.reportType,
          format: input.format,
          period_start: input.periodStart,
          period_end: input.periodEnd,
        })
        .select(this.reportSelect)
        .single(),
    );
    return this.mapReport(row as unknown as Parameters<SupabaseDataService["mapReport"]>[0]);
  }

  /* ───────────── administration ───────────── */

  async listStaff(role?: StaffRole): Promise<StaffMember[]> {
    let query = this.db
      .from("profiles")
      .select("id, full_name, role, phone, created_at, staff_profiles(title, department, status, last_active_at, facility_id, facilities(name))")
      .in("role", role ? [role] : ["doctor", "nurse", "admin"])
      .order("full_name");
    type Row = {
      id: string;
      full_name: string;
      role: StaffRole;
      phone: string | null;
      created_at: string;
      staff_profiles: {
        title: string | null;
        department: string | null;
        status: StaffStatus;
        last_active_at: string | null;
        facility_id: string | null;
        facilities: { name: string } | null;
      } | null;
    };
    const [rows, assignments] = await Promise.all([
      query,
      this.db.from("clinician_patient_assignments").select("clinician_id").eq("active", true),
    ]);
    const counts = new Map<string, number>();
    for (const a of (check(assignments) as { clinician_id: string }[]) ?? []) counts.set(a.clinician_id, (counts.get(a.clinician_id) ?? 0) + 1);
    return (check(rows) as unknown as Row[]).map((r) => {
      const staff = one(r.staff_profiles);
      return {
        id: r.id,
        fullName: r.full_name,
        email: null,
        phone: r.phone,
        role: r.role,
        title: staff?.title ?? null,
        department: staff?.department ?? null,
        facilityId: staff?.facility_id ?? null,
        facilityName: one(staff?.facilities)?.name ?? null,
        status: staff?.status ?? "active",
        lastActiveAt: staff?.last_active_at ?? null,
        createdAt: r.created_at,
        assignedPatientCount: counts.get(r.id) ?? 0,
      };
    });
  }

  async setStaffStatus(profileId: string, status: StaffStatus) {
    if (profileId === this.viewer.id) throw new Error("You cannot change your own account status.");
    check(await this.db.from("staff_profiles").upsert({ profile_id: profileId, status }));
    const member = (await this.listStaff()).find((s) => s.id === profileId);
    if (!member) throw new Error("Staff member not found.");
    return member;
  }

  async listDevices(): Promise<DeviceRecord[]> {
    const [devices, overview] = await Promise.all([
      this.db.from("devices").select("id, serial_number, device_name, patient_id, firmware_version, pairing_status, last_seen_at, patient:profiles(id, full_name)").order("serial_number"),
      this.db.from("patient_monitoring_overview").select("device_id, battery_percent, facility_name, session_id"),
    ]);
    const byDevice = new Map(
      (check(overview) as { device_id: string | null; battery_percent: number | string | null; facility_name: string | null; session_id: string | null }[])
        .filter((o) => o.device_id)
        .map((o) => [o.device_id!, o]),
    );
    type Row = { id: string; serial_number: string; device_name: string; firmware_version: string | null; pairing_status: PairingStatus; last_seen_at: string | null; patient: { id: string; full_name: string } | null };
    return (check(devices) as unknown as Row[]).map((d) => {
      const extra = byDevice.get(d.id);
      const battery = num(extra?.battery_percent);
      const health = healthFrom(d.last_seen_at, d.pairing_status, battery);
      const patient = one(d.patient);
      return {
        id: d.id,
        serial: d.serial_number,
        name: d.device_name,
        patient: patient ? { id: patient.id, name: patient.full_name } : null,
        facilityName: extra?.facility_name ?? null,
        pairingStatus: d.pairing_status,
        health,
        batteryPercent: battery,
        lastSyncAt: d.last_seen_at,
        connection: health === "online" ? "ble_gateway" : health === "warning" ? "pending_sync" : "none",
        firmware: d.firmware_version,
        sessionActive: Boolean(extra?.session_id),
      };
    });
  }

  async assignDevice(deviceId: string, patientId: string) {
    await callApi(this.db, "/v1/admin/devices/assign", { device_id: deviceId, patient_id: patientId });
    const device = (await this.listDevices()).find((d) => d.id === deviceId);
    if (!device) throw new Error("Device not found.");
    return device;
  }

  async listFacilities(): Promise<Facility[]> {
    const [facilities, patients, staff] = await Promise.all([
      this.db.from("facilities").select("id, name, code, unit_type, bed_capacity").order("name"),
      this.db.from("patient_monitoring_overview").select("facility_id, device_id, open_alert_count, acknowledged_alert_count"),
      this.db.from("staff_profiles").select("facility_id, status"),
    ]);
    const p = check(patients) as { facility_id: string | null; device_id: string | null; open_alert_count: number; acknowledged_alert_count: number }[];
    const s = check(staff) as { facility_id: string | null; status: StaffStatus }[];
    return (check(facilities) as { id: string; name: string; code: string; unit_type: Facility["unitType"]; bed_capacity: number | null }[]).map((f) => {
      const here = p.filter((x) => x.facility_id === f.id);
      return {
        id: f.id,
        name: f.name,
        code: f.code,
        unitType: f.unit_type,
        bedCapacity: f.bed_capacity,
        patientCount: here.length,
        staffCount: s.filter((x) => x.facility_id === f.id && x.status === "active").length,
        deviceCount: here.filter((x) => x.device_id).length,
        openAlertCount: here.reduce((sum, x) => sum + Number(x.open_alert_count) + Number(x.acknowledged_alert_count), 0),
      };
    });
  }

  async listAccessRequests(): Promise<AccessRequest[]> {
    type Row = {
      id: string;
      requested_role: StaffRole;
      department: string | null;
      license_number: string | null;
      justification: string | null;
      status: AccessRequest["status"];
      created_at: string;
      reviewed_at: string | null;
      review_note: string | null;
      requester: { id: string; full_name: string } | null;
      reviewer: { id: string; full_name: string } | null;
      facility: { name: string } | null;
    };
    const rows = check(
      await this.db
        .from("access_requests")
        .select(
          "id, requested_role, department, license_number, justification, status, created_at, reviewed_at, review_note, requester:profiles!access_requests_requester_id_fkey(id, full_name), reviewer:profiles!access_requests_reviewed_by_fkey(id, full_name), facility:facilities(name)",
        )
        .order("created_at", { ascending: false }),
    ) as unknown as Row[];
    return rows.map((r) => {
      const reviewer = one(r.reviewer);
      return {
        id: r.id,
        requester: { id: one(r.requester)?.id ?? "", name: one(r.requester)?.full_name ?? "Applicant", email: null },
        requestedRole: r.requested_role,
        facilityName: one(r.facility)?.name ?? null,
        department: r.department,
        licenseNumber: r.license_number,
        justification: r.justification,
        status: r.status,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
        reviewedBy: reviewer ? { id: reviewer.id, name: reviewer.full_name } : null,
        reviewNote: r.review_note,
      };
    });
  }

  async reviewAccessRequest(id: string, decision: "approved" | "rejected", note?: string) {
    const request = (await this.listAccessRequests()).find((r) => r.id === id);
    if (!request) throw new Error("Request not found.");
    if (decision === "approved") {
      await callApi(this.db, "/v1/admin/roles", { profile_id: request.requester.id, role: request.requestedRole });
    }
    check(
      await this.db
        .from("access_requests")
        .update({ status: decision, reviewed_by: this.viewer.id, reviewed_at: nowIso(), review_note: note?.trim() || null })
        .eq("id", id)
        .eq("status", "pending"),
    );
    return (await this.listAccessRequests()).find((r) => r.id === id)!;
  }

  async listAuditLogs(filter: AuditFilter = {}): Promise<AuditEntry[]> {
    let query = this.db
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at, actor:profiles(id, full_name, role)")
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 500);
    if (filter.since) query = query.gte("created_at", filter.since);
    type Row = { id: string; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, string | number | boolean | null>; created_at: string; actor: { id: string; full_name: string; role: AppRole } | null };
    return (check(await query) as unknown as Row[]).map((r) => {
      const actor = one(r.actor);
      const result = r.metadata?.result;
      return {
        id: r.id,
        createdAt: r.created_at,
        actor: actor ? { id: actor.id, name: actor.full_name, role: actor.role } : null,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        result: result === "denied" || result === "failed" ? result : "success",
        metadata: r.metadata ?? {},
      };
    });
  }

  async listAlertRules(): Promise<AlertRule[]> {
    type Row = { id: string; scope: AlertRule["scope"]; temperature_delta_threshold: number | string | null; humidity_threshold: number | string | null; moisture_threshold: number | null; enabled: boolean; updated_at: string; patient_id: string | null; device_id: string | null };
    const rows = check(await this.db.from("alert_rules").select("*").order("updated_at", { ascending: false })) as Row[];
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      targetLabel: r.patient_id ?? r.device_id,
      enabled: r.enabled,
      updatedAt: r.updated_at,
      temperatureDelta: num(r.temperature_delta_threshold) ?? GLOBAL_THRESHOLDS.temperatureDelta,
      humidity: num(r.humidity_threshold) ?? GLOBAL_THRESHOLDS.humidity,
      moisture: num(r.moisture_threshold) ?? GLOBAL_THRESHOLDS.moisture,
    }));
  }

  async updateGlobalThresholds(thresholds: AlertThresholds) {
    await callApi(this.db, "/v1/admin/alert-rules", {
      scope: "global",
      temperature_delta_threshold: thresholds.temperatureDelta,
      humidity_threshold: thresholds.humidity,
      moisture_threshold: thresholds.moisture,
    });
    const rule = (await this.listAlertRules()).find((r) => r.scope === "global" && r.enabled);
    if (!rule) throw new Error("The global rule was not returned.");
    return rule;
  }

  async getOverviewCounts() {
    const head = { count: "exact" as const, head: true };
    const total = (result: { count: number | null; error: { message: string } | null }) => {
      if (result.error) throw new Error(result.error.message);
      return result.count ?? 0;
    };
    const [doctors, nurses, patients, activeAlerts, criticalAlerts, pendingApprovals, devices] = await Promise.all([
      this.db.from("profiles").select("id", head).eq("role", "doctor").then(total),
      this.db.from("profiles").select("id", head).eq("role", "nurse").then(total),
      this.db.from("profiles").select("id", head).eq("role", "patient").then(total),
      this.db.from("indicator_alerts").select("id", head).in("status", ["open", "acknowledged"]).then(total),
      this.db.from("indicator_alerts").select("id", head).eq("status", "open").eq("severity", "attention").then(total),
      this.db.from("access_requests").select("id", head).eq("status", "pending").then(total),
      this.listDevices(),
    ]);
    return {
      doctors,
      nurses,
      patients,
      devices: devices.length,
      onlineDevices: devices.filter((d) => d.health === "online").length,
      warningDevices: devices.filter((d) => d.health === "warning").length,
      offlineDevices: devices.filter((d) => d.health === "offline").length,
      activeAlerts,
      criticalAlerts,
      pendingApprovals,
    };
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const started = performance.now();
    const db = await this.db.from("profiles").select("id", { count: "exact", head: true });
    const dbLatency = Math.round(performance.now() - started);
    const apiLatency = await pingApi();
    const devices = await this.listDevices();
    const service = (id: ServiceStatus["id"], name: string, ok: boolean | null, latency: number | null, detail: string): ServiceStatus => ({
      id,
      name,
      status: ok == null ? "degraded" : ok ? "operational" : "down",
      latencyMs: latency,
      uptimePercent: ok ? 100 : 0,
      detail,
      history: latency == null ? [] : [latency],
    });
    return {
      checkedAt: nowIso(),
      services: [
        service("api", "Lambda API", apiLatency == null ? null : true, apiLatency, apiLatency == null ? "NEXT_PUBLIC_API_BASE_URL not set or unreachable" : "GET /health"),
        service("database", "Postgres", !db.error, dbLatency, db.error ? db.error.message : "PostgREST round trip"),
        service("realtime", "Realtime", true, null, "postgres_changes subscription"),
        service("auth", "Auth", true, null, "Session verified by proxy"),
        service("storage", "Storage", null, null, "Report bucket not configured"),
        service("sync", "Device sync", devices.every((d) => d.health !== "offline" || !d.sessionActive), null, "BLE → phone → Lambda"),
      ],
      storage: { usedGb: 0, totalGb: 0 },
      sync: {
        pendingBatches: devices.filter((d) => d.connection === "pending_sync").length,
        lastBatchAt: devices.map((d) => d.lastSyncAt).filter(Boolean).sort().at(-1) ?? null,
        successRate: 100,
        readingsLastHour: 0,
      },
      realtime: { connectedClients: 1, eventsPerMinute: [] },
    };
  }

  async getAnalytics(days: number): Promise<AnalyticsData> {
    type Daily = { day: string; readings: number; reporting_devices: number; checkins: number; sessions_started: number; alerts: number; active_staff: number };
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [daily, profiles, alerts, patients, devices] = await Promise.all([
      this.db.rpc("platform_daily_activity", { p_days: days }),
      this.db.from("profiles").select("role, created_at"),
      this.db.from("indicator_alerts").select("alert_type, created_at").gte("created_at", since),
      this.listPatients(),
      this.listDevices(),
    ]);
    const rows = check(daily) as Daily[];
    const people = check(profiles) as { role: StaffRole | "patient"; created_at: string }[];
    const alertRows = check(alerts) as { alert_type: AlertType; created_at: string }[];
    const heat = new Map<string, number>();
    const byType = new Map<AlertType, number>();
    for (const a of alertRows) {
      const d = new Date(a.created_at);
      const key = `${(d.getDay() + 6) % 7}:${d.getHours()}`;
      heat.set(key, (heat.get(key) ?? 0) + 1);
      byType.set(a.alert_type, (byType.get(a.alert_type) ?? 0) + 1);
    }
    const upTo = (role: string, day: string) => people.filter((p) => p.role === role && p.created_at <= `${day}T23:59:59Z`).length;
    const priorityDistribution: Record<ReviewPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const p of patients) priorityDistribution[p.priority]++;
    return {
      userGrowth: rows.map((r) => ({ date: r.day, doctors: upTo("doctor", r.day), nurses: upTo("nurse", r.day), patients: upTo("patient", r.day) })),
      deviceHealth: rows.map((r) => ({ date: r.day, online: Number(r.reporting_devices), warning: 0, offline: Math.max(0, devices.length - Number(r.reporting_devices)) })),
      alertHeatmap: Array.from({ length: 7 * 24 }, (_, i) => ({ day: Math.floor(i / 24), hour: i % 24, count: heat.get(`${Math.floor(i / 24)}:${i % 24}`) ?? 0 })),
      alertsByType: (Object.keys(ALERT_TYPE_LABEL) as AlertType[]).map((type) => ({ type, count: byType.get(type) ?? 0 })),
      monitoringActivity: rows.map((r) => ({ date: r.day, readings: Number(r.readings), checkins: Number(r.checkins) })),
      utilization: rows.map((r) => ({ date: r.day, activeUsers: Number(r.active_staff), sessions: Number(r.sessions_started) })),
      priorityDistribution,
    };
  }
}
