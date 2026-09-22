import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  AppNotification,
  CareTask,
  DeviceHealth,
  DeviceLinkStatus,
  IndicatorAlert,
  MonitoringStatus,
  NotificationKind,
  PairingStatus,
  PatientSummary,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/types/domain";
import { derivePriority } from "@/lib/domain/priority";
import { ageFrom } from "@/utils/format";

const ONLINE_WINDOW_MS = 2 * 60_000;
const OFFLINE_AFTER_MS = 15 * 60_000;

export const num = (value: unknown): number | null => (value == null || value === "" ? null : Number(value));

/** Embedded one-to-one relations come back as an object or a one-item array. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function healthFrom(lastSeenAt: string | null, pairing: PairingStatus, battery: number | null, now = Date.now()): DeviceHealth {
  if (!lastSeenAt || pairing === "disconnected") return "offline";
  const age = now - Date.parse(lastSeenAt);
  if (age > OFFLINE_AFTER_MS) return "offline";
  if (age > ONLINE_WINDOW_MS || (battery ?? 100) < 20) return "warning";
  return "online";
}

export interface OverviewRow {
  patient_id: string;
  full_name: string;
  date_of_birth: string | null;
  monitoring_status: MonitoringStatus;
  room_label: string | null;
  facility_id: string | null;
  facility_name: string | null;
  device_id: string | null;
  device_serial: string | null;
  pairing_status: PairingStatus | null;
  last_seen_at: string | null;
  firmware_version: string | null;
  session_id: string | null;
  simulated_wound_label: string | null;
  session_started_at: string | null;
  last_reading_at: string | null;
  localized_temperature_c: number | string | null;
  ambient_temperature_c: number | string | null;
  humidity_percent: number | string | null;
  relative_moisture_value: number | null;
  battery_percent: number | string | null;
  last_device_status: DeviceLinkStatus | null;
  open_alert_count: number;
  open_attention_count: number;
  acknowledged_alert_count: number;
  doctor_id: string | null;
  doctor_name: string | null;
  nurse_id: string | null;
  nurse_name: string | null;
}

export function mapOverview(row: OverviewRow, lastCheckAt: string | null): PatientSummary {
  const battery = num(row.battery_percent);
  const health = row.device_id ? healthFrom(row.last_seen_at, row.pairing_status ?? "unpaired", battery) : "offline";
  const monitoringStatus = health === "offline" && row.device_id ? "offline" : row.monitoring_status;
  const counts = {
    openAlertCount: Number(row.open_alert_count ?? 0),
    openAttentionCount: Number(row.open_attention_count ?? 0),
    acknowledgedAlertCount: Number(row.acknowledged_alert_count ?? 0),
  };
  return {
    id: row.patient_id,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    age: ageFrom(row.date_of_birth),
    roomLabel: row.room_label,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    monitoringStatus,
    priority: derivePriority({ monitoringStatus, ...counts }),
    device: row.device_id
      ? {
          id: row.device_id,
          serial: row.device_serial ?? "",
          pairingStatus: row.pairing_status ?? "unpaired",
          health,
          lastSeenAt: row.last_seen_at,
          firmware: row.firmware_version,
          batteryPercent: battery,
        }
      : null,
    session: row.session_id ? { id: row.session_id, label: row.simulated_wound_label, startedAt: row.session_started_at ?? "" } : null,
    latest: row.last_reading_at
      ? {
          capturedAt: row.last_reading_at,
          localizedTemperatureC: num(row.localized_temperature_c),
          ambientTemperatureC: num(row.ambient_temperature_c),
          humidityPercent: num(row.humidity_percent),
          relativeMoistureValue: num(row.relative_moisture_value),
          batteryPercent: battery,
          deviceStatus: row.last_device_status ?? "connected",
        }
      : null,
    ...counts,
    doctor: row.doctor_id ? { id: row.doctor_id, name: row.doctor_name ?? "Doctor" } : null,
    nurse: row.nurse_id ? { id: row.nurse_id, name: row.nurse_name ?? "Nurse" } : null,
    lastCheckAt,
    admittedAt: null,
    updatedAt: row.last_reading_at ?? row.session_started_at ?? new Date().toISOString(),
  };
}

export interface AlertRow {
  id: string;
  patient_id: string;
  session_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  patient: { full_name: string; patient_profiles: { room_label: string | null } | { room_label: string | null }[] | null } | null;
  acknowledger: { id: string; full_name: string } | null;
  device: { serial_number: string } | null;
}

export const ALERT_SELECT =
  "id, patient_id, session_id, alert_type, severity, status, message, created_at, acknowledged_at, resolved_at, " +
  "patient:profiles!indicator_alerts_patient_id_fkey(full_name, patient_profiles(room_label)), " +
  "acknowledger:profiles!indicator_alerts_acknowledged_by_fkey(id, full_name), " +
  "device:devices(serial_number)";

export function mapAlert(row: AlertRow): IndicatorAlert {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient?.full_name ?? "Patient",
    roomLabel: one(row.patient?.patient_profiles)?.room_label ?? null,
    deviceSerial: row.device?.serial_number ?? null,
    sessionId: row.session_id,
    alertType: row.alert_type,
    severity: row.severity,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledger ? { id: row.acknowledger.id, name: row.acknowledger.full_name } : null,
    resolvedAt: row.resolved_at,
    escalatedAt: null,
  };
}

export interface TaskRow {
  id: string;
  patient_id: string;
  task_type: TaskType;
  title: string;
  details: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string;
  delayed_until: string | null;
  delay_reason: string | null;
  completed_at: string | null;
  alert_id: string | null;
  assignee: { id: string; full_name: string } | null;
  patient: { full_name: string; patient_profiles: { room_label: string | null } | { room_label: string | null }[] | null } | null;
}

export const TASK_SELECT =
  "id, patient_id, task_type, title, details, priority, status, due_at, delayed_until, delay_reason, completed_at, alert_id, " +
  "assignee:profiles!care_tasks_assigned_to_fkey(id, full_name), " +
  "patient:profiles!care_tasks_patient_id_fkey(full_name, patient_profiles(room_label))";

export function mapTask(row: TaskRow): CareTask {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient?.full_name ?? "Patient",
    roomLabel: one(row.patient?.patient_profiles)?.room_label ?? null,
    assignedTo: row.assignee ? { id: row.assignee.id, name: row.assignee.full_name } : null,
    taskType: row.task_type,
    title: row.title,
    details: row.details,
    priority: row.priority,
    status: row.status,
    dueAt: row.due_at,
    delayedUntil: row.delayed_until,
    delayReason: row.delay_reason,
    completedAt: row.completed_at,
    alertId: row.alert_id,
  };
}

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  patient_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    patientId: row.patient_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
