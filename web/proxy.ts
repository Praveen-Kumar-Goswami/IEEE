import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { ROLE_HOME, roleForPath } from "@/lib/auth/roles";
import { decodeStaffSession, STAFF_SESSION_COOKIE } from "@/lib/auth/staff-session";
import { readSession } from "@/lib/supabase/proxy";
import type { AppRole } from "@/types/domain";

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const required = roleForPath(pathname);

  let role: AppRole | null = null;
  let response = NextResponse.next({ request });

  const staff = decodeStaffSession(request.cookies.get(STAFF_SESSION_COOKIE)?.value);
  if (staff) {
    role = staff.role;
  } else if (!env.demoMode) {
    const session = await readSession(request);
    role = session.role;
    response = session.response();
  }

  if (required && !staff && role !== required) {
    if (!role) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${pathname}${search}`);
      return redirectWithCookies(login, response);
    }
    const denied = new URL("/unauthorized", request.url);
    denied.searchParams.set("from", pathname);
    return redirectWithCookies(denied, response);
  }

  if (pathname === "/login" && (staff || role === "doctor" || role === "nurse" || role === "admin")) {
    return redirectWithCookies(new URL(staff ? ROLE_HOME[staff.role] : ROLE_HOME[role as "doctor" | "nurse" | "admin"], request.url), response);
  }

  return response;
}

export const config = {
  matcher: ["/doctor/:path*", "/nurse/:path*", "/admin/:path*", "/login"],
};
