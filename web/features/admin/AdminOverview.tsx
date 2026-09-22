"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Cpu, ShieldAlert, UserCheck, Users } from "lucide-react";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { formatRelative } from "@/utils/format";
import { useApiHealth } from "@/hooks/use-api-health";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { CHART, ChartLegend } from "@/components/charts/theme";
import { ActivityChart } from "@/components/charts/analytics";
import { Card } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Avatar } from "@/components/ui/misc";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/dashboard/context";
import { useGreeting } from "@/features/dashboard/Greeting";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import { describeAction, describeTarget, RESULT_TONE } from "./audit-format";
import { SystemStatus } from "./SystemStatus";

export function AdminOverview() {
  const { data, viewer, home } = useWorkspace();
  const hello = useGreeting(viewer);
  const reduced = useReducedMotion();
  const api = useApiHealth(true, 10_000);
  const counts = useQuery({ queryKey: ["overview"], queryFn: () => data.getOverviewCounts() });
  const health = useQuery({ queryKey: ["health"], queryFn: () => data.getSystemHealth(), refetchInterval: 30_000 });
  const analytics = useQuery({ queryKey: ["analytics", 30], queryFn: () => data.getAnalytics(30) });
  const approvals = useQuery({ queryKey: ["approvals"], queryFn: () => data.listAccessRequests() });
  const audit = useQuery({ queryKey: ["audit", "recent"], queryFn: () => data.listAuditLogs({ limit: 8 }) });

  const c = counts.data;
  const pending = (approvals.data ?? []).filter((r) => r.status === "pending");
  const degraded = health.data?.services.filter((s) => s.status !== "operational").length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={hello.date}
        title={hello.title}
        description={
          c
            ? `${c.activeAlerts} active indicator${c.activeAlerts === 1 ? "" : "s"} across the platform, ${c.pendingApprovals} access request${c.pendingApprovals === 1 ? "" : "s"} waiting${degraded ? `, and ${degraded} service${degraded === 1 ? "" : "s"} degraded` : ""}.`
            : "Loading the platform…"
        }
      />
      <div className="stagger-in grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active staff" value={c ? c.doctors + c.nurses : undefined} icon={<Users />} href={`${home}/doctors`} hint={c ? `${c.doctors} doctors · ${c.nurses} nurses` : undefined} />
        <MetricCard label="Monitored patients" value={c?.patients} href={`${home}/patients`} hint={c ? `${c.activeAlerts} active indicators` : undefined} />
        <MetricCard label="Devices online" value={c?.onlineDevices} icon={<Cpu />} tone="signal" href={`${home}/devices`} hint={c ? `${c.warningDevices} warning · ${c.offlineDevices} offline of ${c.devices}` : undefined} />
        <MetricCard label="Pending approvals" value={c?.pendingApprovals} icon={<UserCheck />} tone="watch" emphasis href={`${home}/approvals`} />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7 xl:col-span-8">
          <SectionTitle title="Monitoring activity" meta="Last 30 days" />
          <div className="px-5 pb-5">
            <ChartLegend
              className="mb-4"
              items={[
                { label: "Readings", color: CHART.series.signal },
                { label: "Bedside check-ins", color: CHART.series.bone, dashed: true },
              ]}
            />
            <div className="h-[260px]">{analytics.data ? <ActivityChart data={analytics.data} reduced={reduced} /> : <Skeleton className="size-full" />}</div>
          </div>
        </Card>
        <Card className="lg:col-span-5 xl:col-span-4">
          <SectionTitle
            title="System status"
            actions={
              <Link href={`${home}/integrations`} className="text-small text-graphite-300 transition-colors hover:text-bone">
                Details
              </Link>
            }
          />
          <div className="border-t border-(--line)">{health.data ? <SystemStatus services={health.data.services} api={api} /> : <SkeletonRows rows={6} />}</div>
          {health.data && <p className="border-t border-(--line) px-5 py-3 text-[11.5px] text-graphite-400">Checked {formatRelative(health.data.checkedAt)}. The API row is measured live.</p>}
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <SectionTitle
            title="Access requests"
            meta={approvals.data ? `${pending.length} pending` : undefined}
            actions={
              <Link href={`${home}/approvals`} className="flex items-center gap-1.5 text-small text-graphite-300 transition-colors hover:text-bone">
                Review <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <ul className="divide-y divide-(--line) border-t border-(--line)">
            {!approvals.data && (
              <li>
                <SkeletonRows rows={3} />
              </li>
            )}
            {approvals.data && pending.length === 0 && <li className="px-5 py-8 text-center text-small text-graphite-400">No requests waiting.</li>}
            {pending.slice(0, 4).map((r) => (
              <li key={r.id}>
                <Link href={`${home}/approvals`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                  <Avatar name={r.requester.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small text-bone">{r.requester.name}</p>
                    <p className="truncate text-[12px] text-graphite-400">
                      {ROLE_LABEL[r.requestedRole]} · {r.department ?? r.facilityName ?? "No unit given"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] text-graphite-400">{formatRelative(r.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-7">
          <SectionTitle
            title="Recent activity"
            meta="Audit log"
            actions={
              <Link href={`${home}/audit`} className="flex items-center gap-1.5 text-small text-graphite-300 transition-colors hover:text-bone">
                Full log <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <ul className="divide-y divide-(--line) border-t border-(--line)">
            {!audit.data && (
              <li>
                <SkeletonRows rows={6} />
              </li>
            )}
            {audit.data?.map((e) => {
              const target = describeTarget(e);
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <StatusDot tone={RESULT_TONE[e.result]} label={e.result} />
                  <p className="min-w-0 flex-1 truncate text-small text-graphite-100">
                    <span className="text-bone">{e.actor?.name ?? "Unknown user"}</span> <span className="text-graphite-400">·</span> {describeAction(e.action)}
                    {target && <span className="text-graphite-400"> · {target}</span>}
                  </p>
                  {e.result !== "success" && (
                    <Badge tone={RESULT_TONE[e.result]} className="shrink-0">
                      <ShieldAlert className="size-3" /> {e.result}
                    </Badge>
                  )}
                  <span className="shrink-0 font-mono text-[10.5px] text-graphite-400">{formatRelative(e.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
