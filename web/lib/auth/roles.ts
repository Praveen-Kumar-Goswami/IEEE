import type { AppRole, StaffRole } from "@/types/domain";

export const STAFF_ROLES: StaffRole[] = ["doctor", "nurse", "admin"];

export const ROLE_HOME: Record<StaffRole, string> = {
  doctor: "/doctor",
  nurse: "/nurse",
  admin: "/admin",
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value);
}

export function isAppRole(value: unknown): value is AppRole {
  return value === "patient" || isStaffRole(value);
}

/** The role a protected path belongs to, or null for public paths. */
export function roleForPath(pathname: string): StaffRole | null {
  const segment = pathname.split("/")[1];
  return isStaffRole(segment) ? segment : null;
}

/** Only same-origin relative paths are accepted as a post-login destination. */
export function safeNextPath(next: string | null | undefined, role: StaffRole): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return ROLE_HOME[role];
  return roleForPath(next) === role ? next : ROLE_HOME[role];
}

/** One staff session may open the doctor, nurse, or admin workspace. */
export function safeStaffPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return ROLE_HOME.admin;
  return roleForPath(next) ? next : ROLE_HOME.admin;
}
