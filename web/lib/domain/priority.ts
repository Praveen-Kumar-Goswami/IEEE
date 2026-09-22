import type { AlertSeverity, AlertStatus, DeviceHealth, MonitoringStatus, ReviewPriority } from "@/types/domain";

export const PRIORITY_ORDER: Record<ReviewPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Ranks the review queue from open indicators and device state.
 * Critical: an attention-severity indicator nobody has acknowledged yet.
 * High: attention status that has been acknowledged, or several open indicators.
 * Medium: watch status, one open indicator, or a device that is not reporting.
 */
export function derivePriority(input: {
  monitoringStatus: MonitoringStatus;
  openAttentionCount: number;
  openAlertCount: number;
  acknowledgedAlertCount: number;
}): ReviewPriority {
  if (input.openAttentionCount > 0) return "critical";
  if (input.monitoringStatus === "attention" || input.openAlertCount >= 2) return "high";
  if (input.monitoringStatus === "watch" || input.monitoringStatus === "offline" || input.openAlertCount === 1) {
    return "medium";
  }
  if (input.acknowledgedAlertCount > 0) return "medium";
  return "low";
}

/** Mirrors backend rollupStatus: offline wins, then attention, then watch. */
export function rollupMonitoringStatus(input: {
  deviceHealth: DeviceHealth | null;
  activeSeverities: { severity: AlertSeverity; status: AlertStatus }[];
}): MonitoringStatus {
  if (input.deviceHealth === "offline") return "offline";
  const active = input.activeSeverities.filter((a) => a.status !== "resolved");
  if (active.some((a) => a.severity === "attention")) return "attention";
  if (active.length > 0) return "watch";
  return "normal";
}
