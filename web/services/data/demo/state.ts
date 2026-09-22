import type {
  AccessRequest,
  AlertSeverity,
  AlertThresholds,
  AlertType,
  AnalyticsData,
  AppNotification,
  Appointment,
  AuditEntry,
  CarePlan,
  CareTask,
  ChartEvent,
  CheckIn,
  ClinicalNote,
  DeviceHealth,
  DeviceRecord,
  Facility,
  IndicatorAlert,
  Message,
  NotificationKind,
  OverviewCounts,
  PatientDetail,
  PatientSummary,
  PersonRef,
  ReadingSample,
  ReadingSeries,
  ReportRecord,
  ServiceStatus,
  SessionRecord,
  StaffMember,
  StaffRole,
  SystemHealth,
  TaskType,
  TimeRange,
  TimelineEvent,
} from "@/types/domain";
import { ALERT_TYPE_LABEL, DRESSING_LABEL, rangeSpec, TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { derivePriority, rollupMonitoringStatus } from "@/lib/domain/priority";
import { GLOBAL_THRESHOLDS, REVIEW_SUFFIX } from "@/lib/domain/rules";
import { ageFrom } from "@/utils/format";
import { hashString, round, seededRandom, valueNoise } from "@/utils/math";
import {
  ACCESS_REQUEST_SEEDS,
  APPOINTMENT_KINDS,
  buildPatients,
  demoId,
  FACILITIES,
  MESSAGE_THREADS,
  NOTE_TEMPLATES,
  NS,
  SEED_IDS,
  SPARE_DEVICES,
  STAFF,
  STAFF_IDS,
  type PatientSeed,
  type StaffSeed,
} from "./dataset";
import { DAY, HOUR, isOffline, latestSample, MINUTE, sampleAt, sessionBaseline } from "./signal";

export type DemoTopic =
  | "patients"
  | "alerts"
  | "notes"
  | "tasks"
  | "checkins"
  | "appointments"
  | "notifications"
  | "messages"
  | "reports"
  | "staff"
  | "devices"
  | "approvals"
  | "audit"
  | "rules"
  | "plans";

type StoredNotification = AppNotification & { recipientId: string };

const SEVERITY_BY_TYPE: Record<AlertType, AlertSeverity> = {
  elevated_temperature: "watch",
  humidity_change: "watch",
  moisture_change: "attention",
  device_offline: "watch",
  sync_issue: "info",
};

const MESSAGE_BY_TYPE: Record<AlertType, string> = {
  elevated_temperature: "Localized temperature trend changed from baseline. Review is recommended.",
  humidity_change: "Ambient humidity indicator is above the configured monitoring threshold.",
  moisture_change: "Relative moisture indicator is above the configured monitoring threshold.",
  device_offline: "Device status is offline. Review is recommended.",
  sync_issue: "Device has not synchronized recently.",
};

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(t: number) {
  const d = new Date(startOfDay(t));
  const day = (d.getDay() + 6) % 7;
  return d.getTime() - day * DAY;
}

const iso = (t: number) => new Date(t).toISOString();

export class DemoState {
  readonly t0: number;
  readonly patients: PatientSeed[];
  readonly staff: StaffSeed[];
  alerts: IndicatorAlert[] = [];
  notes: ClinicalNote[] = [];
  carePlans: CarePlan[] = [];
  tasks: CareTask[] = [];
  checkins: CheckIn[] = [];
  appointments: Appointment[] = [];
  notifications: StoredNotification[] = [];
  messages: Message[] = [];
  reports: ReportRecord[] = [];
  accessRequests: AccessRequest[] = [];
  audit: AuditEntry[] = [];
  sessions: SessionRecord[] = [];
  thresholds: AlertThresholds = { ...GLOBAL_THRESHOLDS };
  ruleUpdatedAt: string;
  spareAssignments = new Map<string, string>();
  eventsPerMinute: number[] = [];

  private counters = new Map<number, number>();
  private listeners = new Set<(topic: DemoTopic) => void>();

  constructor(t0 = Date.now()) {
    this.t0 = t0;
    this.staff = STAFF.map((s) => ({ ...s }));
    this.patients = buildPatients(t0);
    this.ruleUpdatedAt = iso(t0 - 6 * DAY);
    const rng = seededRandom(hashString("tend-demo"));
    this.seedHistory(rng);
    this.seedActiveAlerts();
    this.seedSessions(rng);
    this.seedCarePlans();
    this.seedNotes(rng);
    this.seedTasksAndCheckIns(rng);
    this.seedAppointments(rng);
    this.seedMessages();
    this.seedAccessRequests();
    this.seedReports();
    this.seedNotifications();
    this.seedAudit(rng);
    this.eventsPerMinute = Array.from({ length: 30 }, (_, i) => Math.round(42 + 8 * valueNoise(3, i / 4)));
  }

  /* ───────────── infrastructure ───────────── */

  on(listener: (topic: DemoTopic) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(...topics: DemoTopic[]) {
    for (const topic of topics) this.listeners.forEach((l) => l(topic));
  }

  nextId(ns: number) {
    const n = (this.counters.get(ns) ?? 9_000) + 1;
    this.counters.set(ns, n);
    return demoId(ns, n);
  }

  staffById(id: string) {
    return this.staff.find((s) => s.id === id) ?? null;
  }

  ref(id: string): PersonRef {
    const s = this.staffById(id);
    if (s) return { id, name: s.fullName };
    const p = this.patients.find((x) => x.id === id);
    return { id, name: p?.fullName ?? "Unknown" };
  }

  patient(id: string) {
    return this.patients.find((p) => p.id === id) ?? null;
  }

  /** Patients a staff member may see: assignments for clinicians, everyone for admins. */
  visiblePatients(viewerId: string, role: StaffRole) {
    if (role === "admin") return this.patients;
    return this.patients.filter((p) => p.doctorId === viewerId || p.nurseId === viewerId);
  }

  canSee(viewerId: string, role: StaffRole, patientId: string) {
    return this.visiblePatients(viewerId, role).some((p) => p.id === patientId);
  }

  /* ───────────── live state ───────────── */

  latest(p: PatientSeed, now = Date.now()): ReadingSample | null {
    return latestSample(p.profile, now);
  }

  deviceHealth(p: PatientSeed, now = Date.now(), latest = this.latest(p, now)): DeviceHealth {
    if (isOffline(p.profile, now)) return "offline";
    const syncIssue = this.alerts.some((a) => a.patientId === p.id && a.alertType === "sync_issue" && a.status !== "resolved");
    if ((latest?.batteryPercent ?? 100) < 20 || p.device.firmware === "0.0.9" || syncIssue) return "warning";
    return "online";
  }

  summary(p: PatientSeed, now = Date.now()): PatientSummary {
    const latest = this.latest(p, now);
    const health = this.deviceHealth(p, now, latest);
    const active = this.alerts.filter((a) => a.patientId === p.id && a.status !== "resolved");
    const openAlertCount = active.filter((a) => a.status === "open").length;
    const openAttentionCount = active.filter((a) => a.status === "open" && a.severity === "attention").length;
    const acknowledgedAlertCount = active.filter((a) => a.status === "acknowledged").length;
    const monitoringStatus = rollupMonitoringStatus({ deviceHealth: health, activeSeverities: active });
    const lastCheck = this.checkins.find((c) => c.patientId === p.id);
    const facility = FACILITIES.find((f) => f.id === p.facilityId);
    return {
      id: p.id,
      fullName: p.fullName,
      dateOfBirth: p.dateOfBirth,
      age: ageFrom(p.dateOfBirth),
      roomLabel: p.roomLabel,
      facilityId: p.facilityId,
      facilityName: facility?.name ?? null,
      monitoringStatus,
      priority: derivePriority({ monitoringStatus, openAlertCount, openAttentionCount, acknowledgedAlertCount }),
      device: {
        id: p.device.id,
        serial: p.device.serial,
        pairingStatus: health === "offline" ? "disconnected" : "paired",
        health,
        lastSeenAt: latest?.capturedAt ?? null,
        firmware: p.device.firmware,
        batteryPercent: latest?.batteryPercent ?? null,
      },
      session: { id: p.sessionId, label: p.woundLabel, startedAt: iso(p.profile.sessionStart) },
      latest,
      openAlertCount,
      openAttentionCount,
      acknowledgedAlertCount,
      doctor: this.ref(p.doctorId),
      nurse: this.ref(p.nurseId),
      lastCheckAt: lastCheck?.recordedAt ?? null,
      admittedAt: iso(p.profile.admittedAt),
      updatedAt: latest?.capturedAt ?? iso(now),
    };
  }

  detail(p: PatientSeed): PatientDetail {
    return {
      ...this.summary(p),
      emergencyContact: p.emergencyContact,
      carePlans: this.carePlans.filter((c) => c.patientId === p.id),
      sessions: this.sessions.filter((s) => s.patientId === p.id),
    };
  }

  series(p: PatientSeed, range: TimeRange, now = Date.now()): ReadingSeries {
    const spec = rangeSpec(range);
    const bucket = spec.bucketSeconds * 1000;
    const from = now - spec.ms;
    const toPoint = (t: number, at: number) => {
      const s = sampleAt(p.profile, at);
      return {
        t,
        localizedTemperatureC: s?.localizedTemperatureC ?? null,
        ambientTemperatureC: s?.ambientTemperatureC ?? null,
        humidityPercent: s?.humidityPercent ?? null,
        relativeMoistureValue: s?.relativeMoistureValue ?? null,
      };
    };
    const points = [];
    const comparison = [];
    for (let t = from + bucket / 2; t < now; t += bucket) {
      points.push(toPoint(t, t));
      comparison.push(toPoint(t, t - spec.ms));
    }
    points.push(toPoint(now, now));

    const events: ChartEvent[] = [];
    for (const a of this.alerts) {
      const t = Date.parse(a.createdAt);
      if (a.patientId === p.id && t >= from) {
        events.push({ t, kind: a.alertType === "device_offline" ? "device" : "alert", label: ALERT_TYPE_LABEL[a.alertType], severity: a.severity });
      }
    }
    for (const n of this.notes) {
      const t = Date.parse(n.createdAt);
      if (n.patientId === p.id && t >= from) events.push({ t, kind: "note", label: `Note · ${n.author.name}` });
    }
    for (const c of this.checkins) {
      const t = Date.parse(c.recordedAt);
      if (c.patientId === p.id && t >= from && range !== "30D") events.push({ t, kind: "checkin", label: `Check-in · ${c.recordedBy.name}` });
    }
    for (const s of this.sessions) {
      const t = Date.parse(s.startedAt);
      if (s.patientId === p.id && t >= from) events.push({ t, kind: "session", label: "Session started" });
    }
    events.sort((a, b) => a.t - b.t);

    const baseline = sessionBaseline(p.profile, now);
    return {
      range,
      from,
      to: now,
      bucketSeconds: spec.bucketSeconds,
      points,
      comparison,
      baseline: baseline == null ? null : round(baseline, 2),
      thresholds: { ...this.thresholds },
      events,
    };
  }

  timeline(patientId: string): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    for (const s of this.sessions.filter((x) => x.patientId === patientId)) {
      events.push({ id: `${s.id}-start`, at: s.startedAt, kind: "session", title: "Monitoring session started", detail: `${s.deviceSerial} · ${s.label ?? ""}`, actor: null });
      if (s.endedAt) events.push({ id: `${s.id}-end`, at: s.endedAt, kind: "session", title: "Session completed", detail: `${s.readingCount.toLocaleString("en-GB")} readings synchronized`, actor: null });
    }
    for (const a of this.alerts.filter((x) => x.patientId === patientId)) {
      events.push({ id: `${a.id}-open`, at: a.createdAt, kind: "alert", title: ALERT_TYPE_LABEL[a.alertType], detail: a.message.replace(` ${REVIEW_SUFFIX}`, ""), actor: null, severity: a.severity });
      if (a.acknowledgedAt) events.push({ id: `${a.id}-ack`, at: a.acknowledgedAt, kind: "acknowledged", title: "Indicator acknowledged", detail: ALERT_TYPE_LABEL[a.alertType], actor: a.acknowledgedBy?.name ?? null });
      if (a.resolvedAt) events.push({ id: `${a.id}-res`, at: a.resolvedAt, kind: "resolved", title: "Indicator resolved", detail: ALERT_TYPE_LABEL[a.alertType], actor: null });
    }
    for (const n of this.notes.filter((x) => x.patientId === patientId)) {
      events.push({ id: n.id, at: n.createdAt, kind: "note", title: "Clinical note", detail: n.text, actor: n.author.name });
    }
    for (const c of this.checkins.filter((x) => x.patientId === patientId).slice(0, 12)) {
      const parts = [
        c.bodyTemperatureC != null ? `${c.bodyTemperatureC.toFixed(1)} °C` : null,
        c.painScore != null ? `pain ${c.painScore}/10` : null,
        c.dressingCondition ? DRESSING_LABEL[c.dressingCondition] : null,
      ].filter(Boolean);
      events.push({ id: c.id, at: c.recordedAt, kind: "checkin", title: "Bedside check-in", detail: parts.join(" · "), actor: c.recordedBy.name });
    }
    for (const a of this.appointments.filter((x) => x.patientId === patientId && x.status === "completed")) {
      events.push({ id: a.id, at: a.startsAt, kind: "appointment", title: "Review completed", detail: a.location, actor: a.clinician.name });
    }
    return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }

  /* ───────────── mutations shared by the service and the simulator ───────────── */

  createAlert(p: PatientSeed, alertType: AlertType, message: string, severity: AlertSeverity, at = Date.now()) {
    const alert: IndicatorAlert = {
      id: this.nextId(NS.alert),
      patientId: p.id,
      patientName: p.fullName,
      roomLabel: p.roomLabel,
      deviceSerial: p.device.serial,
      sessionId: p.sessionId,
      alertType,
      severity,
      status: "open",
      message,
      createdAt: iso(at),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      escalatedAt: null,
    };
    this.alerts.unshift(alert);
    const created: StoredNotification[] = [p.doctorId, p.nurseId].map((recipientId) =>
      this.notify(recipientId, "indicator_alert", `Monitoring indicator · ${p.fullName}`, ALERT_TYPE_LABEL[alertType], p.id, "indicator_alerts", alert.id, at),
    );
    this.tasks.unshift({
      id: this.nextId(NS.task),
      patientId: p.id,
      patientName: p.fullName,
      roomLabel: p.roomLabel,
      assignedTo: this.ref(p.nurseId),
      taskType: "indicator_review",
      title: `Review ${ALERT_TYPE_LABEL[alertType].toLowerCase()}`,
      details: "Created automatically when the indicator opened.",
      priority: severity === "attention" ? "urgent" : severity === "watch" ? "high" : "normal",
      status: "pending",
      dueAt: iso(at + 15 * MINUTE),
      delayedUntil: null,
      delayReason: null,
      completedAt: null,
      alertId: alert.id,
    });
    this.emit("alerts", "patients", "notifications", "tasks");
    return { alert, notifications: created };
  }

  notify(
    recipientId: string,
    kind: NotificationKind,
    title: string,
    body: string | null,
    patientId: string | null,
    entityType: string | null,
    entityId: string | null,
    at = Date.now(),
    read = false,
  ): StoredNotification {
    const n: StoredNotification = {
      id: this.nextId(NS.notification),
      recipientId,
      kind,
      title,
      body,
      patientId,
      entityType,
      entityId,
      readAt: read ? iso(at + 5 * MINUTE) : null,
      createdAt: iso(at),
    };
    this.notifications.unshift(n);
    return n;
  }

  log(actorId: string | null, action: string, entityType: string, entityId: string | null, result: AuditEntry["result"] = "success", metadata: AuditEntry["metadata"] = {}, at = Date.now()) {
    const actor = actorId ? this.staffById(actorId) : null;
    this.audit.unshift({
      id: this.nextId(NS.audit),
      createdAt: iso(at),
      actor: actor ? { id: actor.id, name: actor.fullName, role: actor.role } : null,
      action,
      entityType,
      entityId,
      result,
      metadata,
    });
  }

  /* ───────────── admin aggregates ───────────── */

  devices(now = Date.now()): DeviceRecord[] {
    const paired = this.patients.map((p): DeviceRecord => {
      const latest = this.latest(p, now);
      const health = this.deviceHealth(p, now, latest);
      return {
        id: p.device.id,
        serial: p.device.serial,
        name: p.device.name,
        patient: { id: p.id, name: p.fullName },
        facilityName: FACILITIES.find((f) => f.id === p.facilityId)?.name ?? null,
        pairingStatus: health === "offline" ? "disconnected" : "paired",
        health,
        batteryPercent: latest?.batteryPercent ?? null,
        lastSyncAt: latest?.capturedAt ?? null,
        connection: health === "offline" ? "none" : health === "warning" && p.device.firmware !== "0.0.9" ? "pending_sync" : "ble_gateway",
        firmware: p.device.firmware,
        sessionActive: true,
      };
    });
    const spares = SPARE_DEVICES.map((d): DeviceRecord => {
      const patientId = this.spareAssignments.get(d.id) ?? null;
      const patient = patientId ? this.patient(patientId) : null;
      return {
        id: d.id,
        serial: d.serial,
        name: d.name,
        patient: patient ? { id: patient.id, name: patient.fullName } : null,
        facilityName: FACILITIES[0].name,
        pairingStatus: patient ? "paired" : "unpaired",
        health: patient ? "online" : "offline",
        batteryPercent: 100,
        lastSyncAt: patient ? iso(now) : iso(this.t0 - 4 * DAY),
        connection: patient ? "ble_gateway" : "none",
        firmware: d.firmware,
        sessionActive: false,
      };
    });
    return [...paired, ...spares];
  }

  facilities(): Facility[] {
    return FACILITIES.map((f) => {
      const patients = this.patients.filter((p) => p.facilityId === f.id);
      return {
        ...f,
        patientCount: patients.length,
        staffCount: this.staff.filter((s) => s.facilityId === f.id && s.status === "active").length,
        deviceCount: patients.length,
        openAlertCount: this.alerts.filter((a) => a.status !== "resolved" && patients.some((p) => p.id === a.patientId)).length,
      };
    });
  }

  staffMembers(): StaffMember[] {
    return this.staff.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      phone: s.phone,
      role: s.role,
      title: s.title,
      department: s.department,
      facilityId: s.facilityId,
      facilityName: FACILITIES.find((f) => f.id === s.facilityId)?.name ?? null,
      status: s.status,
      lastActiveAt: s.status === "suspended" ? iso(this.t0 - 5 * DAY) : iso(this.t0 - ((hashString(s.id) % 180) + 2) * MINUTE),
      createdAt: iso(this.t0 - s.joinedDaysAgo * DAY),
      assignedPatientCount: this.patients.filter((p) => p.doctorId === s.id || p.nurseId === s.id).length,
    }));
  }

  overview(now = Date.now()): OverviewCounts {
    const devices = this.devices(now);
    const active = this.alerts.filter((a) => a.status !== "resolved");
    return {
      doctors: this.staff.filter((s) => s.role === "doctor").length,
      nurses: this.staff.filter((s) => s.role === "nurse").length,
      patients: this.patients.length,
      devices: devices.length,
      onlineDevices: devices.filter((d) => d.health === "online").length,
      warningDevices: devices.filter((d) => d.health === "warning").length,
      offlineDevices: devices.filter((d) => d.health === "offline").length,
      activeAlerts: active.length,
      criticalAlerts: active.filter((a) => a.status === "open" && a.severity === "attention").length,
      pendingApprovals: this.accessRequests.filter((r) => r.status === "pending").length,
    };
  }

  health(now = Date.now()): SystemHealth {
    const minute = Math.floor(now / MINUTE);
    const history = (key: number, base: number, spread: number) =>
      Array.from({ length: 24 }, (_, i) => Math.round(base + spread * (0.5 + 0.5 * valueNoise(key, (minute - 23 + i) / 3))));
    const services: ServiceStatus[] = [
      { id: "api", name: "Lambda API", status: "operational", latencyMs: 38 + (minute % 7), uptimePercent: 99.98, detail: "API Gateway HTTP API · Node.js 22", history: history(1, 30, 22) },
      { id: "database", name: "Postgres", status: "operational", latencyMs: 6 + (minute % 3), uptimePercent: 99.99, detail: "RLS forced on 21 tables", history: history(2, 4, 6) },
      { id: "realtime", name: "Realtime", status: "operational", latencyMs: 62 + (minute % 11), uptimePercent: 99.95, detail: "postgres_changes on 8 tables", history: history(3, 50, 30) },
      { id: "auth", name: "Auth", status: "operational", latencyMs: 71, uptimePercent: 99.99, detail: "Email and password, JWT with role claim", history: history(4, 55, 25) },
      { id: "storage", name: "Storage", status: "operational", latencyMs: 94, uptimePercent: 99.97, detail: "Report exports bucket", history: history(5, 80, 30) },
      {
        id: "sync",
        name: "Device sync",
        status: this.devices(now).some((d) => d.health === "offline" && d.sessionActive) ? "degraded" : "operational",
        latencyMs: null,
        uptimePercent: 99.2,
        detail: "BLE → phone SQLite queue → Lambda batch upload",
        history: history(6, 12, 8),
      },
    ];
    return {
      checkedAt: iso(now),
      services,
      storage: { usedGb: 2.41, totalGb: 8 },
      sync: {
        pendingBatches: this.devices(now).filter((d) => d.connection === "pending_sync").length,
        lastBatchAt: iso(now - 4_000),
        successRate: 99.2,
        readingsLastHour: this.patients.filter((p) => !isOffline(p.profile, now)).length * 60,
      },
      realtime: { connectedClients: 9, eventsPerMinute: [...this.eventsPerMinute] },
    };
  }

  analytics(days: number, now = Date.now()): AnalyticsData {
    const today = startOfDay(now);
    const dates = Array.from({ length: days }, (_, i) => today - (days - 1 - i) * DAY);
    const staffJoined = (role: StaffRole, t: number) => this.staff.filter((s) => s.role === role && this.t0 - s.joinedDaysAgo * DAY <= t + DAY).length;
    const heat = new Map<string, number>();
    for (const a of this.alerts) {
      const d = new Date(a.createdAt);
      const key = `${(d.getDay() + 6) % 7}:${d.getHours()}`;
      heat.set(key, (heat.get(key) ?? 0) + 1);
    }
    const alertHeatmap = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const shape = 1.2 + Math.sin(((hour - 5) / 24) * Math.PI * 2) * 0.9 + (hour >= 6 && hour <= 9 ? 1.4 : 0);
        const base = Math.max(0, Math.round(shape + 1.4 * valueNoise(day * 31 + 5, hour / 2)));
        alertHeatmap.push({ day, hour, count: base + (heat.get(`${day}:${hour}`) ?? 0) });
      }
    }
    const byType = new Map<AlertType, number>();
    for (const a of this.alerts) byType.set(a.alertType, (byType.get(a.alertType) ?? 0) + 1);
    const summaries = this.patients.map((p) => this.summary(p, now));
    return {
      userGrowth: dates.map((t, i) => ({
        date: iso(t),
        doctors: staffJoined("doctor", t),
        nurses: staffJoined("nurse", t),
        patients: Math.max(2, Math.round(3 + (i / Math.max(1, days - 1)) * 9 + valueNoise(11, i / 3))),
      })),
      deviceHealth: dates.map((t, i) => {
        const offline = Math.max(0, Math.round(0.6 + valueNoise(21, i / 2) * 1.2));
        const warning = Math.max(0, Math.round(1.2 + valueNoise(23, i / 2) * 1.3));
        return { date: iso(t), online: 14 - offline - warning, warning, offline };
      }),
      alertHeatmap,
      alertsByType: (Object.keys(SEVERITY_BY_TYPE) as AlertType[]).map((type) => ({ type, count: (byType.get(type) ?? 0) + (hashString(type) % 6) + 2 })),
      monitoringActivity: dates.map((t, i) => ({
        date: iso(t),
        readings: Math.round((9 + (i / Math.max(1, days - 1)) * 3) * 1440 * (0.93 + 0.05 * valueNoise(31, i / 2))),
        checkins: Math.round(24 + 10 * (i / Math.max(1, days - 1)) + 5 * valueNoise(33, i / 2)),
      })),
      utilization: dates.map((t, i) => {
        const weekend = [0, 6].includes(new Date(t).getDay());
        return {
          date: iso(t),
          activeUsers: Math.round((weekend ? 5 : 8) + 1.5 * valueNoise(41, i / 2)),
          sessions: Math.round((weekend ? 14 : 26) + 5 * valueNoise(43, i / 2)),
        };
      }),
      priorityDistribution: {
        critical: summaries.filter((s) => s.priority === "critical").length,
        high: summaries.filter((s) => s.priority === "high").length,
        medium: summaries.filter((s) => s.priority === "medium").length,
        low: summaries.filter((s) => s.priority === "low").length,
      },
    };
  }

  /* ───────────── seeding ───────────── */

  private historicalAlert(p: PatientSeed, type: AlertType, createdAt: number, ackBy: string | null, ackAt: number | null, resolvedAt: number | null): IndicatorAlert {
    return {
      id: this.nextId(NS.alert),
      patientId: p.id,
      patientName: p.fullName,
      roomLabel: p.roomLabel,
      deviceSerial: p.device.serial,
      sessionId: p.sessionId,
      alertType: type,
      severity: SEVERITY_BY_TYPE[type],
      status: resolvedAt ? "resolved" : ackAt ? "acknowledged" : "open",
      message: `${MESSAGE_BY_TYPE[type]} ${REVIEW_SUFFIX}`,
      createdAt: iso(createdAt),
      acknowledgedAt: ackAt ? iso(ackAt) : null,
      acknowledgedBy: ackBy ? this.ref(ackBy) : null,
      resolvedAt: resolvedAt ? iso(resolvedAt) : null,
      escalatedAt: null,
    };
  }

  /** Resolved indicators earlier in each admission, with matching bumps in the signal. */
  private seedHistory(rng: () => number) {
    const types: AlertType[] = ["moisture_change", "elevated_temperature", "humidity_change", "device_offline", "sync_issue"];
    for (const p of this.patients) {
      const window = p.profile.sessionStart - p.profile.admittedAt - 6 * HOUR;
      const count = window > DAY ? Math.floor(rng() * 4) : 0;
      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(rng() * types.length)];
        const at = p.profile.admittedAt + 3 * HOUR + rng() * window;
        const rampMs = (20 + rng() * 40) * MINUTE;
        const endMs = at + (60 + rng() * 120) * MINUTE;
        if (type === "moisture_change") p.profile.overlays.push({ metric: "moisture", startMs: at - rampMs * 0.8, rampMs, delta: 200 + rng() * 80, endMs });
        if (type === "elevated_temperature") p.profile.overlays.push({ metric: "temp", startMs: at - rampMs * 0.8, rampMs, delta: 1.1 + rng() * 0.4, endMs });
        if (type === "humidity_change") p.profile.overlays.push({ metric: "humidity", startMs: at - rampMs * 0.8, rampMs, delta: 20 + rng() * 6, endMs });
        if (type === "device_offline") p.profile.offline.push({ from: at, to: at + (8 + rng() * 30) * MINUTE });
        const ackBy = rng() > 0.35 ? p.nurseId : p.doctorId;
        const ackAt = at + (4 + rng() * 30) * MINUTE;
        this.alerts.push(this.historicalAlert(p, type, at, ackBy, ackAt, endMs + (10 + rng() * 60) * MINUTE));
      }
    }
    const mei = this.patients[10];
    this.alerts.push(this.historicalAlert(mei, "moisture_change", this.t0 - 8.2 * HOUR, mei.nurseId, this.t0 - 8 * HOUR, this.t0 - 6.3 * HOUR));
  }

  private seedActiveAlerts() {
    const [amina, , , kwame, elena, arjun, , , , oliver] = this.patients;
    this.alerts.push(
      this.historicalAlert(amina, "elevated_temperature", this.t0 - 40 * MINUTE, null, null, null),
      this.historicalAlert(amina, "moisture_change", this.t0 - 65 * MINUTE, amina.nurseId, this.t0 - 30 * MINUTE, null),
      this.historicalAlert(kwame, "moisture_change", this.t0 - 50 * MINUTE, null, null, null),
      this.historicalAlert(elena, "device_offline", this.t0 - 22 * MINUTE, null, null, null),
      this.historicalAlert(arjun, "humidity_change", this.t0 - 4.2 * HOUR, arjun.nurseId, this.t0 - 3.4 * HOUR, null),
      this.historicalAlert(oliver, "sync_issue", this.t0 - 35 * MINUTE, null, null, null),
    );
    // The seed ids let the Supabase demo rows and this dataset describe the same indicators.
    const tempAlert = this.alerts.find((a) => a.patientId === amina.id && a.alertType === "elevated_temperature" && a.status === "open");
    if (tempAlert) tempAlert.id = "c1111111-1111-4111-8111-111111111101";
    const moistureAlert = this.alerts.find((a) => a.patientId === amina.id && a.alertType === "moisture_change" && a.status === "acknowledged");
    if (moistureAlert) moistureAlert.id = "c1111111-1111-4111-8111-111111111102";
    this.alerts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  private seedSessions(rng: () => number) {
    for (const p of this.patients) {
      const readingsPerHour = 60;
      const current: SessionRecord = {
        id: p.sessionId,
        patientId: p.id,
        deviceSerial: p.device.serial,
        label: p.woundLabel,
        status: "active",
        startedAt: iso(p.profile.sessionStart),
        endedAt: null,
        readingCount: Math.round(((this.t0 - p.profile.sessionStart) / HOUR) * readingsPerHour),
        alertCount: this.alerts.filter((a) => a.patientId === p.id && Date.parse(a.createdAt) >= p.profile.sessionStart).length,
      };
      this.sessions.push(current);
      let end = p.profile.sessionStart;
      let n = 1;
      while (end - p.profile.admittedAt > 6 * HOUR) {
        const length = Math.min(end - p.profile.admittedAt, (36 + rng() * 24) * HOUR);
        const start = end - length;
        this.sessions.push({
          id: demoId(NS.session, 100_000 + (hashString(p.id) % 1000) * 100 + n),
          patientId: p.id,
          deviceSerial: p.device.serial,
          label: p.woundLabel,
          status: "completed",
          startedAt: iso(start),
          endedAt: iso(end),
          readingCount: Math.round((length / HOUR) * readingsPerHour * (0.96 + rng() * 0.03)),
          alertCount: this.alerts.filter((a) => a.patientId === p.id && Date.parse(a.createdAt) >= start && Date.parse(a.createdAt) < end).length,
        });
        end = start;
        n++;
      }
    }
  }

  private seedCarePlans() {
    for (const p of this.patients) {
      this.carePlans.push({
        id: p.id === SEED_IDS.patient ? "e1111111-1111-4111-8111-111111111101" : this.nextId(NS.plan),
        patientId: p.id,
        author: this.ref(p.doctorId),
        title: `${p.woundLabel.replace("Simulated dressing, ", "Simulated dressing monitoring, ")}`,
        instructions:
          "Keep the simulated dressing in place. Review localized temperature and relative moisture indicators every 4 hours and record a bedside check. Escalate to the doctor when an attention indicator opens.",
        dressingChangeIntervalHours: 48,
        reviewIntervalHours: 4,
        active: true,
        createdAt: iso(p.profile.admittedAt + 2 * HOUR),
      });
    }
  }

  private seedNotes(rng: () => number) {
    for (const p of this.patients) {
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        const byDoctor = rng() > 0.5;
        const templates = byDoctor ? NOTE_TEMPLATES.doctor : NOTE_TEMPLATES.nurse;
        const authorId = byDoctor ? p.doctorId : p.nurseId;
        this.notes.push({
          id: this.nextId(NS.note),
          patientId: p.id,
          author: { ...this.ref(authorId), role: byDoctor ? "doctor" : "nurse" },
          text: templates[Math.floor(rng() * templates.length)],
          alertId: null,
          createdAt: iso(this.t0 - (1 + rng() * 40) * HOUR),
        });
      }
    }
    const amina = this.patients[0];
    this.notes.push({
      id: "d1111111-1111-4111-8111-111111111101",
      patientId: amina.id,
      author: { ...this.ref(amina.doctorId), role: "doctor" },
      text: "Simulated moisture change reviewed. Continued monitoring of the dressing indicators is recommended.",
      alertId: "c1111111-1111-4111-8111-111111111102",
      createdAt: iso(this.t0 - 25 * MINUTE),
    });
    this.notes.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  private seedTasksAndCheckIns(rng: () => number) {
    const now = this.t0;
    const dayStart = startOfDay(now);
    const slots: { hour: number; type: TaskType; title: (p: PatientSeed) => string }[] = [
      { hour: 8, type: "measurement", title: () => "Morning bedside check" },
      { hour: 11, type: "device_check", title: (p) => `Confirm ${p.device.serial} is secured and synchronizing` },
      { hour: 14, type: "dressing_check", title: () => "Dressing edge and seal check" },
      { hour: 18, type: "measurement", title: () => "Evening bedside check" },
      { hour: 21, type: "patient_education", title: () => "Explain overnight monitoring and the call button" },
    ];
    this.patients.forEach((p, index) => {
      slots.forEach((slot, s) => {
        if ((index + s) % 5 === 4) return;
        const due = dayStart + slot.hour * HOUR + ((index * 7) % 45) * MINUTE;
        let status: CareTask["status"] = "pending";
        let completedAt: number | null = null;
        if (due < now - 40 * MINUTE) {
          status = index % 6 === 3 && s === 0 ? "pending" : "completed";
          if (status === "completed") completedAt = due + (4 + rng() * 22) * MINUTE;
        } else if (due < now + 10 * MINUTE && index % 3 === 0) {
          status = "in_progress";
        }
        const task: CareTask = {
          id: this.nextId(NS.task),
          patientId: p.id,
          patientName: p.fullName,
          roomLabel: p.roomLabel,
          assignedTo: this.ref(p.nurseId),
          taskType: slot.type,
          title: slot.title(p),
          details: slot.type === "measurement" ? "Body temperature, pain score and dressing condition." : null,
          priority: slot.type === "device_check" ? "low" : "normal",
          status,
          dueAt: iso(due),
          delayedUntil: null,
          delayReason: null,
          completedAt: completedAt ? iso(completedAt) : null,
          alertId: null,
        };
        this.tasks.push(task);
        if (completedAt && (slot.type === "measurement" || slot.type === "dressing_check")) {
          this.checkins.push(this.makeCheckIn(p, completedAt, task.id, rng));
        }
      });
      for (let t = startOfDay(p.profile.admittedAt) + 8 * HOUR; t < dayStart; t += 8 * HOUR) {
        if (t > p.profile.admittedAt) this.checkins.push(this.makeCheckIn(p, t + rng() * 40 * MINUTE, null, rng));
      }
    });
    for (const a of this.alerts.filter((x) => x.status !== "resolved")) {
      const p = this.patient(a.patientId);
      if (!p) continue;
      this.tasks.push({
        id: this.nextId(NS.task),
        patientId: p.id,
        patientName: p.fullName,
        roomLabel: p.roomLabel,
        assignedTo: this.ref(p.nurseId),
        taskType: "indicator_review",
        title: `Review ${ALERT_TYPE_LABEL[a.alertType].toLowerCase()}`,
        details: "Created automatically when the indicator opened.",
        priority: a.severity === "attention" ? "urgent" : a.severity === "watch" ? "high" : "normal",
        status: a.status === "acknowledged" ? "completed" : "pending",
        dueAt: iso(Date.parse(a.createdAt) + 15 * MINUTE),
        delayedUntil: null,
        delayReason: null,
        completedAt: a.acknowledgedAt,
        alertId: a.id,
      });
    }
    const delayed = this.tasks.find((t) => t.status === "pending" && t.taskType === "patient_education");
    if (delayed) {
      delayed.status = "delayed";
      delayed.delayedUntil = iso(Date.parse(delayed.dueAt) + 45 * MINUTE);
      delayed.delayReason = "Patient asleep";
    }
    this.tasks.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
    this.checkins.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  }

  makeCheckIn(p: PatientSeed, at: number, taskId: string | null, rng: () => number): CheckIn {
    const conditions = ["intact", "intact", "intact", "damp", "lifted"] as const;
    return {
      id: this.nextId(NS.checkin),
      patientId: p.id,
      patientName: p.fullName,
      recordedBy: this.ref(p.nurseId),
      bodyTemperatureC: round(36.4 + rng() * 0.8, 1),
      painScore: Math.floor(rng() * 4) + 1,
      dressingCondition: conditions[Math.floor(rng() * conditions.length)],
      deviceSecure: rng() > 0.08,
      notes: null,
      recordedAt: iso(at),
      taskId,
    };
  }

  private seedAppointments(rng: () => number) {
    const weekStart = startOfWeek(this.t0);
    const times = [9.5, 11, 14.5, 16];
    for (const doctorId of [STAFF_IDS.HELEN, STAFF_IDS.RAFAEL, STAFF_IDS.ANJALI]) {
      const list = this.patients.filter((p) => p.doctorId === doctorId);
      let cursor = 0;
      for (let day = 0; day < 5; day++) {
        for (const time of times) {
          if (rng() < 0.3) continue;
          const p = list[cursor++ % list.length];
          const kind = APPOINTMENT_KINDS[Math.floor(rng() * APPOINTMENT_KINDS.length)];
          const starts = weekStart + day * DAY + time * HOUR;
          const ends = starts + (kind === "dressing_change" ? 45 : 30) * MINUTE;
          const past = ends < this.t0;
          this.appointments.push({
            id: this.nextId(NS.appointment),
            patientId: p.id,
            patientName: p.fullName,
            clinician: this.ref(doctorId),
            kind,
            status: past ? (rng() < 0.1 ? "missed" : "completed") : "scheduled",
            startsAt: iso(starts),
            endsAt: iso(ends),
            location: `${FACILITIES.find((f) => f.id === p.facilityId)?.code ?? ""} · ${p.roomLabel}`,
            notes: null,
          });
        }
      }
    }
    this.appointments.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }

  private seedMessages() {
    for (const thread of MESSAGE_THREADS) {
      const patientId = thread.patientIndex == null ? null : this.patients[thread.patientIndex].id;
      thread.lines.forEach((line, i) => {
        const senderId = line.from === "a" ? thread.a : thread.b;
        const recipientId = line.from === "a" ? thread.b : thread.a;
        const last = i === thread.lines.length - 1;
        const at = this.t0 - line.minutesAgo * MINUTE;
        this.messages.push({
          id: this.nextId(NS.message),
          senderId,
          recipientId,
          patientId,
          body: line.body,
          readAt: last && line.minutesAgo < 60 ? null : iso(at + 3 * MINUTE),
          createdAt: iso(at),
        });
      });
    }
    this.messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  private seedAccessRequests() {
    ACCESS_REQUEST_SEEDS.forEach((seed, i) => {
      const createdAt = this.t0 - seed.hoursAgo * HOUR;
      const reviewed = "reviewed" in seed ? seed.reviewed : null;
      this.accessRequests.push({
        id: this.nextId(NS.access),
        requester: { id: demoId(NS.access, 100 + i), name: seed.name, email: seed.email },
        requestedRole: seed.role,
        facilityName: FACILITIES.find((f) => f.id === seed.facilityId)?.name ?? null,
        department: seed.department,
        licenseNumber: seed.license,
        justification: seed.justification,
        status: reviewed ?? "pending",
        createdAt: iso(createdAt),
        reviewedAt: reviewed ? iso(createdAt + 5 * HOUR) : null,
        reviewedBy: reviewed ? this.ref(SEED_IDS.admin) : null,
        reviewNote: reviewed === "rejected" ? "Device battery levels are available in the weekly device health report." : null,
      });
    });
  }

  private seedReports() {
    const make = (type: ReportRecord["reportType"], format: ReportRecord["format"], by: string, hoursAgo: number, patientIndex: number | null, days: number) => {
      const created = this.t0 - hoursAgo * HOUR;
      const p = patientIndex == null ? null : this.patients[patientIndex];
      this.reports.push({
        id: this.nextId(NS.report),
        reportType: type,
        format,
        status: "ready",
        periodStart: iso(created - days * DAY),
        periodEnd: iso(created),
        patient: p ? { id: p.id, name: p.fullName } : null,
        createdBy: this.ref(by),
        createdAt: iso(created),
        completedAt: iso(created + 40_000),
      });
    };
    make("patient_summary", "pdf", STAFF_IDS.HELEN, 5, 0, 3);
    make("indicator_log", "csv", STAFF_IDS.HELEN, 30, null, 7);
    make("device_health", "csv", SEED_IDS.admin, 20, null, 7);
    make("audit_export", "csv", SEED_IDS.admin, 50, null, 30);
    make("facility_activity", "pdf", SEED_IDS.admin, 76, null, 30);
    make("session_summary", "pdf", STAFF_IDS.RAFAEL, 12, 2, 2);
  }

  private seedNotifications() {
    for (const a of this.alerts) {
      const created = Date.parse(a.createdAt);
      if (this.t0 - created > 2 * DAY) continue;
      const p = this.patient(a.patientId);
      if (!p) continue;
      for (const recipientId of [p.doctorId, p.nurseId]) {
        this.notify(recipientId, "indicator_alert", `Monitoring indicator · ${p.fullName}`, ALERT_TYPE_LABEL[a.alertType], p.id, "indicator_alerts", a.id, created, a.status !== "open");
      }
    }
    for (const m of this.messages.filter((x) => !x.readAt)) {
      const sender = this.staffById(m.senderId);
      this.notify(m.recipientId, "message", `Message from ${sender?.fullName ?? "a colleague"}`, m.body.slice(0, 90), m.patientId, "messages", m.id, Date.parse(m.createdAt));
    }
    for (const t of this.tasks.filter((x) => x.status === "pending" && Date.parse(x.dueAt) < this.t0 && x.assignedTo)) {
      this.notify(t.assignedTo!.id, "task", "Task overdue", `${t.title} · ${t.patientName}`, t.patientId, "care_tasks", t.id, Date.parse(t.dueAt) + 5 * MINUTE);
    }
    for (const r of this.accessRequests.filter((x) => x.status === "pending")) {
      for (const admin of this.staff.filter((s) => s.role === "admin")) {
        this.notify(admin.id, "approval", "Access request", `${r.requester.name} requested ${r.requestedRole} access`, null, "access_requests", r.id, Date.parse(r.createdAt));
      }
    }
    for (const admin of this.staff.filter((s) => s.role === "admin")) {
      this.notify(admin.id, "device", "Device offline", "ESP32-005 has not synchronized for 20 minutes", this.patients[4].id, "devices", this.patients[4].device.id, this.t0 - 20 * MINUTE);
      this.notify(admin.id, "system", "Firmware 0.1.1 staged", "Rollout to North Wing devices is scheduled for 02:00", null, null, null, this.t0 - 6 * HOUR, true);
    }
    this.notifications.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  private seedAudit(rng: () => number) {
    const at = (t: string | number) => (typeof t === "number" ? t : Date.parse(t));
    for (const a of this.alerts) {
      if (a.acknowledgedAt && a.acknowledgedBy) this.log(a.acknowledgedBy.id, "indicator_alerts.acknowledge", "indicator_alerts", a.id, "success", { patient: a.patientName }, at(a.acknowledgedAt));
    }
    for (const n of this.notes) this.log(n.author.id, "clinical_notes.insert", "clinical_notes", n.id, "success", { patient: this.patient(n.patientId)?.fullName ?? null }, at(n.createdAt));
    for (const c of this.checkins.slice(0, 60)) this.log(c.recordedBy.id, "patient_checkins.insert", "patient_checkins", c.id, "success", { patient: c.patientName }, at(c.recordedAt));
    for (const r of this.reports) this.log(r.createdBy.id, "reports.insert", "reports", r.id, "success", { type: r.reportType, format: r.format }, at(r.createdAt));
    for (const r of this.accessRequests.filter((x) => x.reviewedAt)) {
      this.log(SEED_IDS.admin, `access_requests.${r.status === "approved" ? "approve" : "reject"}`, "access_requests", r.id, "success", { requester: r.requester.name, role: r.requestedRole }, at(r.reviewedAt!));
      if (r.status === "approved") this.log(SEED_IDS.admin, "profiles.role_change", "profiles", r.requester.id, "success", { role: r.requestedRole }, at(r.reviewedAt!) + 2_000);
    }
    for (let d = 0; d < 7; d++) {
      for (const s of this.staff.filter((x) => x.status === "active")) {
        if (rng() < 0.25) continue;
        const t = startOfDay(this.t0) - d * DAY + (7 + rng() * 3) * HOUR;
        if (t < this.t0) this.log(s.id, "auth.sign_in", "auth_sessions", null, "success", { method: "password" }, t);
      }
    }
    this.log(demoId(NS.staff, 8), "auth.sign_in", "auth_sessions", null, "denied", { reason: "account suspended" }, this.t0 - 26 * HOUR);
    this.log(null, "auth.sign_in", "auth_sessions", null, "failed", { reason: "invalid credentials", email: "unknown" }, this.t0 - 14 * HOUR);
    this.log(STAFF_IDS.GRACE, "patient_profiles.read", "patient_profiles", this.patients[0].id, "denied", { reason: "no active assignment" }, this.t0 - 9 * HOUR);
    this.log(SEED_IDS.admin, "devices.assign", "devices", this.patients[7].device.id, "success", { serial: this.patients[7].device.serial }, this.patients[7].profile.admittedAt);
    this.log(SEED_IDS.admin, "alert_rules.update", "alert_rules", SEED_IDS.rule, "success", { moisture_threshold: 350 }, Date.parse(this.ruleUpdatedAt));
    this.log(STAFF_IDS.OWEN, "security.policy_update", "auth_settings", null, "success", { session_timeout_minutes: 30 }, this.t0 - 3 * DAY);
    this.audit.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

let instance: DemoState | null = null;

/** One simulated hospital per browser tab, shared by the data service and the realtime source. */
export function getDemoState() {
  if (!instance) instance = new DemoState();
  return instance;
}
