import type { StaffRole } from "@/types/domain";
import { isStaffRole } from "./roles";
import { staffAccountForEmail } from "./staff-accounts";

export const STAFF_SESSION_COOKIE = "tend_staff";

export type StaffSession = { email: string; fullName: string; role: StaffRole };

export function encodeStaffSession(session: StaffSession) {
  const bytes = new TextEncoder().encode(JSON.stringify(session));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeStaffSession(value: string | undefined | null): StaffSession | null {
  if (!value) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<StaffSession>;
    if (!parsed.email || !parsed.fullName) return null;
    const known = staffAccountForEmail(parsed.email);
    const role = isStaffRole(parsed.role) ? parsed.role : known?.role ?? "admin";
    return { email: parsed.email, fullName: parsed.fullName, role };
  } catch {
    return null;
  }
}
