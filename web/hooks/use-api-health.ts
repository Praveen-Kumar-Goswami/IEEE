"use client";

import { useEffect, useState } from "react";
import { env } from "@/lib/env";
import { pingApi } from "@/services/data/supabase/api";

export interface ApiHealth {
  configured: boolean;
  status: "checking" | "operational" | "down";
  latencyMs: number | null;
  /** Most recent round trips, oldest first. Failed checks are null. */
  history: (number | null)[];
  checkedAt: number | null;
}

const HISTORY = 24;

/** Polls GET /health on the deployed Lambda (through /api/backend) while `enabled`. */
export function useApiHealth(enabled: boolean, intervalMs = 5000): ApiHealth {
  const [state, setState] = useState<ApiHealth>({
    configured: Boolean(env.apiBaseUrl),
    status: env.apiBaseUrl ? "checking" : "down",
    latencyMs: null,
    history: [],
    checkedAt: null,
  });

  useEffect(() => {
    if (!enabled || !env.apiBaseUrl) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const latency = await pingApi();
      if (cancelled) return;
      setState((prev) => ({
        configured: true,
        status: latency == null ? "down" : "operational",
        latencyMs: latency,
        history: [...prev.history, latency].slice(-HISTORY),
        checkedAt: Date.now(),
      }));
      timer = setTimeout(check, intervalMs);
    };
    void check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, intervalMs]);

  return state;
}
