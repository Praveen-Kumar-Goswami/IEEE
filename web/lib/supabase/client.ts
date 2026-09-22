"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!client) client = createBrowserClient(env.supabaseUrl, env.supabaseKey);
  return client;
}
