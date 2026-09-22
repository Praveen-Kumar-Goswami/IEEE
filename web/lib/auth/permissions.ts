import type { StaffRole } from "@/types/domain";

export const PERMISSIONS = {
  "patients.read_assigned": "View assigned patients",
  "patients.read_all": "View every patient",
  "monitoring.live": "Live monitoring",
  "alerts.acknowledge": "Acknowledge indicators",
  "alerts.resolve": "Resolve indicators",
  "alerts.escalate": "Notify the doctor",
  "notes.create": "Write clinical notes",
  "care_plans.write": "Write care plans",
  "tasks.complete": "Complete and delay tasks",
  "checkins.create": "Record bedside check-ins",
  "appointments.manage": "Manage appointments",
  "reports.export": "Export reports",
  "users.manage": "Manage staff accounts",
  "approvals.review": "Review access requests",
  "devices.manage": "Assign and retire devices",
  "rules.configure": "Configure alert thresholds",
  "audit.read": "Read the audit log",
  "security.configure": "Security policies",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  doctor: [
    "patients.read_assigned",
    "monitoring.live",
    "alerts.acknowledge",
    "alerts.resolve",
    "notes.create",
    "care_plans.write",
    "appointments.manage",
    "reports.export",
  ],
  nurse: [
    "patients.read_assigned",
    "monitoring.live",
    "alerts.acknowledge",
    "alerts.escalate",
    "notes.create",
    "tasks.complete",
    "checkins.create",
  ],
  admin: [
    "patients.read_all",
    "monitoring.live",
    "alerts.acknowledge",
    "alerts.resolve",
    "notes.create",
    "reports.export",
    "users.manage",
    "approvals.review",
    "devices.manage",
    "rules.configure",
    "audit.read",
    "security.configure",
  ],
};

export function can(role: StaffRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
