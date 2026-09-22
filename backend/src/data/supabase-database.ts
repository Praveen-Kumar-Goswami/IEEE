import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertDraft, AlertRule, AlertType, RuleScope, Severity } from "../domain/alerts.js";
import type { Actor, Role } from "../domain/authz.js";
import type { StoredOutcome } from "../domain/sync.js";
import { ApiError } from "../errors.js";
import type {
  AlertRecord,
  Database,
  DeviceRecord,
  LinkStatus,
  NoteRecord,
  PatientCard,
  ReadingRecord,
  SessionRecord,
  SessionStatus,
} from "./database.js";

type DbError = { code?: string; message?: string };

function raise(error: DbError): never {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "42501" || /own role|only an administrator/i.test(message)) {
    throw new ApiError(403, "forbidden", "You do not have access to this resource.");
  }
  if (/not found/i.test(message)) throw new ApiError(404, "not_found", "The requested record was not found.");
  if (code === "23505" || code === "23P01") {
    throw new ApiError(409, "conflict", "The request conflicts with existing data.");
  }
  if (code === "23514" || code === "23503" || code === "22023" || code === "P0001") {
    throw new ApiError(400, "validation_error", "The request could not be stored.");
  }
  throw new ApiError(500, "internal_error", "The request could not be completed.");
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeReason(reason: string | null): string | null {
  if (!reason) return null;
  if (/check constraint|out of range|violates|captured_at|session/i.test(reason) && reason.length < 160) {
    return reason;
  }
  return "reading was rejected";
}

type DeviceRow = {
  id: string;
  serial_number: string;
  device_name: string;
  patient_id: string | null;
  firmware_version: string | null;
  pairing_status: DeviceRecord["pairingStatus"];
  last_seen_at: string | null;
};

function toDevice(row: DeviceRow): DeviceRecord {
  return {
    id: row.id,
    serialNumber: row.serial_number,
    deviceName: row.device_name,
    patientId: row.patient_id,
    firmwareVersion: row.firmware_version,
    pairingStatus: row.pairing_status,
    lastSeenAt: row.last_seen_at,
  };
}

type SessionRow = {
  id: string;
  patient_id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
  simulated_wound_label: string | null;
  notes: string | null;
};

function toSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    deviceId: row.device_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
    simulatedWoundLabel: row.simulated_wound_label,
    notes: row.notes,
  };
}

type ReadingRow = {
  id: string;
  session_id: string;
  device_id: string;
  sequence_number: number | null;
  captured_at: string;
  received_at: string;
  localized_temperature_c: unknown;
  ambient_temperature_c: unknown;
  humidity_percent: unknown;
  relative_moisture_value: number | null;
  battery_percent: unknown;
  device_status: LinkStatus;
  client_reading_id: string;
};

const readingColumns =
  "id, session_id, device_id, sequence_number, captured_at, received_at, localized_temperature_c, ambient_temperature_c, humidity_percent, relative_moisture_value, battery_percent, device_status, client_reading_id";

function toReading(row: ReadingRow): ReadingRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    deviceId: row.device_id,
    sequenceNumber: row.sequence_number,
    capturedAt: row.captured_at,
    receivedAt: row.received_at,
    localizedTemperatureC: num(row.localized_temperature_c),
    ambientTemperatureC: num(row.ambient_temperature_c),
    humidityPercent: num(row.humidity_percent),
    relativeMoistureValue: row.relative_moisture_value,
    batteryPercent: num(row.battery_percent),
    deviceStatus: row.device_status,
    clientReadingId: row.client_reading_id,
  };
}

type AlertRow = {
  id: string;
  patient_id: string;
  device_id: string | null;
  session_id: string | null;
  reading_id: string | null;
  alert_rule_id: string | null;
  alert_type: AlertType;
  severity: Severity;
  status: AlertRecord["status"];
  message: string;
  dedupe_key: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

const alertColumns =
  "id, patient_id, device_id, session_id, reading_id, alert_rule_id, alert_type, severity, status, message, dedupe_key, acknowledged_by, acknowledged_at, resolved_at, created_at";

function toAlert(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    deviceId: row.device_id,
    sessionId: row.session_id,
    readingId: row.reading_id,
    alertRuleId: row.alert_rule_id,
    alertType: row.alert_type,
    severity: row.severity,
    status: row.status,
    message: row.message,
    dedupeKey: row.dedupe_key,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

type RuleRow = {
  id: string;
  scope: RuleScope;
  patient_id: string | null;
  device_id: string | null;
  temperature_delta_threshold: unknown;
  humidity_threshold: unknown;
  moisture_threshold: number | null;
  enabled: boolean;
};

function toRule(row: RuleRow): AlertRule {
  return {
    id: row.id,
    scope: row.scope,
    patientId: row.patient_id,
    deviceId: row.device_id,
    temperatureDeltaThreshold: num(row.temperature_delta_threshold),
    humidityThreshold: num(row.humidity_threshold),
    moistureThreshold: row.moisture_threshold,
    enabled: row.enabled,
  };
}

export class SupabaseDatabase implements Database {
  constructor(private readonly client: SupabaseClient) {}

  async getActor(userId: string): Promise<Actor | null> {
    const result = await this.client.from("profiles").select("id, role, full_name").eq("id", userId).maybeSingle();
    if (result.error) raise(result.error);
    const row = result.data as { id: string; role: Role; full_name: string } | null;
    if (!row) return null;
    return { id: row.id, role: row.role, fullName: row.full_name };
  }

  async getDevice(id: string): Promise<DeviceRecord | null> {
    const result = await this.client
      .from("devices")
      .select("id, serial_number, device_name, patient_id, firmware_version, pairing_status, last_seen_at")
      .eq("id", id)
      .maybeSingle();
    if (result.error) raise(result.error);
    return result.data ? toDevice(result.data as DeviceRow) : null;
  }

  async getDeviceBySerial(serial: string): Promise<DeviceRecord | null> {
    const result = await this.client
      .from("devices")
      .select("id, serial_number, device_name, patient_id, firmware_version, pairing_status, last_seen_at")
      .ilike("serial_number", serial)
      .maybeSingle();
    if (result.error) raise(result.error);
    return result.data ? toDevice(result.data as DeviceRow) : null;
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const result = await this.client.from("monitoring_sessions").select("*").eq("id", id).maybeSingle();
    if (result.error) raise(result.error);
    return result.data ? toSession(result.data as SessionRow) : null;
  }

  async getOpenSession(patientId: string): Promise<SessionRecord | null> {
    const result = await this.client
      .from("monitoring_sessions")
      .select("*")
      .eq("patient_id", patientId)
      .in("status", ["active", "paused"])
      .maybeSingle();
    if (result.error) raise(result.error);
    return result.data ? toSession(result.data as SessionRow) : null;
  }

  async createSession(input: {
    id: string;
    patientId: string;
    deviceId: string;
    startedAt: string;
    simulatedWoundLabel: string | null;
    notes: string | null;
  }): Promise<SessionRecord> {
    const existing = await this.getSession(input.id);
    if (existing) return existing;
    const result = await this.client
      .from("monitoring_sessions")
      .insert({
        id: input.id,
        patient_id: input.patientId,
        device_id: input.deviceId,
        started_at: input.startedAt,
        status: "active",
        simulated_wound_label: input.simulatedWoundLabel,
        notes: input.notes,
      })
      .select("*")
      .single();
    if (result.error) raise(result.error);
    return toSession(result.data as SessionRow);
  }

  async endSession(id: string, endedAt: string): Promise<SessionRecord | "missing" | "already_completed"> {
    const current = await this.getSession(id);
    if (!current) return "missing";
    if (current.status === "completed") return "already_completed";
    const result = await this.client
      .from("monitoring_sessions")
      .update({ status: "completed", ended_at: endedAt })
      .eq("id", id)
      .in("status", ["active", "paused"])
      .select("*")
      .maybeSingle();
    if (result.error) raise(result.error);
    return result.data ? toSession(result.data as SessionRow) : "already_completed";
  }

  async insertReadings(rows: Array<Omit<ReadingRecord, "id">>): Promise<StoredOutcome[]> {
    if (rows.length === 0) return [];
    const payload = rows.map((row) => ({
      session_id: row.sessionId,
      device_id: row.deviceId,
      sequence_number: row.sequenceNumber,
      captured_at: row.capturedAt,
      localized_temperature_c: row.localizedTemperatureC,
      ambient_temperature_c: row.ambientTemperatureC,
      humidity_percent: row.humidityPercent,
      relative_moisture_value: row.relativeMoistureValue,
      battery_percent: row.batteryPercent,
      device_status: row.deviceStatus,
      client_reading_id: row.clientReadingId,
    }));
    const result = await this.client.rpc("sync_sensor_readings", { p_readings: payload });
    if (result.error) raise(result.error);
    const returned = (result.data ?? []) as Array<{ client_reading_id: string | null; outcome: string; reason: string | null }>;
    const uploadedIds = returned.filter((row) => row.outcome === "uploaded" && row.client_reading_id).map((row) => row.client_reading_id as string);
    const serverIds = new Map<string, string>();
    if (uploadedIds.length > 0) {
      const lookup = await this.client.from("sensor_readings").select("id, client_reading_id").in("client_reading_id", uploadedIds);
      if (lookup.error) raise(lookup.error);
      for (const row of (lookup.data ?? []) as Array<{ id: string; client_reading_id: string }>) {
        serverIds.set(row.client_reading_id, row.id);
      }
    }
    return rows.map((row, index) => {
      const match = returned[index];
      const outcome = match?.outcome === "uploaded" || match?.outcome === "skipped" ? match.outcome : "failed";
      return {
        id: match?.client_reading_id || row.clientReadingId,
        outcome,
        reason: safeReason(match?.reason ?? null),
        serverId: serverIds.get(row.clientReadingId),
      };
    });
  }

  async listSessionReadings(sessionId: string): Promise<ReadingRecord[]> {
    const result = await this.client
      .from("sensor_readings")
      .select(readingColumns)
      .eq("session_id", sessionId)
      .order("captured_at", { ascending: true });
    if (result.error) raise(result.error);
    return ((result.data ?? []) as ReadingRow[]).map(toReading);
  }

  async listRecentReadings(patientId: string, limit: number): Promise<ReadingRecord[]> {
    const sessions = await this.client.from("monitoring_sessions").select("id").eq("patient_id", patientId);
    if (sessions.error) raise(sessions.error);
    const ids = ((sessions.data ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (ids.length === 0) return [];
    const result = await this.client
      .from("sensor_readings")
      .select(readingColumns)
      .in("session_id", ids)
      .order("captured_at", { ascending: false })
      .limit(limit);
    if (result.error) raise(result.error);
    return ((result.data ?? []) as ReadingRow[]).map(toReading);
  }

  async listEnabledRules(patientId: string, deviceId: string): Promise<AlertRule[]> {
    const result = await this.client
      .from("alert_rules")
      .select("id, scope, patient_id, device_id, temperature_delta_threshold, humidity_threshold, moisture_threshold, enabled")
      .eq("enabled", true)
      .or(`scope.eq.global,and(scope.eq.patient,patient_id.eq.${patientId}),and(scope.eq.device,device_id.eq.${deviceId})`);
    if (result.error) raise(result.error);
    return ((result.data ?? []) as RuleRow[]).map(toRule);
  }

  async listActiveAlertKeys(patientId: string): Promise<string[]> {
    const result = await this.client
      .from("indicator_alerts")
      .select("dedupe_key")
      .eq("patient_id", patientId)
      .in("status", ["open", "acknowledged"]);
    if (result.error) raise(result.error);
    return ((result.data ?? []) as Array<{ dedupe_key: string }>).map((row) => row.dedupe_key);
  }

  async insertAlert(draft: AlertDraft): Promise<boolean> {
    const result = await this.client.from("indicator_alerts").insert({
      patient_id: draft.patientId,
      device_id: draft.deviceId,
      session_id: draft.sessionId,
      reading_id: draft.readingId,
      alert_rule_id: draft.alertRuleId,
      alert_type: draft.alertType,
      severity: draft.severity,
      status: "open",
      message: draft.message,
      dedupe_key: draft.dedupeKey,
    });
    if (result.error) {
      if (result.error.code === "23505") return false;
      raise(result.error);
    }
    return true;
  }

  async getAlert(id: string): Promise<AlertRecord | null> {
    const result = await this.client.from("indicator_alerts").select(alertColumns).eq("id", id).maybeSingle();
    if (result.error) raise(result.error);
    return result.data ? toAlert(result.data as AlertRow) : null;
  }

  async acknowledgeAlert(id: string, actorId: string, at: string): Promise<AlertRecord | "missing" | "resolved"> {
    const result = await this.client
      .from("indicator_alerts")
      .update({ status: "acknowledged", acknowledged_by: actorId, acknowledged_at: at })
      .eq("id", id)
      .eq("status", "open")
      .select(alertColumns)
      .maybeSingle();
    if (result.error) raise(result.error);
    if (result.data) return toAlert(result.data as AlertRow);
    const current = await this.getAlert(id);
    if (!current) return "missing";
    if (current.status === "resolved") return "resolved";
    return current;
  }

  async createNote(input: {
    patientId: string;
    authorId: string;
    sessionId: string | null;
    alertId: string | null;
    noteText: string;
  }): Promise<NoteRecord> {
    const result = await this.client
      .from("clinical_notes")
      .insert({
        patient_id: input.patientId,
        author_id: input.authorId,
        session_id: input.sessionId,
        alert_id: input.alertId,
        note_text: input.noteText,
      })
      .select("id, patient_id, author_id, session_id, alert_id, note_text, created_at")
      .single();
    if (result.error) raise(result.error);
    const row = result.data as {
      id: string;
      patient_id: string;
      author_id: string;
      session_id: string | null;
      alert_id: string | null;
      note_text: string;
      created_at: string;
    };
    return {
      id: row.id,
      patientId: row.patient_id,
      authorId: row.author_id,
      sessionId: row.session_id,
      alertId: row.alert_id,
      noteText: row.note_text,
      createdAt: row.created_at,
    };
  }

  async listNotes(patientId: string): Promise<NoteRecord[]> {
    const result = await this.client
      .from("clinical_notes")
      .select("id, patient_id, author_id, session_id, alert_id, note_text, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (result.error) raise(result.error);
    return ((result.data ?? []) as Array<{
      id: string;
      patient_id: string;
      author_id: string;
      session_id: string | null;
      alert_id: string | null;
      note_text: string;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      authorId: row.author_id,
      sessionId: row.session_id,
      alertId: row.alert_id,
      noteText: row.note_text,
      createdAt: row.created_at,
    }));
  }

  async listSessions(patientId: string): Promise<SessionRecord[]> {
    const result = await this.client
      .from("monitoring_sessions")
      .select("*")
      .eq("patient_id", patientId)
      .order("started_at", { ascending: false });
    if (result.error) raise(result.error);
    return ((result.data ?? []) as SessionRow[]).map(toSession);
  }

  async listAlerts(patientId: string): Promise<AlertRecord[]> {
    const result = await this.client
      .from("indicator_alerts")
      .select(alertColumns)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (result.error) raise(result.error);
    return ((result.data ?? []) as AlertRow[]).map(toAlert);
  }

  async assignDevice(deviceId: string, patientId: string): Promise<DeviceRecord | null> {
    const result = await this.client
      .from("devices")
      .update({ patient_id: patientId, pairing_status: "paired" })
      .eq("id", deviceId)
      .select("id, serial_number, device_name, patient_id, firmware_version, pairing_status, last_seen_at")
      .maybeSingle();
    if (result.error) raise(result.error);
    return result.data ? toDevice(result.data as DeviceRow) : null;
  }

  async createAssignment(input: { clinicianId: string; patientId: string; assignmentRole: "doctor" | "nurse" }) {
    const result = await this.client
      .from("clinician_patient_assignments")
      .insert({
        clinician_id: input.clinicianId,
        patient_id: input.patientId,
        assignment_role: input.assignmentRole,
        active: true,
      })
      .select("id, clinician_id, patient_id, assignment_role, active")
      .single();
    if (result.error) raise(result.error);
    const row = result.data as {
      id: string;
      clinician_id: string;
      patient_id: string;
      assignment_role: "doctor" | "nurse";
      active: boolean;
    };
    return {
      id: row.id,
      clinicianId: row.clinician_id,
      patientId: row.patient_id,
      assignmentRole: row.assignment_role,
      active: row.active,
    };
  }

  async hasAssignment(clinicianId: string, patientId: string): Promise<boolean> {
    const result = await this.client
      .from("clinician_patient_assignments")
      .select("id")
      .eq("clinician_id", clinicianId)
      .eq("patient_id", patientId)
      .eq("active", true)
      .limit(1);
    if (result.error) raise(result.error);
    return (result.data ?? []).length > 0;
  }

  async setRole(actorId: string, profileId: string, role: Role): Promise<void> {
    const result = await this.client.rpc("set_profile_role", {
      p_actor_id: actorId,
      p_profile_id: profileId,
      p_role: role,
    });
    if (result.error) raise(result.error);
  }

  async createAlertRule(input: {
    scope: RuleScope;
    patientId: string | null;
    deviceId: string | null;
    temperatureDeltaThreshold: number | null;
    humidityThreshold: number | null;
    moistureThreshold: number | null;
    enabled: boolean;
    configuredBy: string;
  }): Promise<AlertRule> {
    const result = await this.client
      .from("alert_rules")
      .insert({
        scope: input.scope,
        patient_id: input.patientId,
        device_id: input.deviceId,
        temperature_delta_threshold: input.temperatureDeltaThreshold,
        humidity_threshold: input.humidityThreshold,
        moisture_threshold: input.moistureThreshold,
        enabled: input.enabled,
        configured_by: input.configuredBy,
      })
      .select("id, scope, patient_id, device_id, temperature_delta_threshold, humidity_threshold, moisture_threshold, enabled")
      .single();
    if (result.error) raise(result.error);
    return toRule(result.data as RuleRow);
  }

  async listPatients(clinicianId: string | null): Promise<PatientCard[]> {
    if (!clinicianId) {
      const result = await this.client
        .from("profiles")
        .select("id, full_name, patient_profiles(monitoring_status)")
        .eq("role", "patient");
      if (result.error) raise(result.error);
      const rows = (result.data ?? []) as Array<{ id: string; full_name: string; patient_profiles: unknown }>;
      return this.withOpenCounts(rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        monitoringStatus: statusOf(row.patient_profiles),
        openAlertCount: 0,
      })));
    }
    const result = await this.client
      .from("clinician_patient_assignments")
      .select("patient:profiles!clinician_patient_assignments_patient_id_fkey(id, full_name, patient_profiles(monitoring_status))")
      .eq("clinician_id", clinicianId)
      .eq("active", true);
    if (result.error) raise(result.error);
    const cards = ((result.data ?? []) as Array<{ patient: unknown }>).map((row) => {
      const patient = (Array.isArray(row.patient) ? row.patient[0] : row.patient) as {
        id: string;
        full_name: string;
        patient_profiles: unknown;
      };
      return {
        id: patient.id,
        fullName: patient.full_name,
        monitoringStatus: statusOf(patient.patient_profiles),
        openAlertCount: 0,
      };
    });
    return this.withOpenCounts(cards);
  }

  private async withOpenCounts(cards: PatientCard[]): Promise<PatientCard[]> {
    if (cards.length === 0) return cards;
    const ids = cards.map((card) => card.id);
    const alerts = await this.client.from("indicator_alerts").select("patient_id").in("patient_id", ids).eq("status", "open");
    if (alerts.error) raise(alerts.error);
    const counts = new Map<string, number>();
    for (const row of (alerts.data ?? []) as Array<{ patient_id: string }>) {
      counts.set(row.patient_id, (counts.get(row.patient_id) ?? 0) + 1);
    }
    return cards.map((card) => ({ ...card, openAlertCount: counts.get(card.id) ?? 0 }));
  }

  async getMonitoringStatus(patientId: string): Promise<PatientCard["monitoringStatus"]> {
    const result = await this.client.from("patient_profiles").select("monitoring_status").eq("profile_id", patientId).maybeSingle();
    if (result.error) raise(result.error);
    const status = (result.data as { monitoring_status?: PatientCard["monitoringStatus"] } | null)?.monitoring_status;
    return status ?? "normal";
  }

  async setMonitoringStatus(patientId: string, status: PatientCard["monitoringStatus"]): Promise<void> {
    const result = await this.client.from("patient_profiles").update({ monitoring_status: status }).eq("profile_id", patientId);
    if (result.error) raise(result.error);
  }

  async writeAudit(entry: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    const result = await this.client.from("audit_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata,
    });
    if (result.error) raise(result.error);
  }

  async writeDeviceEvent(
    deviceId: string,
    eventType: string,
    payload: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const result = await this.client.from("device_events").insert({
      device_id: deviceId,
      event_type: eventType,
      event_payload: payload,
    });
    if (result.error) raise(result.error);
  }
}

function statusOf(value: unknown): PatientCard["monitoringStatus"] {
  const row = Array.isArray(value) ? value[0] : value;
  const status = row && typeof row === "object" && "monitoring_status" in row
    ? (row as { monitoring_status: unknown }).monitoring_status
    : null;
  if (status === "normal" || status === "watch" || status === "attention" || status === "offline") return status;
  return "normal";
}
