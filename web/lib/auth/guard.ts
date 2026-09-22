import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_VIEWERS } from "@/services/data/demo/viewers";
import type { StaffRole, Viewer } from "@/types/domain";
import { ROLE_HOME } from "./roles";
import { decodeStaffSession, STAFF_SESSION_COOKIE } from "./staff-session";

/**
 * One Lambda session opens every workspace. The route decides which feature UI
 * is shown; the signed-in name and email stay the account from the Lambda.
 */
export async function requireViewer(role: StaffRole): Promise<Viewer> {
  const session = decodeStaffSession((await cookies()).get(STAFF_SESSION_COOKIE)?.value);
  if (!session) redirect(`/login?next=${ROLE_HOME[role]}`);
  return { ...DEMO_VIEWERS[role], fullName: session.fullName, email: session.email };
}
