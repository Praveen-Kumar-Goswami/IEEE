"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Radio, Server, Smartphone } from "lucide-react";
import { cn } from "@/utils/cn";
import { env } from "@/lib/env";
import { formatNumber, formatRelative } from "@/utils/format";
import { sparkPath } from "@/utils/path";
import { useApiHealth } from "@/hooks/use-api-health";
import { useLiveStore } from "@/stores/live";
import { Card } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { KeyValue } from "@/components/ui/misc";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import { SystemStatus } from "./SystemStatus";

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function IntegrationsView() {
  const { data } = useWorkspace();
  const api = useApiHealth(true, 5000);
  const connection = useLiveStore((s) => s.connection);
  const health = useQuery({ queryKey: ["health"], queryFn: () => data.getSystemHealth(), refetchInterval: 30_000 });
  const h = health.data;
  const apiTone = !api.configured ? "offline" : api.status === "checking" ? "neutral" : api.status === "operational" ? "signal" : "critical";
  const measured = api.history.filter((v): v is number => v != null);
  const mean = measured.length ? Math.round(measured.reduce((s, v) => s + v, 0) / measured.length) : null;

  return (
    <>
      <PageHeader eyebrow="Platform" title="Integrations" description="The services behind the workspace and how each one is doing. The API row is measured live from this deployment." />
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <Header icon={<Server />} title="Smart dressing API" subtitle="AWS Lambda function URL" status={<StatusDot tone={apiTone} pulse={api.status === "operational"} label={api.configured ? api.status : "not configured"} />} />
          <div className="border-t border-(--line) px-5 py-5">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-label text-graphite-400">Round trip</p>
                <p className="tabular mt-1.5 text-[2.4rem] font-light leading-none tracking-[-0.03em] text-bone">
                  {api.latencyMs ?? "--"}
                  <span className="ml-1.5 font-mono text-small text-graphite-400">ms</span>
                </p>
                <p className="mt-2 text-[12px] text-graphite-400">
                  {mean != null ? `Mean ${mean} ms over ${measured.length} checks` : api.configured ? "Waiting for the first check" : "Set NEXT_PUBLIC_API_BASE_URL to enable"}
                </p>
              </div>
              <svg viewBox="0 0 240 56" preserveAspectRatio="none" className="h-14 w-full max-w-[18rem]" aria-hidden>
                <path d={sparkPath(api.history.map((v) => v ?? 0), 240, 56)} fill="none" stroke="var(--color-signal)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </div>
          <dl className="divide-y divide-(--line) border-t border-(--line) px-5">
            <KeyValue label="Endpoint" value={<span className="font-mono text-[12px]">{env.apiBaseUrl ? host(env.apiBaseUrl) : "--"}</span>} />
            <KeyValue label="Browser route" value={<span className="font-mono text-[12px]">{env.apiProxyPath}/*</span>} />
            <KeyValue label="Health check" value={<span className="font-mono text-[12px]">GET /health every 5 s</span>} />
            <KeyValue label="Last check" value={api.checkedAt ? formatRelative(api.checkedAt) : "--"} />
          </dl>
        </Card>

        <div className="space-y-4 lg:col-span-5">
          <Card>
            <Header
              icon={<Database />}
              title="Supabase"
              subtitle="Postgres, Auth and Realtime"
              status={env.demoMode ? <Badge tone="watch">Demo data</Badge> : <Badge tone="signal">Connected</Badge>}
            />
            <dl className="divide-y divide-(--line) border-t border-(--line) px-5">
              <KeyValue label="Project" value={<span className="font-mono text-[12px]">{env.supabaseUrl ? host(env.supabaseUrl) : "Not configured"}</span>} />
              <KeyValue label="Data source" value={env.demoMode ? "Deterministic sample unit" : "Live database with row level security"} />
              <KeyValue label="Realtime" value={<span className="capitalize">{connection}</span>} />
              <KeyValue label="Connected clients" value={h ? formatNumber(h.realtime.connectedClients) : "--"} />
            </dl>
          </Card>
          <Card>
            <Header icon={<Smartphone />} title="Android sync" subtitle="Phone gateway batches" status={h ? <StatusDot tone={h.sync.successRate > 98 ? "signal" : "watch"} label="sync" /> : null} />
            <dl className="divide-y divide-(--line) border-t border-(--line) px-5">
              <KeyValue label="Readings last hour" value={h ? formatNumber(h.sync.readingsLastHour) : "--"} />
              <KeyValue label="Pending batches" value={h ? h.sync.pendingBatches : "--"} />
              <KeyValue label="Success rate" value={h ? `${formatNumber(h.sync.successRate, 1)}%` : "--"} />
              <KeyValue label="Last batch" value={h?.sync.lastBatchAt ? formatRelative(h.sync.lastBatchAt) : "--"} />
            </dl>
          </Card>
        </div>

        <Card className="lg:col-span-7">
          <SectionTitle title="Services" meta={h ? `Checked ${formatRelative(h.checkedAt)}` : undefined} />
          <div className="border-t border-(--line)">{h ? <SystemStatus services={h.services} api={api} detailed /> : <SkeletonRows rows={6} />}</div>
        </Card>
        <Card className="lg:col-span-5">
          <Header icon={<Radio />} title="Realtime events" subtitle={`Per minute, last ${h?.realtime.eventsPerMinute.length ?? 30} minutes`} />
          <div className="border-t border-(--line) px-5 py-5">
            {h ? <EventBars values={h.realtime.eventsPerMinute} /> : <SkeletonRows rows={3} />}
            {h && (
              <div className="mt-6">
                <div className="flex items-baseline justify-between text-small">
                  <span className="text-graphite-300">Storage</span>
                  <span className="tabular font-mono text-[12px] text-bone">
                    {formatNumber(h.storage.usedGb, 1)} <span className="text-graphite-400">/ {h.storage.totalGb} GB</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-graphite-800">
                  <div className={cn("h-full rounded-full", h.storage.usedGb / h.storage.totalGb > 0.8 ? "bg-watch" : "bg-signal")} style={{ width: `${(h.storage.usedGb / h.storage.totalGb) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function Header({ icon, title, subtitle, status }: { icon: ReactNode; title: string; subtitle: string; status?: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4">
      <span className="flex size-9 items-center justify-center rounded-md border border-(--line) text-graphite-200 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-bone">{title}</p>
        <p className="text-[12px] text-graphite-400">{subtitle}</p>
      </div>
      {status}
    </div>
  );
}

function EventBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-24 items-end gap-[2px]" role="img" aria-label={`Realtime events per minute, peak ${max}`}>
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-t-[1px] bg-signal/70" style={{ height: `${Math.max(3, (v / max) * 100)}%`, opacity: 0.35 + (i / values.length) * 0.65 }} />
      ))}
    </div>
  );
}
