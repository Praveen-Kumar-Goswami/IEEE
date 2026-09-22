import type { AlertDraft, AlertRule, AlertType, RuleScope, Severity } from "../domain/alerts.js";
import type { Actor, Role } from "../domain/authz.js";
import type { NormalizedReading, StoredOutcome } from "../domain/sync.js";

export type SessionStatus = "active" | "paused" | "completed";
export type LinkStatus = NormalizedReading["deviceStatus"];

export type DeviceRecord = {
  id: string;
  serialNumber: string;
  deviceName: string;
  patientId: string | null;
  firmwareVersion: string | null;
  pairingStatus: "unpaired" | "paired" | "disconnected";
  lastSeenAt: string | null;
};

export type SessionRecord = {
  id: string;
  patientId: string;
  deviceId: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  simulatedWoundLabel: string | null;
  notes: string | null;
};

export type ReadingRecord = NormalizedReading & {
  id: string;
  sessionId: string;
  deviceId: string;
  receivedAt: string;
};

export type AlertRecord = {
  id: string;
  patientId: string;
  deviceId: string | null;
  sessionId: string | null;
  readingId: string | null;
  alertRuleId: string | null;
  alertType: AlertType;
  severity: Severity;
  status: "open" | "acknowledged" | "resolved";
  message: string;
  dedupeKey: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type NoteRecord = {
  id: string;
  patientId: string;
  authorId: string;
  sessionId: string | null;
  alertId: string | null;
  noteText: string;
  createdAt: string;
};

export type PatientCard = {
  id: string;
  fullName: string;
  monitoringStatus: "normal" | "watch" | "attention" | "offline";
  openAlertCount: number;
};

export interface Database {
  getActor(userId: string): Promise<Actor | null>;
  getDevice(id: string): Promise<DeviceRecord | null>;
  getDeviceBySerial(serial: string): Promise<DeviceRecord | null>;
  getSession(id: string): Promise<SessionRecord | null>;
  getOpenSession(patientId: string): Promise<SessionRecord | null>;
  createSession(input: {
    id: string;
    patientId: string;
    deviceId: string;
    startedAt: string;
    simulatedWoundLabel: string | null;
    notes: string | null;
  }): Promise<SessionRecord>;
  endSession(id: string, endedAt: string): Promise<SessionRecord | "missing" | "already_completed">;
  insertReadings(rows: Array<Omit<ReadingRecord, "id">>): Promise<StoredOutcome[]>;
  listSessionReadings(sessionId: string): Promise<ReadingRecord[]>;
  listRecentReadings(patientId: string, limit: number): Promise<ReadingRecord[]>;
  listEnabledRules(patientId: string, deviceId: string): Promise<AlertRule[]>;
  listActiveAlertKeys(patientId: string): Promise<string[]>;
  insertAlert(draft: AlertDraft): Promise<boolean>;
  getAlert(id: string): Promise<AlertRecord | null>;
  acknowledgeAlert(id: string, actorId: string, at: string): Promise<AlertRecord | "missing" | "resolved">;
  createNote(input: {
    patientId: string;
    authorId: string;
    sessionId: string | null;
    alertId: string | null;
    noteText: string;
  }): Promise<NoteRecord>;
  listNotes(patientId: string): Promise<NoteRecord[]>;
  listSessions(patientId: string): Promise<SessionRecord[]>;
  listAlerts(patientId: string): Promise<AlertRecord[]>;
  assignDevice(deviceId: string, patientId: string): Promise<DeviceRecord | null>;
  createAssignment(input: {
    clinicianId: string;
    patientId: string;
    assignmentRole: "doctor" | "nurse";
  }): Promise<{ id: string; clinicianId: string; patientId: string; assignmentRole: "doctor" | "nurse"; active: boolean }>;
  hasAssignment(clinicianId: string, patientId: string): Promise<boolean>;
  setRole(actorId: string, profileId: string, role: Role): Promise<void>;
  createAlertRule(input: {
    scope: RuleScope;
    patientId: string | null;
    deviceId: string | null;
    temperatureDeltaThreshold: number | null;
    humidityThreshold: number | null;
    moistureThreshold: number | null;
    enabled: boolean;
    configuredBy: string;
  }): Promise<AlertRule>;
  listPatients(clinicianId: string | null): Promise<PatientCard[]>;
  getMonitoringStatus(patientId: string): Promise<PatientCard["monitoringStatus"]>;
  setMonitoringStatus(patientId: string, status: PatientCard["monitoringStatus"]): Promise<void>;
  writeAudit(entry: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, string | number | boolean | null>;
  }): Promise<void>;
  writeDeviceEvent(deviceId: string, eventType: string, payload: Record<string, string | number | boolean | null>): Promise<void>;
}
