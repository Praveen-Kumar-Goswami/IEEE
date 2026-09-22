"use client";

import { sparkPath } from "@/utils/path";
import { Badge, StatusDot } from "@/components/ui/badge";
import type { ApiHealth } from "@/hooks/use-api-health";
import type { ServiceStatus } from "@/types/domain";

/** Service rows with the API row replaced by the live /health measurement when one is configured. */
export function withLiveApi(services: ServiceStatus[], api: ApiHealth) {
  return services.map((s) =>
    s.id === "api" && api.configured
      ? {
          ...s,
          live: true,
          checking: api.status === "checking",
          status: api.status === "down" ? ("down" as const) : ("operational" as const),
          latencyMs: api.latencyMs,
          history: api.history.map((h) => h ?? 0),
          detail: api.status === "down" ? "No response from the Lambda function URL" : "Lambda function URL, measured from this server",
        }
      : { ...s, live: false, checking: false },
  );
}

export function SystemStatus({ services, api, detailed }: { services: ServiceStatus[]; api: ApiHealth; detailed?: boolean }) {
  return (
    <ul className="divide-y divide-(--line)">
      {withLiveApi(services, api).map((s) => {
        const tone = s.checking ? "neutral" : s.status === "operational" ? "signal" : s.status === "degraded" ? "watch" : "critical";
        return (
          <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
            <StatusDot tone={tone} pulse={s.live && s.status === "operational" && !s.checking} label={s.checking ? "Checking" : s.status} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-small text-bone">
                {s.name}
                {s.live && (
                  <Badge tone="signal" className="h-5 px-1.5 text-[9px]">
                    Live
                  </Badge>
                )}
              </p>
              <p className="truncate text-[11.5px] text-graphite-400">{detailed ? s.detail : `${s.uptimePercent}% uptime`}</p>
            </div>
            <span className="tabular w-16 shrink-0 text-right font-mono text-[11px] text-graphite-200">{s.checking ? "…" : s.status === "down" ? "down" : s.latencyMs != null ? `${s.latencyMs} ms` : "--"}</span>
            <svg viewBox="0 0 60 20" preserveAspectRatio="none" className="hidden h-5 w-16 shrink-0 sm:block" aria-hidden>
              <path d={sparkPath(s.history, 60, 20)} fill="none" stroke={s.live ? "var(--color-signal)" : "var(--color-graphite-400)"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
          </li>
        );
      })}
    </ul>
  );
}
