/* Domain types. Enum values mirror the Postgres enums in supabase/migrations. */

export type AppRole = "patient" | "doctor" | "nurse" | "admin";
export type StaffRole = Exclude<AppRole, "patient">;

export type MonitoringStatus = "normal" | "watch" | "attention" | "offline";
export type DeviceLinkStatus = "normal" | "connected" | "watch" | "attention" | "offline" | "syncing";
export type PairingStatus = "unpaired" | "paired" | "disconnected";
export type AlertType = "elevated_temperature" | "humidity_change" | "moisture_change" | "device_offline" | "sync_issue";
export type AlertSeverity = "info" | "watch" | "attention";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type SessionStatus = "active" | "paused" | "completed";

/** Derived ranking for the review queue. Not a clinical risk score. */
export type ReviewPriority = "low" | "medium" | "high" | "critical";
export type DeviceHealth = "online" | "warning" | "offline";

export type TaskType =
  | "dressing_check"
  | "measurement"
  | "device_check"
  | "indicator_review"
  | "patient_education"
  | "other";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "delayed" | "cancelled";
export type DressingCondition = "intact" | "damp" | "saturated" | "lifted" | "replaced";
export type AppointmentKind = "indicator_review" | "dressing_change" | "follow_up" | "device_fitting";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "missed";
export type NotificationKind =
  | "indicator_alert"
  | "alert_escalation"
  | "task"
  | "message"
  | "device"
  | "approval"
  | "system";
export type ReportType =
  | "patient_summary"
  | "session_summary"
  | "indicator_log"
  | "device_health"
  | "audit_export"
  | "facility_activity";
export type ReportFormat = "csv" | "pdf";
export type ReportStatus = "queued" | "ready" | "failed";
export type AccessRequestStatus = "pending" | "approved" | "rejected";
export type StaffStatus = "active" | "suspended";
export type Presence = "available" | "busy" | "off_shift";

export type TimeRange = "1H" | "6H" | "24H" | "7D" | "30D";
export type MetricKey = "localizedTemperatureC" | "humidityPercent" | "relativeMoistureValue" | "ambientTemperatureC";

export interface PersonRef {
  id: string;
  name: string;
}

export interface Viewer {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  title: string | null;
  department: string | null;
  facilityName: string | null;
}

export interface ReadingSample {
  capturedAt: string;
  localizedTemperatureC: number | null;
  ambientTemperatureC: number | null;
  humidityPercent: number | null;
  relativeMoistureValue: number | null;
  batteryPercent: number | null;
  deviceStatus: DeviceLinkStatus;
}

export interface PatientDevice {
  id: string;
  serial: string;
  pairingStatus: PairingStatus;
  health: DeviceHealth;
  lastSeenAt: string | null;
  firmware: string | null;
  batteryPercent: number | null;
}

export interface PatientSummary {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  age: number | null;
  roomLabel: string | null;
  facilityId: string | null;
  facilityName: string | null;
  monitoringStatus: MonitoringStatus;
  priority: ReviewPriority;
  device: PatientDevice | null;
  session: { id: string; label: string | null; startedAt: string } | null;
  latest: ReadingSample | null;
  openAlertCount: number;
  openAttentionCount: number;
  acknowledgedAlertCount: number;
  doctor: PersonRef | null;
  nurse: PersonRef | null;
  lastCheckAt: string | null;
  admittedAt: string | null;
  updatedAt: string;
}

export interface PatientDetail extends PatientSummary {
  emergencyContact: string | null;
  carePlans: CarePlan[];
  sessions: SessionRecord[];
}

export interface AlertThresholds {
  temperatureDelta: number;
  humidity: number;
  moisture: number;
}

export interface AlertRule extends AlertThresholds {
  id: string;
  scope: "global" | "patient" | "device";
  targetLabel: string | null;
  enabled: boolean;
  updatedAt: string;
}

export interface SeriesPoint {
  t: number;
  localizedTemperatureC: number | null;
  ambientTemperatureC: number | null;
  humidityPercent: number | null;
  relativeMoistureValue: number | null;
}

export interface ChartEvent {
  t: number;
  kind: "alert" | "note" | "checkin" | "device" | "session";
  label: string;
  severity?: AlertSeverity;
}

export interface ReadingSeries {
  range: TimeRange;
  from: number;
  to: number;
  bucketSeconds: number;
  points: SeriesPoint[];
  comparison: SeriesPoint[];
  baseline: number | null;
  thresholds: AlertThresholds;
  events: ChartEvent[];
}

export interface IndicatorAlert {
  id: string;
  patientId: string;
  patientName: string;
  roomLabel: string | null;
  deviceSerial: string | null;
  sessionId: string | null;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: PersonRef | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  author: PersonRef & { role: StaffRole };
  text: string;
  alertId: string | null;
  createdAt: string;
}

export interface CareTask {
  id: string;
  patientId: string;
  patientName: string;
  roomLabel: string | null;
  assignedTo: PersonRef | null;
  taskType: TaskType;
  title: string;
  details: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string;
  delayedUntil: string | null;
  delayReason: string | null;
  completedAt: string | null;
  alertId: string | null;
}

export interface CheckIn {
  id: string;
  patientId: string;
  patientName: string;
  recordedBy: PersonRef;
  bodyTemperatureC: number | null;
  painScore: number | null;
  dressingCondition: DressingCondition | null;
  deviceSecure: boolean | null;
  notes: string | null;
  recordedAt: string;
  taskId: string | null;
}

export interface CheckInInput {
  patientId: string;
  taskId?: string | null;
  bodyTemperatureC?: number | null;
  painScore?: number | null;
  dressingCondition?: DressingCondition | null;
  deviceSecure?: boolean | null;
  notes?: string | null;
}

export interface CarePlan {
  id: string;
  patientId: string;
  author: PersonRef;
  title: string;
  instructions: string;
  dressingChangeIntervalHours: number | null;
  reviewIntervalHours: number | null;
  active: boolean;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  clinician: PersonRef;
  kind: AppointmentKind;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  location: string | null;
  notes: string | null;
}

export interface AppointmentInput {
  patientId: string;
  kind: AppointmentKind;
  startsAt: string;
  durationMinutes: number;
  location?: string | null;
  notes?: string | null;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  patientId: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  patientId: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  peer: PersonRef & { role: StaffRole; title: string | null };
  lastMessage: Message | null;
  unreadCount: number;
}

export interface ReportRecord {
  id: string;
  reportType: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  periodStart: string;
  periodEnd: string;
  patient: PersonRef | null;
  createdBy: PersonRef;
  createdAt: string;
  completedAt: string | null;
}

export interface ReportRequest {
  reportType: ReportType;
  format: ReportFormat;
  periodStart: string;
  periodEnd: string;
  patientId?: string | null;
}

export interface StaffMember {
  id: string;
  fullName: string;
  /** Null when auth.users is not readable from the browser (Supabase mode). */
  email: string | null;
  phone: string | null;
  role: StaffRole;
  title: string | null;
  department: string | null;
  facilityId: string | null;
  facilityName: string | null;
  status: StaffStatus;
  lastActiveAt: string | null;
  createdAt: string;
  assignedPatientCount: number;
}

export interface Facility {
  id: string;
  name: string;
  code: string;
  unitType: "ward" | "day_unit" | "outpatient" | "simulation_lab";
  bedCapacity: number | null;
  patientCount: number;
  staffCount: number;
  deviceCount: number;
  openAlertCount: number;
}

export interface AccessRequest {
  id: string;
  requester: PersonRef & { email: string | null };
  requestedRole: StaffRole;
  facilityName: string | null;
  department: string | null;
  licenseNumber: string | null;
  justification: string | null;
  status: AccessRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: PersonRef | null;
  reviewNote: string | null;
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  actor: (PersonRef & { role: AppRole }) | null;
  action: string;
  entityType: string;
  entityId: string | null;
  result: "success" | "denied" | "failed";
  metadata: Record<string, string | number | boolean | null>;
}

export interface DeviceRecord {
  id: string;
  serial: string;
  name: string;
  patient: PersonRef | null;
  facilityName: string | null;
  pairingStatus: PairingStatus;
  health: DeviceHealth;
  batteryPercent: number | null;
  lastSyncAt: string | null;
  connection: "ble_gateway" | "pending_sync" | "none";
  firmware: string | null;
  sessionActive: boolean;
}

export interface SessionRecord {
  id: string;
  patientId: string;
  deviceSerial: string;
  label: string | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  readingCount: number;
  alertCount: number;
}

export interface TimelineEvent {
  id: string;
  at: string;
  kind: "session" | "alert" | "acknowledged" | "resolved" | "note" | "checkin" | "task" | "appointment" | "device";
  title: string;
  detail: string | null;
  actor: string | null;
  severity?: AlertSeverity;
}

export interface ServiceStatus {
  id: "api" | "database" | "realtime" | "storage" | "sync" | "auth";
  name: string;
  status: "operational" | "degraded" | "down";
  latencyMs: number | null;
  uptimePercent: number;
  detail: string;
  history: number[];
}

export interface SystemHealth {
  checkedAt: string;
  services: ServiceStatus[];
  storage: { usedGb: number; totalGb: number };
  sync: { pendingBatches: number; lastBatchAt: string | null; successRate: number; readingsLastHour: number };
  realtime: { connectedClients: number; eventsPerMinute: number[] };
}

export interface OverviewCounts {
  doctors: number;
  nurses: number;
  patients: number;
  devices: number;
  onlineDevices: number;
  offlineDevices: number;
  warningDevices: number;
  activeAlerts: number;
  criticalAlerts: number;
  pendingApprovals: number;
}

export interface AnalyticsData {
  userGrowth: { date: string; doctors: number; nurses: number; patients: number }[];
  deviceHealth: { date: string; online: number; warning: number; offline: number }[];
  alertHeatmap: { day: number; hour: number; count: number }[];
  alertsByType: { type: AlertType; count: number }[];
  monitoringActivity: { date: string; readings: number; checkins: number }[];
  utilization: { date: string; activeUsers: number; sessions: number }[];
  priorityDistribution: Record<ReviewPriority, number>;
}
