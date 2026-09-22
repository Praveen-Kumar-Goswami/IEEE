import { BellRing, Cpu, ListChecks, MessagesSquare, Settings2, Siren, UserCheck, type LucideIcon } from "lucide-react";
import type { NotificationKind } from "@/types/domain";

export const NOTIFICATION_ICON: Record<NotificationKind, LucideIcon> = {
  indicator_alert: BellRing,
  alert_escalation: Siren,
  task: ListChecks,
  message: MessagesSquare,
  device: Cpu,
  approval: UserCheck,
  system: Settings2,
};
