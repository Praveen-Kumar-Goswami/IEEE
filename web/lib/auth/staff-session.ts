export const STAFF_SESSION_COOKIE = "tend_staff";

export type StaffSession = { email: string; fullName: string };

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
    return { email: parsed.email, fullName: parsed.fullName };
  } catch {
    return null;
  }
}
