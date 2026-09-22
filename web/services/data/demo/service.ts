import type {
  AlertThresholds,
  Appointment,
  AppointmentInput,
  CarePlan,
  CareTask,
  CheckInInput,
  ReportRequest,
  StaffRole,
  StaffStatus,
  TimeRange,
  Viewer,
} from "@/types/domain";
import { env } from "@/lib/env";
import { ALERT_TYPE_LABEL } from "@/lib/domain/labels";
import { pingApi } from "../supabase/api";
import { checkClinicalWording } from "@/lib/domain/rules";
import { seededRandom } from "@/utils/math";
import type { AlertFilter, AuditFilter, DataService, TaskFilter, TaskUpdate } from "../types";
import { NS, SEED_IDS } from "./dataset";
import { MINUTE } from "./signal";
import { getDemoState, type DemoState } from "./state";

const iso = (t: number) => new Date(t).toISOString();

export class DemoError extends Error {
  constructor(
    message: string,
    readonly code: "forbidden" | "not_found" | "validation_error" | "conflict",
  ) {
    super(message);
  }
}

/** Short, fixed latency so loading states are exercised without slowing the demo. */
const settle = <T>(value: T, ms = 140) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

export class DemoDataService implements DataService {
  readonly mode = "demo" as const;

  constructor(readonly viewer: Viewer) {}

  /** Resolved on first use so server rendering never builds the simulated hospital. */
  private get state(): DemoState {
    return getDemoState();
  }

  private get role(): StaffRole {
    return this.viewer.role;
  }

  private visible() {
    return this.state.visiblePatients(this.viewer.id, this.role);
  }

  private requirePatient(patientId: string) {
    const p = this.state.patient(patientId);
    if (!p || !this.state.canSee(this.viewer.id, this.role, patientId)) {
      this.state.log(this.viewer.id, "patient_profiles.read", "patient_profiles", patientId, "denied", { reason: "no active assignment" });
      throw new DemoError("This patient is not on your assignment list.", "not_found");
    }
    return p;
  }

  private requireAlert(alertId: string) {
    const alert = this.state.alerts.find((a) => a.id === alertId);
    if (!alert) throw new DemoError("Indicator not found.", "not_found");
    this.requirePatient(alert.patientId);
    return alert;
  }

  private requireAdmin() {
    if (this.role !== "admin") throw new DemoError("Administrator access is required.", "forbidden");
  }

  async listPatients() {
    return settle(this.visible().map((p) => this.state.summary(p)));
  }

  async getPatient(patientId: string) {
    const p = this.state.patient(patientId);
    if (!p || !this.state.canSee(this.viewer.id, this.role, patientId)) return settle(null);
    return settle(this.state.detail(p));
  }

  async getSeries(patientId: string, range: TimeRange) {
    return settle(this.state.series(this.requirePatient(patientId), range), 180);
  }

  async getTimeline(patientId: string) {
    this.requirePatient(patientId);
    return settle(this.state.timeline(patientId));
  }

  async listAlerts(filter: AlertFilter = {}) {
    const ids = new Set(this.visible().map((p) => p.id));
    let alerts = this.state.alerts.filter((a) => ids.has(a.patientId));
    if (filter.patientId) alerts = alerts.filter((a) => a.patientId === filter.patientId);
    if (filter.status === "active") alerts = alerts.filter((a) => a.status !== "resolved");
    else if (filter.status) alerts = alerts.filter((a) => a.status === filter.status);
    return settle(alerts);
  }

  async acknowledgeAlert(alertId: string) {
    const alert = this.requireAlert(alertId);
    if (alert.status === "resolved") throw new DemoError("A resolved indicator cannot be acknowledged.", "conflict");
    if (alert.status === "open") {
      alert.status = "acknowledged";
      alert.acknowledgedAt = iso(Date.now());
      alert.acknowledgedBy = { id: this.viewer.id, name: this.viewer.fullName };
      this.state.notifications.filter((n) => n.entityId === alertId).forEach((n) => (n.readAt ??= iso(Date.now())));
      this.state.log(this.viewer.id, "indicator_alerts.acknowledge", "indicator_alerts", alertId, "success", { patient: alert.patientName });
      this.state.emit("alerts", "patients", "notifications", "audit");
    }
    return settle(alert, 220);
  }

  async resolveAlert(alertId: string) {
    const alert = this.requireAlert(alertId);
    if (alert.status !== "resolved") {
      const now = iso(Date.now());
      if (alert.status === "open") {
        alert.acknowledgedAt = now;
        alert.acknowledgedBy = { id: this.viewer.id, name: this.viewer.fullName };
      }
      alert.status = "resolved";
      alert.resolvedAt = now;
      this.state.tasks.filter((t) => t.alertId === alertId && t.status !== "completed").forEach((t) => {
        t.status = "completed";
        t.completedAt = now;
      });
      this.state.log(this.viewer.id, "indicator_alerts.resolve", "indicator_alerts", alertId, "success", { patient: alert.patientName });
      this.state.emit("alerts", "patients", "tasks", "audit");
    }
    return settle(alert, 220);
  }

  async escalateAlert(alertId: string, note?: string) {
    const alert = this.requireAlert(alertId);
    const p = this.state.patient(alert.patientId)!;
    alert.escalatedAt = iso(Date.now());
    this.state.notify(
      p.doctorId,
      "alert_escalation",
      `${this.viewer.fullName} asked for a review · ${p.fullName}`,
      note?.trim() || `${ALERT_TYPE_LABEL[alert.alertType]}. Bedside review requested.`,
      p.id,
      "indicator_alerts",
      alertId,
    );
    this.state.log(this.viewer.id, "indicator_alerts.escalate", "indicator_alerts", alertId, "success", { patient: p.fullName });
    this.state.emit("alerts", "notifications", "audit");
    return settle(undefined, 260);
  }

  async listNotes(patientId: string) {
    this.requirePatient(patientId);
    return settle(this.state.notes.filter((n) => n.patientId === patientId));
  }

  async addNote(input: { patientId: string; text: string; alertId?: string | null }) {
    this.requirePatient(input.patientId);
    const text = input.text.trim();
    const wording = checkClinicalWording(text);
    if (!text || text.length > 1000) throw new DemoError("Notes must be between 1 and 1000 characters.", "validation_error");
    if (wording) throw new DemoError(wording, "validation_error");
    const note = {
      id: this.state.nextId(NS.note),
      patientId: input.patientId,
      author: { id: this.viewer.id, name: this.viewer.fullName, role: this.role },
      text,
      alertId: input.alertId ?? null,
      createdAt: iso(Date.now()),
    };
    this.state.notes.unshift(note);
    this.state.log(this.viewer.id, "clinical_notes.insert", "clinical_notes", note.id, "success", { patient: this.state.patient(input.patientId)?.fullName ?? null });
    this.state.emit("notes", "audit");
    return settle(note, 240);
  }

  async listCarePlans(patientId: string) {
    this.requirePatient(patientId);
    return settle(this.state.carePlans.filter((c) => c.patientId === patientId));
  }

  async addCarePlan(input: Omit<CarePlan, "id" | "author" | "createdAt" | "active">) {
    const p = this.requirePatient(input.patientId);
    if (this.role !== "doctor" || p.doctorId !== this.viewer.id) throw new DemoError("Only the assigned doctor can write the care plan.", "forbidden");
    const wording = checkClinicalWording(input.instructions);
    if (wording) throw new DemoError(wording, "validation_error");
    this.state.carePlans.filter((c) => c.patientId === p.id).forEach((c) => (c.active = false));
    const plan: CarePlan = { ...input, id: this.state.nextId(NS.plan), author: { id: this.viewer.id, name: this.viewer.fullName }, active: true, createdAt: iso(Date.now()) };
    this.state.carePlans.unshift(plan);
    this.state.log(this.viewer.id, "care_plans.insert", "care_plans", plan.id, "success", { patient: p.fullName });
    this.state.emit("plans", "audit");
    return settle(plan, 240);
  }

  async listTasks(filter: TaskFilter) {
    let tasks = this.state.tasks;
    if (filter.scope === "mine") tasks = tasks.filter((t) => t.assignedTo?.id === this.viewer.id);
    if (filter.patientId) {
      this.requirePatient(filter.patientId);
      tasks = tasks.filter((t) => t.patientId === filter.patientId);
    }
    return settle(tasks);
  }

  async updateTask(taskId: string, update: TaskUpdate) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new DemoError("Task not found.", "not_found");
    this.requirePatient(task.patientId);
    const now = Date.now();
    task.status = update.status;
    task.completedAt = update.status === "completed" ? iso(now) : null;
    if (update.status === "delayed") {
      task.delayedUntil = iso(Math.max(now, Date.parse(task.dueAt)) + (update.delayMinutes ?? 30) * MINUTE);
      task.delayReason = update.delayReason?.trim() || null;
    }
    this.state.log(this.viewer.id, "care_tasks.update", "care_tasks", taskId, "success", { status: update.status, patient: task.patientName });
    this.state.emit("tasks", "audit");
    return settle(task as CareTask, 200);
  }

  async listCheckIns(patientId?: string) {
    if (patientId) this.requirePatient(patientId);
    const ids = new Set(this.visible().map((p) => p.id));
    return settle(this.state.checkins.filter((c) => (patientId ? c.patientId === patientId : ids.has(c.patientId))).slice(0, 80));
  }

  async submitCheckIn(input: CheckInInput) {
    const p = this.requirePatient(input.patientId);
    if (input.notes) {
      const wording = checkClinicalWording(input.notes);
      if (wording) throw new DemoError(wording, "validation_error");
    }
    const values = [input.bodyTemperatureC, input.painScore, input.dressingCondition, input.deviceSecure];
    if (values.every((v) => v == null)) throw new DemoError("Record at least one measurement.", "validation_error");
    if (input.bodyTemperatureC != null && (input.bodyTemperatureC < 30 || input.bodyTemperatureC > 45)) {
      throw new DemoError("Body temperature must be between 30 and 45 °C.", "validation_error");
    }
    const now = Date.now();
    const checkin = {
      ...this.state.makeCheckIn(p, now, input.taskId ?? null, seededRandom(now)),
      recordedBy: { id: this.viewer.id, name: this.viewer.fullName },
      bodyTemperatureC: input.bodyTemperatureC ?? null,
      painScore: input.painScore ?? null,
      dressingCondition: input.dressingCondition ?? null,
      deviceSecure: input.deviceSecure ?? null,
      notes: input.notes?.trim() || null,
    };
    this.state.checkins.unshift(checkin);
    if (input.taskId) {
      const task = this.state.tasks.find((t) => t.id === input.taskId && t.patientId === p.id);
      if (task) {
        task.status = "completed";
        task.completedAt = iso(now);
      }
    }
    this.state.log(this.viewer.id, "patient_checkins.insert", "patient_checkins", checkin.id, "success", { patient: p.fullName });
    this.state.emit("checkins", "tasks", "patients", "audit");
    return settle(checkin, 420);
  }

  async listAppointments(from: string, to: string) {
    const ids = new Set(this.visible().map((p) => p.id));
    const f = Date.parse(from);
    const t = Date.parse(to);
    return settle(
      this.state.appointments.filter(
        (a) =>
          (this.role === "admin" || a.clinician.id === this.viewer.id || ids.has(a.patientId)) &&
          Date.parse(a.startsAt) >= f &&
          Date.parse(a.startsAt) < t,
      ),
    );
  }

  async createAppointment(input: AppointmentInput) {
    const p = this.requirePatient(input.patientId);
    const start = Date.parse(input.startsAt);
    const appointment: Appointment = {
      id: this.state.nextId(NS.appointment),
      patientId: p.id,
      patientName: p.fullName,
      clinician: { id: this.viewer.id, name: this.viewer.fullName },
      kind: input.kind,
      status: "scheduled",
      startsAt: iso(start),
      endsAt: iso(start + input.durationMinutes * MINUTE),
      location: input.location?.trim() || p.roomLabel,
      notes: input.notes?.trim() || null,
    };
    this.state.appointments.push(appointment);
    this.state.appointments.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    this.state.log(this.viewer.id, "appointments.insert", "appointments", appointment.id, "success", { patient: p.fullName });
    this.state.emit("appointments", "audit");
    return settle(appointment, 260);
  }

  async updateAppointmentStatus(id: string, status: Appointment["status"]) {
    const appointment = this.state.appointments.find((a) => a.id === id);
    if (!appointment) throw new DemoError("Appointment not found.", "not_found");
    this.requirePatient(appointment.patientId);
    appointment.status = status;
    this.state.log(this.viewer.id, "appointments.update", "appointments", id, "success", { status });
    this.state.emit("appointments", "audit");
    return settle(appointment, 200);
  }

  async listNotifications() {
    return settle(this.state.notifications.filter((n) => n.recipientId === this.viewer.id).slice(0, 60));
  }

  async markNotificationsRead(ids: string[]) {
    const now = iso(Date.now());
    this.state.notifications.forEach((n) => {
      if (n.recipientId === this.viewer.id && ids.includes(n.id)) n.readAt ??= now;
    });
    this.state.emit("notifications");
    return settle(undefined, 80);
  }

  async listConversations() {
    const peers = new Map<string, { last: DemoState["messages"][number] | null; unread: number }>();
    for (const m of this.state.messages) {
      if (m.senderId !== this.viewer.id && m.recipientId !== this.viewer.id) continue;
      const peer = m.senderId === this.viewer.id ? m.recipientId : m.senderId;
      const entry = peers.get(peer) ?? { last: null, unread: 0 };
      entry.last = m;
      if (m.recipientId === this.viewer.id && !m.readAt) entry.unread++;
      peers.set(peer, entry);
    }
    const colleagues = this.state.staff.filter((s) => s.id !== this.viewer.id && s.status === "active");
    const conversations = colleagues.map((s) => ({
      peer: { id: s.id, name: s.fullName, role: s.role, title: s.title },
      lastMessage: peers.get(s.id)?.last ?? null,
      unreadCount: peers.get(s.id)?.unread ?? 0,
    }));
    conversations.sort((a, b) => Date.parse(b.lastMessage?.createdAt ?? "1970") - Date.parse(a.lastMessage?.createdAt ?? "1970"));
    return settle(conversations);
  }

  async listMessages(peerId: string) {
    const now = iso(Date.now());
    const thread = this.state.messages.filter(
      (m) => (m.senderId === this.viewer.id && m.recipientId === peerId) || (m.senderId === peerId && m.recipientId === this.viewer.id),
    );
    let changed = false;
    thread.forEach((m) => {
      if (m.recipientId === this.viewer.id && !m.readAt) {
        m.readAt = now;
        changed = true;
      }
    });
    if (changed) this.state.emit("messages");
    return settle(thread, 100);
  }

  async sendMessage(peerId: string, body: string, patientId: string | null = null) {
    const text = body.trim();
    if (!text || text.length > 2000) throw new DemoError("Messages must be between 1 and 2000 characters.", "validation_error");
    if (!this.state.staffById(peerId)) throw new DemoError("Recipient not found.", "not_found");
    const message = { id: this.state.nextId(NS.message), senderId: this.viewer.id, recipientId: peerId, patientId, body: text, readAt: null, createdAt: iso(Date.now()) };
    this.state.messages.push(message);
    this.state.notify(peerId, "message", `Message from ${this.viewer.fullName}`, text.slice(0, 90), patientId, "messages", message.id);
    this.state.emit("messages");
    return settle(message, 160);
  }

  async listReports() {
    return settle(this.state.reports.filter((r) => this.role === "admin" || r.createdBy.id === this.viewer.id));
  }

  async requestReport(input: ReportRequest) {
    if (input.patientId) this.requirePatient(input.patientId);
    else if (this.role !== "admin" && ["audit_export", "device_health", "facility_activity"].includes(input.reportType)) {
      throw new DemoError("This report is available to administrators.", "forbidden");
    }
    const p = input.patientId ? this.state.patient(input.patientId) : null;
    const report = {
      id: this.state.nextId(NS.report),
      reportType: input.reportType,
      format: input.format,
      status: "queued" as const,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      patient: p ? { id: p.id, name: p.fullName } : null,
      createdBy: { id: this.viewer.id, name: this.viewer.fullName },
      createdAt: iso(Date.now()),
      completedAt: null,
    };
    this.state.reports.unshift(report);
    this.state.log(this.viewer.id, "reports.insert", "reports", report.id, "success", { type: input.reportType, format: input.format });
    this.state.emit("reports", "audit");
    setTimeout(() => {
      const stored = this.state.reports.find((r) => r.id === report.id);
      if (!stored) return;
      stored.status = "ready";
      stored.completedAt = iso(Date.now());
      this.state.notify(this.viewer.id, "system", "Report ready", `${input.reportType.replace(/_/g, " ")} · ${input.format.toUpperCase()}`, input.patientId ?? null, "reports", report.id);
      this.state.emit("reports", "notifications");
    }, 2_400);
    return settle(report, 240);
  }

  async listStaff(role?: StaffRole) {
    if (this.role !== "admin") {
      return settle(this.state.staffMembers().filter((s) => s.status === "active" && (!role || s.role === role)));
    }
    return settle(this.state.staffMembers().filter((s) => !role || s.role === role));
  }

  async setStaffStatus(profileId: string, status: StaffStatus) {
    this.requireAdmin();
    if (profileId === this.viewer.id) throw new DemoError("You cannot change your own account status.", "forbidden");
    const s = this.state.staff.find((x) => x.id === profileId);
    if (!s) throw new DemoError("Staff member not found.", "not_found");
    s.status = status;
    this.state.log(this.viewer.id, status === "suspended" ? "staff_profiles.suspend" : "staff_profiles.reactivate", "staff_profiles", profileId, "success", { name: s.fullName });
    this.state.emit("staff", "audit");
    return settle(this.state.staffMembers().find((m) => m.id === profileId)!, 220);
  }

  async listDevices() {
    if (this.role === "admin") return settle(this.state.devices());
    const ids = new Set(this.visible().map((p) => p.id));
    return settle(this.state.devices().filter((d) => d.patient && ids.has(d.patient.id)));
  }

  async assignDevice(deviceId: string, patientId: string) {
    this.requireAdmin();
    if (!this.state.patient(patientId)) throw new DemoError("Patient not found.", "not_found");
    const device = this.state.devices().find((d) => d.id === deviceId);
    if (!device) throw new DemoError("Device not found.", "not_found");
    if (device.patient) throw new DemoError(`${device.serial} is already paired.`, "conflict");
    this.state.spareAssignments.set(deviceId, patientId);
    this.state.log(this.viewer.id, "devices.assign", "devices", deviceId, "success", { serial: device.serial });
    this.state.emit("devices", "audit");
    return settle(this.state.devices().find((d) => d.id === deviceId)!, 260);
  }

  async listFacilities() {
    return settle(this.state.facilities());
  }

  async listAccessRequests() {
    this.requireAdmin();
    return settle(this.state.accessRequests);
  }

  async reviewAccessRequest(id: string, decision: "approved" | "rejected", note?: string) {
    this.requireAdmin();
    const request = this.state.accessRequests.find((r) => r.id === id);
    if (!request) throw new DemoError("Request not found.", "not_found");
    if (request.status !== "pending") throw new DemoError("This request has already been reviewed.", "conflict");
    request.status = decision;
    request.reviewedAt = iso(Date.now());
    request.reviewedBy = { id: this.viewer.id, name: this.viewer.fullName };
    request.reviewNote = note?.trim() || null;
    this.state.notifications.filter((n) => n.entityId === id).forEach((n) => (n.readAt ??= iso(Date.now())));
    this.state.log(this.viewer.id, `access_requests.${decision === "approved" ? "approve" : "reject"}`, "access_requests", id, "success", { requester: request.requester.name, role: request.requestedRole });
    if (decision === "approved") {
      this.state.log(this.viewer.id, "profiles.role_change", "profiles", request.requester.id, "success", { role: request.requestedRole });
    }
    this.state.emit("approvals", "audit", "notifications");
    return settle(request, 320);
  }

  async listAuditLogs(filter: AuditFilter = {}) {
    this.requireAdmin();
    const since = filter.since ? Date.parse(filter.since) : 0;
    return settle(this.state.audit.filter((a) => Date.parse(a.createdAt) >= since).slice(0, filter.limit ?? 500));
  }

  async listAlertRules() {
    return settle([
      {
        id: SEED_IDS.rule,
        scope: "global" as const,
        targetLabel: null,
        enabled: true,
        updatedAt: this.state.ruleUpdatedAt,
        ...this.state.thresholds,
      },
    ]);
  }

  async updateGlobalThresholds(thresholds: AlertThresholds) {
    this.requireAdmin();
    if (thresholds.temperatureDelta < 0.1 || thresholds.temperatureDelta > 20) throw new DemoError("Temperature change must be between 0.1 and 20 °C.", "validation_error");
    if (thresholds.humidity < 0 || thresholds.humidity > 100) throw new DemoError("Humidity must be between 0 and 100%.", "validation_error");
    if (thresholds.moisture < 0 || thresholds.moisture > 4095) throw new DemoError("Moisture must be between 0 and 4095.", "validation_error");
    this.state.thresholds = { ...thresholds };
    this.state.ruleUpdatedAt = iso(Date.now());
    this.state.log(this.viewer.id, "alert_rules.update", "alert_rules", SEED_IDS.rule, "success", {
      temperature_delta_threshold: thresholds.temperatureDelta,
      humidity_threshold: thresholds.humidity,
      moisture_threshold: thresholds.moisture,
    });
    this.state.emit("rules", "audit");
    return (await this.listAlertRules())[0];
  }

  async getOverviewCounts() {
    return settle(this.state.overview(), 120);
  }

  /** Simulated services, except the Lambda API, which is pinged for real when configured. */
  async getSystemHealth() {
    this.requireAdmin();
    const [health, apiLatency] = await Promise.all([settle(this.state.health(), 160), env.apiBaseUrl ? pingApi() : Promise.resolve(null)]);
    if (!env.apiBaseUrl) return health;
    health.services = health.services.map((s) =>
      s.id !== "api"
        ? s
        : {
            ...s,
            status: apiLatency == null ? "down" : "operational",
            latencyMs: apiLatency,
            detail: apiLatency == null ? "Deployed function URL did not answer GET /health" : "Live · GET /health on the deployed function URL",
            history: apiLatency == null ? s.history : [...s.history.slice(1), apiLatency],
          },
    );
    return health;
  }

  async getAnalytics(days: number) {
    return settle(this.state.analytics(days), 220);
  }
}
