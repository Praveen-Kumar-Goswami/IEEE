import { existsSync, readFileSync } from "node:fs";

export type AppConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  corsAllowedOrigins: string[];
  logLevel: string;
  port: number;
};

export function loadDotEnv(file = ".env"): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function readConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = Number(env.PORT ?? 43127);
  return {
    supabaseUrl: clean(env.SUPABASE_URL),
    supabaseServiceRoleKey: clean(env.SUPABASE_SERVICE_ROLE_KEY),
    corsAllowedOrigins: (env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    logLevel: env.LOG_LEVEL?.trim() || "info",
    port: Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 43127,
  };
}

function clean(value: string | undefined): string {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "");
}
