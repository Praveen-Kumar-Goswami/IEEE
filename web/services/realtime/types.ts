import type {
  AppNotification,
  CareTask,
  DeviceHealth,
  IndicatorAlert,
  Message,
  MonitoringStatus,
  ReadingSample,
} from "@/types/domain";

export type RealtimeEvent =
  | { type: "reading.created"; patientId: string; deviceId: string; reading: ReadingSample }
  | { type: "alert.created"; alert: IndicatorAlert }
  | { type: "alert.updated"; alert: IndicatorAlert }
  | { type: "device.status"; deviceId: string; serial: string; patientId: string | null; health: DeviceHealth; at: string }
  | { type: "patient.status"; patientId: string; monitoringStatus: MonitoringStatus }
  | { type: "notification.created"; notification: AppNotification }
  | { type: "message.created"; message: Message }
  | { type: "task.updated"; task: CareTask };

export type RealtimeHandler = (event: RealtimeEvent) => void;

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export interface RealtimeSource {
  readonly mode: "demo" | "supabase";
  subscribe(handler: RealtimeHandler): () => void;
  onConnectionChange(handler: (state: ConnectionState) => void): () => void;
  start(): void;
  stop(): void;
}
