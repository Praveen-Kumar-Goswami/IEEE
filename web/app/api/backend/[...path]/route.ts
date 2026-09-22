import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Forwards browser calls to the Lambda API. The function URL does not allow the
 * Authorization header cross-origin, so the web app never calls it directly.
 * Cookies are not forwarded; the Lambda authenticates with the bearer token only.
 */
const FORWARDED_HEADERS = ["authorization", "content-type", "x-request-id"] as const;
const ALLOWED_PATH = /^(health|v1(\/[A-Za-z0-9_-]+)+)$/;
const TIMEOUT_MS = 15_000;

function problem(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!env.apiBaseUrl) return problem(503, "api_not_configured", "Set NEXT_PUBLIC_API_BASE_URL to the Lambda function URL.");

  const target = (await params).path.join("/");
  if (!ALLOWED_PATH.test(target)) return problem(404, "not_found", "Unknown API route.");

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(`${env.apiBaseUrl}/${target}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return timedOut
      ? problem(504, "upstream_timeout", "The API did not respond in time.")
      : problem(502, "upstream_unreachable", "The API could not be reached.");
  }
}

export { forward as GET, forward as POST, forward as PATCH };
