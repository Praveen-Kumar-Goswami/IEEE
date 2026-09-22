import type { AppContext } from "../context.js";
import { evaluateNewAlerts } from "../domain/alerts.js";
import {
  canAccessPatient,
  canAcknowledge,
  canSync,
  canWriteNote,
  isClinician,
  requireAdmin,
  requireClinicianReader,
} from "../domain/authz.js";
import { DISCLAIMER, LIMITS } from "../domain/limits.js";
import {
  acknowledgeSchema,
  alertRuleSchema,
  assignDeviceSchema,
  assignmentSchema,
  createSessionSchema,
  endSessionSchema,
  noteSchema,
  parseWith,
  roleSchema,
  syncEnvelopeSchema,
} from "../domain/schemas.js";
import { presentStatus, rollupStatus, type LinkStatus } from "../domain/status.js";
import { classifyReadings, mergeOutcomes, type NormalizedReading } from "../domain/sync.js";
import { ApiError } from "../errors.js";
import { json, type HttpRequest, type HttpResponse } from "../http.js";
import { invalid, readJson, reject } from "./shared.js";

async function assigned(ctx: AppContext, patientId: string): Promise<boolean> {
  if (!isClinician(ctx.actor)) return false;
  return ctx.db.hasAssignment(ctx.actor.id, patientId);
}

function assertClock(iso: string, now: Date, label: string): void {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) throw new ApiError(400, "validation_error", `${label} must be an ISO-8601 timestamp.`);
  if (time > now.getTime() + LIMITS.futureSkewMs) {
    throw new ApiError(400, "validation_error", `${label} is too far in the future.`);
  }
  if (time < now.getTime() - LIMITS.offlineWindowMs) {
    throw new ApiError(400, "validation_error", `${label} is outside the offline upload window.`);
  }
}

async function resolveDevice(ctx: AppContext, deviceId?: string, serial?: string) {
  if (deviceId) return ctx.db.getDevice(deviceId);
  if (serial) return ctx.db.getDeviceBySerial(serial);
  return null;
}

export async function syncReadings(ctx: AppContext, request: HttpRequest): Promise<HttpResponse> {
  const envelope = parseWith(syncEnvelopeSchema, readJson(request));
  if (!envelope.ok) invalid(envelope);
  const session = await ctx.db.getSession(envelope.value.session_id);
  if (!session) throw new ApiError(404, "not_found", "Monitoring session not found.");
  const access = canSync(ctx.actor, session.patientId);
  if (!access.ok) reject(access);
  const device = await resolveDevice(ctx, envelope.value.device_id, envelope.value.device_serial);
  if (!device || device.id !== session.deviceId || device.patientId !== session.patientId) {
    throw new ApiError(404, "not_found", "Monitoring session not found.");
  }
  const classified = classifyReadings(envelope.value.readings, session, ctx.now);
  const ready = classified.flatMap((item) => (item.kind === "ready" ? [item.reading] : []));
  const history = await ctx.db.listSessionReadings(session.id);
  const receivedAt = ctx.now.toISOString();
  const stored = await ctx.db.insertReadings(
    ready.map((reading) => ({
      ...reading,
      sessionId: session.id,
      deviceId: device.id,
      receivedAt,
    })),
  );
  const serverByClient = new Map(stored.filter((row) => row.serverId).map((row) => [row.id, row.serverId as string]));
  const accepted = ready.filter((reading) => serverByClient.has(reading.clientReadingId));
  const rules = await ctx.db.listEnabledRules(session.patientId, device.id);
  const activeKeys = new Set(await ctx.db.listActiveAlertKeys(session.patientId));
  const drafts = evaluateNewAlerts({
    rules,
    patientId: session.patientId,
    deviceId: device.id,
    sessionId: session.id,
    history: history.map(toSample),
    now: ctx.now,
    syncDelayMs: LIMITS.syncDelayMs,
    activeKeys,
    accepted: accepted.map((reading) => ({
      ...toSample({ ...reading, id: serverByClient.get(reading.clientReadingId) ?? reading.clientReadingId, sessionId: session.id, deviceId: device.id, receivedAt }),
    })),
  });
  let alertsCreated = 0;
  for (const draft of drafts) {
    if (await ctx.db.insertAlert(draft)) alertsCreated += 1;
  }
  if (alertsCreated > 0 || accepted.some((reading) => reading.deviceStatus === "offline")) {
    const open = await ctx.db.listAlerts(session.patientId);
    const rolled = rollupStatus({
      deviceStatus: accepted.at(-1)?.deviceStatus ?? null,
      openSeverities: open.filter((alert) => alert.status === "open").map((alert) => alert.severity),
    });
    const monitoringStatus =
      rolled === "attention" ? "attention" : rolled === "offline" ? "offline" : rolled === "normal" ? "normal" : "watch";
    await ctx.db.setMonitoringStatus(session.patientId, monitoringStatus);
  }
  const results = mergeOutcomes(classified, stored);
  const summary = {
    uploaded: results.filter((row) => row.outcome === "uploaded").map((row) => row.id),
    skipped: results.filter((row) => row.outcome === "skipped").map((row) => row.id),
    failed: results.filter((row) => row.outcome === "failed").map((row) => ({ id: row.id, reason: row.reason })),
    alerts_created: alertsCreated,
  };
  try {
    await ctx.db.writeAudit({
      actorId: ctx.actor.id,
      action: "readings.synced",
      entityType: "monitoring_session",
      entityId: session.id,
      metadata: {
        uploaded: summary.uploaded.length,
        skipped: summary.skipped.length,
        failed: summary.failed.length,
        alerts_created: alertsCreated,
      },
    });
    await ctx.db.writeDeviceEvent(device.id, "readings.synced", {
      uploaded: summary.uploaded.length,
      skipped: summary.skipped.length,
      failed: summary.failed.length,
    });
  } catch {
    ctx.logger.error({ request_id: ctx.requestId, event: "audit_failed" });
  }
  ctx.logger.info({
    request_id: ctx.requestId,
    event: "readings.synced",
    uploaded: summary.uploaded.length,
    skipped: summary.skipped.length,
    failed: summary.failed.length,
    alerts_created: alertsCreated,
  });
  return json(200, summary);
}

function toSample(reading: NormalizedReading & { id: string; sessionId?: string; deviceId?: string; receivedAt?: string }) {
  return {
    id: reading.id,
    clientReadingId: reading.clientReadingId,
    capturedAt: new Date(reading.capturedAt),
    localizedTemperatureC: reading.localizedTemperatureC,
    ambientTemperatureC: reading.ambientTemperatureC,
    humidityPercent: reading.humidityPercent,
    relativeMoistureValue: reading.relativeMoistureValue,
    deviceStatus: reading.deviceStatus,
  };
}

export async function createSession(ctx: AppContext, request: HttpRequest): Promise<HttpResponse> {
  const parsed = parseWith(createSessionSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  if (ctx.actor.role !== "patient") throw new ApiError(403, "forbidden", "You do not have access to this resource.");
  assertClock(parsed.value.started_at, ctx.now, "started_at");
  const existing = await ctx.db.getSession(parsed.value.id);
  if (existing) {
    if (existing.patientId !== ctx.actor.id) throw new ApiError(404, "not_found", "Monitoring session not found.");
    return json(200, { session: sessionJson(existing), created: false });
  }
  const device = await resolveDevice(ctx, parsed.value.device_id, parsed.value.device_serial);
  if (!device || device.patientId !== ctx.actor.id) {
    throw new ApiError(404, "not_found", "Device not found.");
  }
  const session = await ctx.db.createSession({
    id: parsed.value.id,
    patientId: ctx.actor.id,
    deviceId: device.id,
    startedAt: parsed.value.started_at,
    simulatedWoundLabel: parsed.value.simulated_wound_label ?? null,
    notes: parsed.value.notes ?? null,
  });
  return json(201, { session: sessionJson(session), created: true });
}

export async function endSession(ctx: AppContext, request: HttpRequest, sessionId: string): Promise<HttpResponse> {
  const parsed = parseWith(endSessionSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  const session = await ctx.db.getSession(sessionId);
  if (!session) throw new ApiError(404, "not_found", "Monitoring session not found.");
  const access = canAccessPatient(ctx.actor, session.patientId, await assigned(ctx, session.patientId));
  if (!access.ok) reject(access);
  if (session.status === "completed") return json(200, { session: sessionJson(session), outcome: "already_completed" });
  const endedAt = parsed.value.ended_at ?? ctx.now.toISOString();
  assertClock(endedAt, ctx.now, "ended_at");
  if (Date.parse(endedAt) < Date.parse(session.startedAt)) {
    throw new ApiError(400, "validation_error", "ended_at must be at or after the session start.");
  }
  const updated = await ctx.db.endSession(sessionId, endedAt);
  if (updated === "missing") throw new ApiError(404, "not_found", "Monitoring session not found.");
  if (updated === "already_completed") return json(200, { session: sessionJson(session), outcome: "already_completed" });
  return json(200, { session: sessionJson(updated), outcome: "completed" });
}

export async function patientSummary(ctx: AppContext): Promise<HttpResponse> {
  if (ctx.actor.role !== "patient") throw new ApiError(403, "forbidden", "You do not have access to this resource.");
  const sessions = await ctx.db.listSessions(ctx.actor.id);
  const device = (await Promise.all(sessions.map((session) => ctx.db.getDevice(session.deviceId)))).find(Boolean)
    ?? null;
  const assignedDevice = device;
  const open = sessions.find((session) => session.status !== "completed") ?? null;
  const readings = await ctx.db.listRecentReadings(ctx.actor.id, 20);
  const latest = readings[0] ?? null;
  const chronological = readings.slice().sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const temps = chronological.map((row) => row.localizedTemperatureC).filter((value): value is number => value != null);
  const baseline = temps.length > 1 ? temps.slice(0, -1).reduce((sum, value) => sum + value, 0) / (temps.length - 1) : temps[0] ?? null;
  const alerts = (await ctx.db.listAlerts(ctx.actor.id)).filter((alert) => alert.status === "open");
  const link = rollupStatus({
    deviceStatus: latest?.deviceStatus ?? null,
    openSeverities: alerts.map((alert) => alert.severity),
  });
  return json(200, {
    disclaimer: DISCLAIMER,
    indication: presentStatus(link),
    device: assignedDevice ? deviceJson(assignedDevice) : null,
    current_session: open ? sessionJson(open) : null,
    latest_reading: latest ? readingJson(latest) : null,
    trend: {
      localized_temperature_c: {
        latest: temps.at(-1) ?? null,
        baseline,
        delta: temps.at(-1) != null && baseline != null ? round2(temps.at(-1)! - baseline) : null,
      },
      humidity_percent: { latest: latest?.humidityPercent ?? null },
      relative_moisture_value: { latest: latest?.relativeMoistureValue ?? null },
    },
    open_indicators: alerts.map(alertJson),
  });
}

export async function clinicianPatients(ctx: AppContext): Promise<HttpResponse> {
  const access = requireClinicianReader(ctx.actor);
  if (!access.ok) reject(access);
  const patients = await ctx.db.listPatients(ctx.actor.role === "admin" ? null : ctx.actor.id);
  return json(200, {
    disclaimer: DISCLAIMER,
    data: patients.map((patient) => ({
      id: patient.id,
      full_name: patient.fullName,
      monitoring_status: patient.monitoringStatus,
      open_alert_count: patient.openAlertCount,
    })),
  });
}

export async function clinicianMonitoring(ctx: AppContext, patientId: string): Promise<HttpResponse> {
  const target = await ctx.db.getActor(patientId);
  if (!target || target.role !== "patient") throw new ApiError(404, "not_found", "Patient not found.");
  const access = canAccessPatient(ctx.actor, patientId, await assigned(ctx, patientId));
  if (!access.ok) reject(access);
  const [sessions, readings, notes, alerts] = await Promise.all([
    ctx.db.listSessions(patientId),
    ctx.db.listRecentReadings(patientId, LIMITS.pageDefault),
    ctx.db.listNotes(patientId),
    ctx.db.listAlerts(patientId),
  ]);
  return json(200, {
    disclaimer: DISCLAIMER,
    patient: { id: target.id, full_name: target.fullName },
    sessions: sessions.map(sessionJson),
    readings: readings.map(readingJson),
    notes: notes.map(noteJson),
    indicator_alerts: alerts.map(alertJson),
  });
}

export async function acknowledgeAlert(ctx: AppContext, request: HttpRequest, alertId: string): Promise<HttpResponse> {
  const parsed = parseWith(acknowledgeSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  const alert = await ctx.db.getAlert(alertId);
  if (!alert) throw new ApiError(404, "not_found", "Indicator alert not found.");
  const access = canAcknowledge(ctx.actor, await assigned(ctx, alert.patientId));
  if (!access.ok) reject(access);
  const updated = await ctx.db.acknowledgeAlert(alertId, ctx.actor.id, ctx.now.toISOString());
  if (updated === "missing") throw new ApiError(404, "not_found", "Indicator alert not found.");
  if (updated === "resolved") throw new ApiError(409, "conflict", "A resolved indicator cannot be acknowledged.");
  await ctx.db.writeAudit({
    actorId: ctx.actor.id,
    action: "indicator.acknowledged",
    entityType: "indicator_alert",
    entityId: alert.id,
    metadata: { alert_type: alert.alertType, patient_id: alert.patientId },
  });
  return json(200, { indicator_alert: alertJson(updated) });
}

export async function createNote(ctx: AppContext, request: HttpRequest): Promise<HttpResponse> {
  const parsed = parseWith(noteSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  if (/infection detected/i.test(parsed.value.note_text) || /diagnosed/i.test(parsed.value.note_text)) {
    throw new ApiError(400, "validation_error", "Notes cannot claim a diagnosis.");
  }
  const target = await ctx.db.getActor(parsed.value.patient_id);
  if (!target || target.role !== "patient") throw new ApiError(404, "not_found", "Patient not found.");
  const access = canWriteNote(ctx.actor, await assigned(ctx, parsed.value.patient_id));
  if (!access.ok) reject(access);
  const note = await ctx.db.createNote({
    patientId: parsed.value.patient_id,
    authorId: ctx.actor.id,
    sessionId: parsed.value.session_id ?? null,
    alertId: parsed.value.alert_id ?? null,
    noteText: parsed.value.note_text,
  });
  await ctx.db.writeAudit({
    actorId: ctx.actor.id,
    action: "note.created",
    entityType: "clinical_note",
    entityId: note.id,
    metadata: { patient_id: note.patientId },
  });
  return json(201, { note: noteJson(note) });
}

export async function assignDevice(ctx: AppContext, request: HttpRequest): Promise<HttpResponse> {
  const access = requireAdmin(ctx.actor);
  if (!access.ok) reject(access);
  const parsed = parseWith(assignDeviceSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  const device = await ctx.db.assignDevice(parsed.value.device_id, parsed.value.patient_id);
  if (!device) throw new ApiError(404, "not_found", "Device not found.");
  await ctx.db.writeAudit({
    actorId: ctx.actor.id,
    action: "device.assigned",
    entityType: "device",
    entityId: device.id,
    metadata: { patient_id: parsed.value.patient_id },
  });
  return json(200, { device: deviceJson(device) });
}

export async function createAssignment(ctx: AppContext, request: HttpRequest): Promise<HttpResponse> {
  const access = requireAdmin(ctx.actor);
  if (!access.ok) reject(access);
  const parsed = parseWith(assignmentSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  if (parsed.value.clinician_id === parsed.value.patient_id) {
    throw new ApiError(400, "validation_error", "A patient cannot be assigned to themselves.");
  }
  const row = await ctx.db.createAssignment({
    clinicianId: parsed.value.clinician_id,
    patientId: parsed.value.patient_id,
    assignmentRole: parsed.value.assignment_role,
  });
  await ctx.db.writeAudit({
    actorId: ctx.actor.id,
    action: "clinician.assigned",
    entityType: "clinician_patient_assignment",
    entityId: row.id,
    metadata: { patient_id: row.patientId, clinician_id: row.clinicianId, assignment_role: row.assignmentRole },
  });
  return json(201, {
    assignment: {
      id: row.id,
      clinician_id: row.clinicianId,
      patient_id: row.patientId,
      assignment_role: row.assignmentRole,
      active: row.active,
    },
  });
}

export async function setRole(ctx: AppContext, request: HttpRequest): Promise<HttpResponse> {
  const access = requireAdmin(ctx.actor);
  if (!access.ok) reject(access);
  const parsed = parseWith(roleSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  await ctx.db.setRole(ctx.actor.id, parsed.value.profile_id, parsed.value.role);
  await ctx.db.writeAudit({
    actorId: ctx.actor.id,
    action: "profile.role_changed",
    entityType: "profile",
    entityId: parsed.value.profile_id,
    metadata: { role: parsed.value.role },
  });
  return json(200, { profile_id: parsed.value.profile_id, role: parsed.value.role });
}

export async function createRule(ctx: AppContext, request: HttpRequest): Promise<HttpResponse> {
  const access = requireAdmin(ctx.actor);
  if (!access.ok) reject(access);
  const parsed = parseWith(alertRuleSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  const rule = await ctx.db.createAlertRule({
    scope: parsed.value.scope,
    patientId: parsed.value.patient_id ?? null,
    deviceId: parsed.value.device_id ?? null,
    temperatureDeltaThreshold: parsed.value.temperature_delta_threshold ?? null,
    humidityThreshold: parsed.value.humidity_threshold ?? null,
    moistureThreshold: parsed.value.moisture_threshold ?? null,
    enabled: parsed.value.enabled ?? true,
    configuredBy: ctx.actor.id,
  });
  return json(201, {
    alert_rule: {
      id: rule.id,
      scope: rule.scope,
      patient_id: rule.patientId,
      device_id: rule.deviceId,
      temperature_delta_threshold: rule.temperatureDeltaThreshold,
      humidity_threshold: rule.humidityThreshold,
      moisture_threshold: rule.moistureThreshold,
      enabled: rule.enabled,
    },
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sessionJson(session: {
  id: string;
  patientId: string;
  deviceId: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  simulatedWoundLabel: string | null;
  notes: string | null;
}) {
  return {
    id: session.id,
    patient_id: session.patientId,
    device_id: session.deviceId,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    status: session.status,
    simulated_wound_label: session.simulatedWoundLabel,
    notes: session.notes,
  };
}

function readingJson(reading: {
  id: string;
  sessionId: string;
  deviceId: string;
  clientReadingId: string;
  sequenceNumber: number | null;
  capturedAt: string;
  receivedAt: string;
  localizedTemperatureC: number | null;
  ambientTemperatureC: number | null;
  humidityPercent: number | null;
  relativeMoistureValue: number | null;
  batteryPercent: number | null;
  deviceStatus: LinkStatus;
}) {
  return {
    id: reading.id,
    session_id: reading.sessionId,
    device_id: reading.deviceId,
    client_reading_id: reading.clientReadingId,
    sequence: reading.sequenceNumber,
    captured_at: reading.capturedAt,
    received_at: reading.receivedAt,
    localized_temperature_c: reading.localizedTemperatureC,
    ambient_temperature_c: reading.ambientTemperatureC,
    humidity_percent: reading.humidityPercent,
    relative_moisture_value: reading.relativeMoistureValue,
    battery_percent: reading.batteryPercent,
    device_status: reading.deviceStatus,
    source: "ble_mobile_sync",
    indication: presentStatus(reading.deviceStatus),
  };
}

function alertJson(alert: {
  id: string;
  patientId: string;
  deviceId: string | null;
  sessionId: string | null;
  readingId: string | null;
  alertType: string;
  severity: string;
  status: string;
  message: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}) {
  return {
    id: alert.id,
    patient_id: alert.patientId,
    device_id: alert.deviceId,
    session_id: alert.sessionId,
    reading_id: alert.readingId,
    alert_type: alert.alertType,
    severity: alert.severity,
    status: alert.status,
    message: alert.message,
    acknowledged_by: alert.acknowledgedBy,
    acknowledged_at: alert.acknowledgedAt,
    resolved_at: alert.resolvedAt,
    created_at: alert.createdAt,
  };
}

function noteJson(note: {
  id: string;
  patientId: string;
  authorId: string;
  sessionId: string | null;
  alertId: string | null;
  noteText: string;
  createdAt: string;
}) {
  return {
    id: note.id,
    patient_id: note.patientId,
    author_id: note.authorId,
    session_id: note.sessionId,
    alert_id: note.alertId,
    note_text: note.noteText,
    created_at: note.createdAt,
  };
}

function deviceJson(device: {
  id: string;
  serialNumber: string;
  deviceName: string;
  patientId: string | null;
  firmwareVersion: string | null;
  pairingStatus: string;
  lastSeenAt: string | null;
}) {
  return {
    id: device.id,
    serial_number: device.serialNumber,
    device_name: device.deviceName,
    patient_id: device.patientId,
    firmware_version: device.firmwareVersion,
    pairing_status: device.pairingStatus,
    last_seen_at: device.lastSeenAt,
  };
}
