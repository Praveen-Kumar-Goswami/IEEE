import { randomUUID } from "node:crypto";
import type { AlertDraft, AlertRule } from "../domain/alerts.js";
import type { Actor, Role } from "../domain/authz.js";
import type { StoredOutcome } from "../domain/sync.js";
import { ApiError } from "../errors.js";
import type {
  AlertRecord,
  Database,
  DeviceRecord,
  NoteRecord,
  PatientCard,
  ReadingRecord,
  SessionRecord,
} from "./database.js";

type Profile = Actor & {
  monitoringStatus: PatientCard["monitoringStatus"];
};

export class MemoryDatabase implements Database {
  profiles = new Map<string, Profile>();
  devices: DeviceRecord[] = [];
  sessions = new Map<string, SessionRecord>();
  readings: ReadingRecord[] = [];
  alerts: AlertRecord[] = [];
  rules: AlertRule[] = [];
  notes: NoteRecord[] = [];
  assignments: Array<{
    id: string;
    clinicianId: string;
    patientId: string;
    assignmentRole: "doctor" | "nurse";
    active: boolean;
  }> = [];
  audits: Array<Record<string, unknown>> = [];

  async getActor(userId: string): Promise<Actor | null> {
    const profile = this.profiles.get(userId);
    if (!profile) return null;
    return { id: profile.id, role: profile.role, fullName: profile.fullName };
  }

  async getDevice(id: string): Promise<DeviceRecord | null> {
    return this.devices.find((device) => device.id === id) ?? null;
  }

  async getDeviceBySerial(serial: string): Promise<DeviceRecord | null> {
    return this.devices.find((device) => device.serialNumber.toLowerCase() === serial.toLowerCase()) ?? null;
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return this.sessions.get(id) ?? null;
  }

  async getOpenSession(patientId: string): Promise<SessionRecord | null> {
    return (
      [...this.sessions.values()].find(
        (session) => session.patientId === patientId && session.status !== "completed",
      ) ?? null
    );
  }

  async createSession(input: {
    id: string;
    patientId: string;
    deviceId: string;
    startedAt: string;
    simulatedWoundLabel: string | null;
    notes: string | null;
  }): Promise<SessionRecord> {
    const existing = this.sessions.get(input.id);
    if (existing) return existing;
    const open = await this.getOpenSession(input.patientId);
    if (open) throw new ApiError(409, "conflict", "An open monitoring session already exists.");
    const device = await this.getDevice(input.deviceId);
    if (!device || device.patientId !== input.patientId) {
      throw new ApiError(400, "validation_error", "The device is not assigned to this patient.");
    }
    const session: SessionRecord = {
      id: input.id,
      patientId: input.patientId,
      deviceId: input.deviceId,
      startedAt: input.startedAt,
      endedAt: null,
      status: "active",
      simulatedWoundLabel: input.simulatedWoundLabel,
      notes: input.notes,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async endSession(id: string, endedAt: string): Promise<SessionRecord | "missing" | "already_completed"> {
    const session = this.sessions.get(id);
    if (!session) return "missing";
    if (session.status === "completed") return "already_completed";
    session.status = "completed";
    session.endedAt = endedAt;
    return session;
  }

  async insertReadings(rows: Array<Omit<ReadingRecord, "id">>): Promise<StoredOutcome[]> {
    return rows.map((row) => {
      const duplicate = this.readings.find(
        (existing) => existing.deviceId === row.deviceId && existing.clientReadingId === row.clientReadingId,
      );
      if (duplicate) return { id: row.clientReadingId, outcome: "skipped", reason: null };
      const stored: ReadingRecord = { ...row, id: randomUUID() };
      this.readings.push(stored);
      const device = this.devices.find((item) => item.id === row.deviceId);
      if (device) device.lastSeenAt = row.receivedAt;
      return { id: row.clientReadingId, outcome: "uploaded", reason: null, serverId: stored.id };
    });
  }

  async listSessionReadings(sessionId: string): Promise<ReadingRecord[]> {
    return this.readings
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }

  async listRecentReadings(patientId: string, limit: number): Promise<ReadingRecord[]> {
    const sessionIds = new Set(
      [...this.sessions.values()].filter((session) => session.patientId === patientId).map((session) => session.id),
    );
    return this.readings
      .filter((row) => sessionIds.has(row.sessionId))
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .slice(0, limit);
  }

  async listEnabledRules(patientId: string, deviceId: string): Promise<AlertRule[]> {
    return this.rules.filter(
      (rule) =>
        rule.enabled &&
        (rule.scope === "global" ||
          (rule.scope === "patient" && rule.patientId === patientId) ||
          (rule.scope === "device" && rule.deviceId === deviceId)),
    );
  }

  async listActiveAlertKeys(patientId: string): Promise<string[]> {
    return this.alerts
      .filter((alert) => alert.patientId === patientId && alert.status !== "resolved")
      .map((alert) => alert.dedupeKey);
  }

  async insertAlert(draft: AlertDraft): Promise<boolean> {
    const exists = this.alerts.some(
      (alert) =>
        alert.patientId === draft.patientId &&
        alert.dedupeKey === draft.dedupeKey &&
        alert.status !== "resolved",
    );
    if (exists) return false;
    this.alerts.push({
      id: randomUUID(),
      patientId: draft.patientId,
      deviceId: draft.deviceId,
      sessionId: draft.sessionId,
      readingId: draft.readingId,
      alertRuleId: draft.alertRuleId,
      alertType: draft.alertType,
      severity: draft.severity,
      status: "open",
      message: draft.message,
      dedupeKey: draft.dedupeKey,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  async getAlert(id: string): Promise<AlertRecord | null> {
    return this.alerts.find((alert) => alert.id === id) ?? null;
  }

  async acknowledgeAlert(id: string, actorId: string, at: string): Promise<AlertRecord | "missing" | "resolved"> {
    const alert = await this.getAlert(id);
    if (!alert) return "missing";
    if (alert.status === "resolved") return "resolved";
    if (alert.status === "acknowledged") return alert;
    alert.status = "acknowledged";
    alert.acknowledgedBy = actorId;
    alert.acknowledgedAt = at;
    return alert;
  }

  async createNote(input: {
    patientId: string;
    authorId: string;
    sessionId: string | null;
    alertId: string | null;
    noteText: string;
  }): Promise<NoteRecord> {
    if (/infection detected/i.test(input.noteText) || /diagnosed/i.test(input.noteText)) {
      throw new ApiError(400, "validation_error", "Notes cannot claim a diagnosis.");
    }
    const note: NoteRecord = { id: randomUUID(), createdAt: new Date().toISOString(), ...input };
    this.notes.push(note);
    return note;
  }

  async listNotes(patientId: string): Promise<NoteRecord[]> {
    return this.notes.filter((note) => note.patientId === patientId);
  }

  async listSessions(patientId: string): Promise<SessionRecord[]> {
    return [...this.sessions.values()].filter((session) => session.patientId === patientId);
  }

  async listAlerts(patientId: string): Promise<AlertRecord[]> {
    return this.alerts.filter((alert) => alert.patientId === patientId);
  }

  async assignDevice(deviceId: string, patientId: string): Promise<DeviceRecord | null> {
    const patient = this.profiles.get(patientId);
    if (!patient || patient.role !== "patient") {
      throw new ApiError(400, "validation_error", "Devices can only be assigned to a patient.");
    }
    const device = this.devices.find((item) => item.id === deviceId);
    if (!device) return null;
    device.patientId = patientId;
    device.pairingStatus = "paired";
    return device;
  }

  async createAssignment(input: {
    clinicianId: string;
    patientId: string;
    assignmentRole: "doctor" | "nurse";
  }) {
    const clinician = this.profiles.get(input.clinicianId);
    const patient = this.profiles.get(input.patientId);
    if (!patient || patient.role !== "patient") {
      throw new ApiError(400, "validation_error", "Assignments require a patient.");
    }
    if (!clinician || clinician.role !== input.assignmentRole) {
      throw new ApiError(400, "validation_error", "Assignment role must match the clinician profile.");
    }
    if (
      this.assignments.some(
        (row) => row.active && row.clinicianId === input.clinicianId && row.patientId === input.patientId,
      )
    ) {
      throw new ApiError(409, "conflict", "That assignment already exists.");
    }
    const row = { id: randomUUID(), active: true, ...input };
    this.assignments.push(row);
    return row;
  }

  async hasAssignment(clinicianId: string, patientId: string): Promise<boolean> {
    return this.assignments.some(
      (row) => row.active && row.clinicianId === clinicianId && row.patientId === patientId,
    );
  }

  async setRole(actorId: string, profileId: string, role: Role): Promise<void> {
    if (actorId === profileId) {
      throw new ApiError(403, "forbidden", "Administrators cannot change their own role.");
    }
    const actor = this.profiles.get(actorId);
    if (!actor || actor.role !== "admin") {
      throw new ApiError(403, "forbidden", "Only an administrator can change roles.");
    }
    const profile = this.profiles.get(profileId);
    if (!profile) throw new ApiError(404, "not_found", "Profile not found.");
    profile.role = role;
  }

  async createAlertRule(input: {
    scope: AlertRule["scope"];
    patientId: string | null;
    deviceId: string | null;
    temperatureDeltaThreshold: number | null;
    humidityThreshold: number | null;
    moistureThreshold: number | null;
    enabled: boolean;
    configuredBy: string;
  }): Promise<AlertRule> {
    void input.configuredBy;
    const rule: AlertRule = {
      id: randomUUID(),
      scope: input.scope,
      patientId: input.patientId,
      deviceId: input.deviceId,
      temperatureDeltaThreshold: input.temperatureDeltaThreshold,
      humidityThreshold: input.humidityThreshold,
      moistureThreshold: input.moistureThreshold,
      enabled: input.enabled,
    };
    this.rules.push(rule);
    return rule;
  }

  async listPatients(clinicianId: string | null): Promise<PatientCard[]> {
    const patients = [...this.profiles.values()].filter((profile) => {
      if (profile.role !== "patient") return false;
      if (!clinicianId) return true;
      return this.assignments.some(
        (row) => row.active && row.clinicianId === clinicianId && row.patientId === profile.id,
      );
    });
    return patients.map((profile) => ({
      id: profile.id,
      fullName: profile.fullName,
      monitoringStatus: profile.monitoringStatus,
      openAlertCount: this.alerts.filter((alert) => alert.patientId === profile.id && alert.status === "open").length,
    }));
  }

  async getMonitoringStatus(patientId: string): Promise<PatientCard["monitoringStatus"]> {
    return this.profiles.get(patientId)?.monitoringStatus ?? "normal";
  }

  async setMonitoringStatus(patientId: string, status: PatientCard["monitoringStatus"]): Promise<void> {
    const profile = this.profiles.get(patientId);
    if (profile) profile.monitoringStatus = status;
  }

  async writeAudit(entry: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    this.audits.push(entry);
  }

  async writeDeviceEvent(
    deviceId: string,
    eventType: string,
    payload: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    void deviceId;
    void eventType;
    void payload;
  }
}
