import type { Tone } from "@/lib/domain/labels";
import type { AuditEntry } from "@/types/domain";

const ACTIONS: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "patient_profiles.read": "Opened a patient record",
  "indicator_alerts.acknowledge": "Acknowledged an indicator",
  "indicator_alerts.resolve": "Resolved an indicator",
  "indicator_alerts.escalate": "Notified the doctor",
  "clinical_notes.insert": "Wrote a clinical note",
  "care_plans.insert": "Updated a care plan",
  "care_tasks.update": "Updated a task",
  "patient_checkins.insert": "Recorded a check-in",
  "appointments.insert": "Booked an appointment",
  "appointments.update": "Changed an appointment",
  "reports.insert": "Requested a report",
  "staff_profiles.suspend": "Suspended an account",
  "staff_profiles.reactivate": "Reactivated an account",
  "devices.assign": "Assigned a device",
  "access_requests.approve": "Approved access",
  "access_requests.reject": "Rejected access",
  "profiles.role_change": "Changed a role",
  "alert_rules.update": "Changed alert thresholds",
  "security.policy_update": "Changed a security policy",
};

export const RESULT_TONE: Record<AuditEntry["result"], Tone> = { success: "signal", denied: "attention", failed: "critical" };

export function describeAction(action: string) {
  return ACTIONS[action] ?? action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** The most useful metadata value to show beside the action. */
export function describeTarget(entry: AuditEntry) {
  const m = entry.metadata;
  const pick = m.patient ?? m.name ?? m.requester ?? m.serial ?? m.reason ?? m.role ?? m.status ?? m.type ?? null;
  return pick == null ? null : String(pick).replace(/_/g, " ");
}

export function describeMetadata(entry: AuditEntry) {
  return Object.entries(entry.metadata)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
    .join(" · ");
}
