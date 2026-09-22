import type {
  AccessRequest,
  AlertRule,
  AlertStatus,
  AlertThresholds,
  AnalyticsData,
  AppNotification,
  Appointment,
  AppointmentInput,
  AuditEntry,
  CarePlan,
  CareTask,
  CheckIn,
  CheckInInput,
  ClinicalNote,
  Conversation,
  DeviceRecord,
  Facility,
  IndicatorAlert,
  Message,
  OverviewCounts,
  PatientDetail,
  PatientSummary,
  ReadingSeries,
  ReportRecord,
  ReportRequest,
  StaffMember,
  StaffRole,
  StaffStatus,
  SystemHealth,
  TaskStatus,
  TimeRange,
  TimelineEvent,
  Viewer,
} from "@/types/domain";

export interface AlertFilter {
  status?: AlertStatus | "active";
  patientId?: string;
}

export interface TaskFilter {
  scope: "mine" | "patient";
  patientId?: string;
  day?: string;
}

export interface AuditFilter {
  since?: string;
  limit?: number;
}

export interface TaskUpdate {
  status: TaskStatus;
  delayMinutes?: number;
  delayReason?: string;
}

/**
 * Everything the dashboards read or write. Scoping (assigned patients, own inbox)
 * is enforced by the implementation: row level security for Supabase, the
 * viewer's assignments for the demo.
 */
export interface DataService {
  readonly mode: "demo" | "supabase";
  readonly viewer: Viewer;

  listPatients(): Promise<PatientSummary[]>;
  getPatient(patientId: string): Promise<PatientDetail | null>;
  getSeries(patientId: string, range: TimeRange): Promise<ReadingSeries>;
  getTimeline(patientId: string): Promise<TimelineEvent[]>;

  listAlerts(filter?: AlertFilter): Promise<IndicatorAlert[]>;
  acknowledgeAlert(alertId: string): Promise<IndicatorAlert>;
  resolveAlert(alertId: string): Promise<IndicatorAlert>;
  escalateAlert(alertId: string, note?: string): Promise<void>;

  listNotes(patientId: string): Promise<ClinicalNote[]>;
  addNote(input: { patientId: string; text: string; alertId?: string | null }): Promise<ClinicalNote>;
  listCarePlans(patientId: string): Promise<CarePlan[]>;
  addCarePlan(input: Omit<CarePlan, "id" | "author" | "createdAt" | "active">): Promise<CarePlan>;

  listTasks(filter: TaskFilter): Promise<CareTask[]>;
  updateTask(taskId: string, update: TaskUpdate): Promise<CareTask>;
  listCheckIns(patientId?: string): Promise<CheckIn[]>;
  submitCheckIn(input: CheckInInput): Promise<CheckIn>;

  listAppointments(from: string, to: string): Promise<Appointment[]>;
  createAppointment(input: AppointmentInput): Promise<Appointment>;
  updateAppointmentStatus(id: string, status: Appointment["status"]): Promise<Appointment>;

  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(ids: string[]): Promise<void>;
  listConversations(): Promise<Conversation[]>;
  listMessages(peerId: string): Promise<Message[]>;
  sendMessage(peerId: string, body: string, patientId?: string | null): Promise<Message>;

  listReports(): Promise<ReportRecord[]>;
  requestReport(input: ReportRequest): Promise<ReportRecord>;

  listStaff(role?: StaffRole): Promise<StaffMember[]>;
  setStaffStatus(profileId: string, status: StaffStatus): Promise<StaffMember>;
  listDevices(): Promise<DeviceRecord[]>;
  assignDevice(deviceId: string, patientId: string): Promise<DeviceRecord>;
  listFacilities(): Promise<Facility[]>;
  listAccessRequests(): Promise<AccessRequest[]>;
  reviewAccessRequest(id: string, decision: "approved" | "rejected", note?: string): Promise<AccessRequest>;
  listAuditLogs(filter?: AuditFilter): Promise<AuditEntry[]>;
  listAlertRules(): Promise<AlertRule[]>;
  updateGlobalThresholds(thresholds: AlertThresholds): Promise<AlertRule>;

  getOverviewCounts(): Promise<OverviewCounts>;
  getSystemHealth(): Promise<SystemHealth>;
  getAnalytics(days: number): Promise<AnalyticsData>;
}
