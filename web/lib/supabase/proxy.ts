import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import type { AppRole } from "@/types/domain";
import { isAppRole } from "@/lib/auth/roles";

/**
 * Refreshes the Supabase session cookie and returns the verified role claim.
 * The role comes from app_metadata, which only the sync_profile_claims trigger writes.
 */
export async function readSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; app_metadata?: { role?: unknown } } | undefined;
  const role: AppRole | null = isAppRole(claims?.app_metadata?.role) ? (claims!.app_metadata!.role as AppRole) : null;

  return { response: () => response, userId: claims?.sub ?? null, role };
}
