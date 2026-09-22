import { createClient } from "@supabase/supabase-js";
import { createApp, type AppDeps } from "./app.js";
import { readConfig } from "./config.js";
import type { Database } from "./data/database.js";
import { SupabaseDatabase } from "./data/supabase-database.js";
import type { Actor } from "./domain/authz.js";
import { ApiError } from "./errors.js";
import { createLogger } from "./logger.js";

function unconfiguredDatabase(): Database {
  return new Proxy({} as Database, {
    get(_target, property) {
      if (property === "then") return undefined;
      return async () => {
        throw new ApiError(500, "configuration_error", "The API is not configured.");
      };
    },
  });
}

export function createRuntime(env: NodeJS.ProcessEnv, overrides: Partial<AppDeps> = {}) {
  const config = readConfig(env);
  const logger = overrides.logger ?? createLogger(config.logLevel);
  const configured = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
  if (!configured) {
    return createApp({
      authenticate: overrides.authenticate ?? (async () => {
        throw new ApiError(500, "configuration_error", "The API is not configured.");
      }),
      db: overrides.db ?? unconfiguredDatabase(),
      logger,
      now: overrides.now,
      corsAllowedOrigins: config.corsAllowedOrigins,
    });
  }
  let client;
  try {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch (error) {
    logger.error({ event: "configuration_error", reason: error instanceof Error ? error.name : "invalid_config" });
    return createApp({
      authenticate: async () => {
        throw new ApiError(500, "configuration_error", "The API is not configured.");
      },
      db: unconfiguredDatabase(),
      logger,
      now: overrides.now,
      corsAllowedOrigins: config.corsAllowedOrigins,
    });
  }
  const db = overrides.db ?? new SupabaseDatabase(client);
  return createApp({
    authenticate: overrides.authenticate ?? (async (token: string): Promise<Actor | null> => {
      const result = await client.auth.getUser(token);
      if (result.error || !result.data.user) return null;
      return db.getActor(result.data.user.id);
    }),
    db,
    logger,
    now: overrides.now,
    corsAllowedOrigins: config.corsAllowedOrigins,
  });
}
