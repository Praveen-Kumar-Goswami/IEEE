"use server";

import { cookies } from "next/headers";
import { DEMO_ROLE_COOKIE, env } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeStaffPath } from "./roles";
import { encodeStaffSession, STAFF_SESSION_COOKIE } from "./staff-session";

const SESSION_SECONDS = 8 * 60 * 60;

/** One staff sign-in. Credentials are checked by the Lambda, which talks to Supabase Auth. */
export async function signInStaff(email: string, password: string, next?: string | null) {
  if (!env.apiBaseUrl) return { ok: false as const, error: "The Lambda API is not configured." };
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false as const, error: "The Lambda API could not be reached. Try again in a moment." };
  }

  const body = (await response.json().catch(() => null)) as { error?: { message?: string }; session?: { email?: string; full_name?: string } } | null;
  if (!response.ok || !body?.session?.email) {
    return { ok: false as const, error: body?.error?.message || "That email and password do not match an account." };
  }

  const store = await cookies();
  store.set(
    STAFF_SESSION_COOKIE,
    encodeStaffSession({ email: body.session.email, fullName: body.session.full_name?.trim() || body.session.email }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_SECONDS,
    },
  );
  return { ok: true as const, redirectTo: safeStaffPath(next) };
}

export async function signOut() {
  const store = await cookies();
  store.delete(STAFF_SESSION_COOKIE);
  store.delete(DEMO_ROLE_COOKIE);
  if (!env.demoMode) {
    const supabase = await getServerSupabase();
    await supabase.auth.signOut();
  }
  return { ok: true as const };
}
