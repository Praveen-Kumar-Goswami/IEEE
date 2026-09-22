import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { DEMO_VIEWERS } from "@/services/data/demo/viewers";
import type { AppRole, StaffRole, Viewer } from "@/types/domain";
import { isAppRole, isStaffRole } from "./roles";
import { decodeStaffSession, STAFF_SESSION_COOKIE } from "./staff-session";

function workspaceViewer(role: StaffRole, session: { email: string; fullName: string }): Viewer {
  return { ...DEMO_VIEWERS[role], fullName: session.fullName, email: session.email };
}

export type AuthState =
  | { status: "signed_out" }
  | { status: "patient" }
  | { status: "staff"; viewer: Viewer };

/** Server-side identity for layouts. proxy.ts has already rejected the wrong roles. */
export async function getAuthState(): Promise<AuthState> {
  const session = decodeStaffSession((await cookies()).get(STAFF_SESSION_COOKIE)?.value);
  if (session) return { status: "staff", viewer: workspaceViewer(session.role, session) };

  if (env.demoMode) return { status: "signed_out" };

  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string; app_metadata?: { role?: unknown } } | undefined;
  if (!claims?.sub) return { status: "signed_out" };

  const role: AppRole | null = isAppRole(claims.app_metadata?.role) ? (claims.app_metadata!.role as AppRole) : null;
  if (role === "patient") return { status: "patient" };
  if (!isStaffRole(role)) return { status: "signed_out" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, staff_profiles(title, department, facilities(name))")
    .eq("id", claims.sub)
    .maybeSingle();

  type StaffRow = { title: string | null; department: string | null; facilities: { name: string } | null };
  const staff = (profile?.staff_profiles ?? null) as StaffRow | StaffRow[] | null;
  const staffRow = Array.isArray(staff) ? staff[0] : staff;

  // The database row is the source of truth if the claim is stale.
  const dbRole = profile?.role;
  if (!isStaffRole(dbRole)) return dbRole === "patient" ? { status: "patient" } : { status: "signed_out" };

  return {
    status: "staff",
    viewer: {
      id: claims.sub,
      fullName: profile?.full_name ?? claims.email ?? "Staff member",
      email: claims.email ?? "",
      role: dbRole,
      title: staffRow?.title ?? null,
      department: staffRow?.department ?? null,
      facilityName: staffRow?.facilities?.name ?? null,
    },
  };
}
