import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Calls the Lambda API (backend/) through the same-origin proxy with the signed-in user's access token. */
export async function callApi<T>(supabase: SupabaseClient, path: string, body: unknown): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new Error("This action goes through the Lambda API. Set NEXT_PUBLIC_API_BASE_URL to the deployed function URL.");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const response = await fetch(`${env.apiProxyPath}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (response.status === 401) throw new Error(json?.error?.message ?? "The API rejected your session. Sign in again.");
  if (!response.ok) throw new Error(json?.error?.message ?? `Request failed with status ${response.status}.`);
  return json as T;
}

/** Round trip to GET /health in milliseconds, or null when the API is unset or unreachable. */
export async function pingApi(): Promise<number | null> {
  if (!env.apiBaseUrl) return null;
  const started = performance.now();
  try {
    const response = await fetch(`${env.apiProxyPath}/health`, { cache: "no-store" });
    return response.ok ? Math.round(performance.now() - started) : null;
  } catch {
    return null;
  }
}
