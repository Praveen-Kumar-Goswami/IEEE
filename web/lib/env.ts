const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const env = {
  supabaseUrl,
  supabaseKey,
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://hs2vdl7ablstozg4sg5s4o3uiu0dnvqj.lambda-url.us-east-1.on.aws").replace(/\/$/, ""),
  /** Same-origin route that forwards to apiBaseUrl (app/api/backend). */
  apiProxyPath: "/api/backend",
  /** Demo mode runs the full UI on deterministic sample data with no backend. */
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !supabaseUrl || !supabaseKey,
} as const;

export const DEMO_ROLE_COOKIE = "tend_demo_role";
