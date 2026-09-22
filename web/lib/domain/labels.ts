import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  AppointmentKind,
  AppointmentStatus,
  DeviceHealth,
  DressingCondition,
  MetricKey,
  MonitoringStatus,
  ReportType,
  ReviewPriority,
  StaffRole,
  TaskPriority,
  TaskStatus,
  TaskType,
  TimeRange,
} from "@/types/domain";

export type Tone = "neutral" | "signal" | "watch" | "attention" | "critical" | "info" | "offline";

export const PRIORITY_META: Record<ReviewPriority, { label: string; tone: Tone; description: string }> = {
  low: { label: "Low", tone: "signal", description: "No open indicators" },
  medium: { label: "Medium", tone: "watch", description: "Watch status or one open indicator" },
  high: { label: "High", tone: "attention", description: "Attention status or several open indicators" },
  critical: { label: "Critical", tone: "critical", description: "Attention indicator not yet acknowledged" },
};

export const MONITORING_META: Record<MonitoringStatus, { label: string; tone: Tone }> = {
  normal: { label: "Normal", tone: "signal" },
  watch: { label: "Watch", tone: "watch" },
  attention: { label: "Attention", tone: "attention" },
  offline: { label: "Offline", tone: "offline" },
};

export const SEVERITY_META: Record<AlertSeverity, { label: string; tone: Tone }> = {
  info: { label: "Info", tone: "info" },
  watch: { label: "Watch", tone: "watch" },
  attention: { label: "Attention", tone: "critical" },
};

export const ALERT_STATUS_META: Record<AlertStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "attention" },
  acknowledged: { label: "Acknowledged", tone: "info" },
  resolved: { label: "Resolved", tone: "neutral" },
};

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  elevated_temperature: "Localized temperature change",
  humidity_change: "Humidity above threshold",
  moisture_change: "Relative moisture above threshold",
  device_offline: "Device offline",
  sync_issue: "Synchronization delayed",
};

export const DEVICE_HEALTH_META: Record<DeviceHealth, { label: string; tone: Tone }> = {
  online: { label: "Online", tone: "signal" },
  warning: { label: "Warning", tone: "watch" },
  offline: { label: "Offline", tone: "offline" },
};

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  dressing_check: "Dressing check",
  measurement: "Measurement",
  device_check: "Device check",
  indicator_review: "Indicator review",
  patient_education: "Patient education",
  other: "Other",
};

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "info" },
  high: { label: "High", tone: "watch" },
  urgent: { label: "Urgent", tone: "critical" },
};

export const TASK_STATUS_META: Record<TaskStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "signal" },
  delayed: { label: "Delayed", tone: "watch" },
  cancelled: { label: "Cancelled", tone: "offline" },
};

export const DRESSING_LABEL: Record<DressingCondition, string> = {
  intact: "Intact",
  damp: "Damp at edge",
  saturated: "Saturated",
  lifted: "Edge lifted",
  replaced: "Replaced",
};

export const APPOINTMENT_KIND_LABEL: Record<AppointmentKind, string> = {
  indicator_review: "Indicator review",
  dressing_change: "Dressing change",
  follow_up: "Follow-up",
  device_fitting: "Device fitting",
};

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "info" },
  completed: { label: "Completed", tone: "signal" },
  cancelled: { label: "Cancelled", tone: "offline" },
  missed: { label: "Missed", tone: "watch" },
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  admin: "Admin",
};

export const REPORT_TYPE_META: Record<ReportType, { label: string; description: string }> = {
  patient_summary: {
    label: "Patient monitoring summary",
    description: "Indicator trends, open and resolved indicators, notes and check-ins for one patient.",
  },
  session_summary: {
    label: "Session summary",
    description: "One monitoring session: readings, threshold crossings and acknowledgements.",
  },
  indicator_log: {
    label: "Indicator log",
    description: "Every indicator in the period with time to acknowledgement.",
  },
  device_health: {
    label: "Device health",
    description: "Battery, synchronization and connectivity for the device fleet.",
  },
  audit_export: {
    label: "Audit export",
    description: "Audit log entries for compliance review.",
  },
  facility_activity: {
    label: "Facility activity",
    description: "Monitoring activity, workload and response times per facility.",
  },
};

export const METRIC_META: Record<
  MetricKey,
  { label: string; short: string; unit: string; digits: number; sensor: string; domain: [number, number] }
> = {
  localizedTemperatureC: {
    label: "Localized temperature",
    short: "Local temp",
    unit: "°C",
    digits: 1,
    sensor: "DS18B20",
    domain: [34.5, 39],
  },
  humidityPercent: {
    label: "Humidity",
    short: "Humidity",
    unit: "%RH",
    digits: 1,
    sensor: "BME280",
    domain: [40, 95],
  },
  relativeMoistureValue: {
    label: "Relative moisture",
    short: "Moisture",
    unit: "ADC",
    digits: 0,
    sensor: "Copper electrodes",
    domain: [100, 650],
  },
  ambientTemperatureC: {
    label: "Ambient temperature",
    short: "Ambient",
    unit: "°C",
    digits: 1,
    sensor: "BME280",
    domain: [20, 32],
  },
};

export const TIME_RANGES: { value: TimeRange; label: string; ms: number; bucketSeconds: number }[] = [
  { value: "1H", label: "1H", ms: 3_600_000, bucketSeconds: 30 },
  { value: "6H", label: "6H", ms: 21_600_000, bucketSeconds: 180 },
  { value: "24H", label: "24H", ms: 86_400_000, bucketSeconds: 600 },
  { value: "7D", label: "7D", ms: 604_800_000, bucketSeconds: 3_600 },
  { value: "30D", label: "30D", ms: 2_592_000_000, bucketSeconds: 14_400 },
];

export function rangeSpec(range: TimeRange) {
  return TIME_RANGES.find((r) => r.value === range) ?? TIME_RANGES[2];
}

export const TONE_CLASS: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  neutral: {
    text: "text-graphite-200",
    bg: "bg-graphite-700/40",
    border: "border-graphite-600/60",
    dot: "bg-graphite-300",
  },
  signal: { text: "text-signal", bg: "bg-signal/10", border: "border-signal/25", dot: "bg-signal" },
  watch: { text: "text-watch", bg: "bg-watch/10", border: "border-watch/25", dot: "bg-watch" },
  attention: { text: "text-attention", bg: "bg-attention/10", border: "border-attention/25", dot: "bg-attention" },
  critical: { text: "text-critical", bg: "bg-critical/12", border: "border-critical/30", dot: "bg-critical" },
  info: { text: "text-info", bg: "bg-info/10", border: "border-info/25", dot: "bg-info" },
  offline: { text: "text-graphite-300", bg: "bg-graphite-700/50", border: "border-graphite-600", dot: "bg-graphite-400" },
};
