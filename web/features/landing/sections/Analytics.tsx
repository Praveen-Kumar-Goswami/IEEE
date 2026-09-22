"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { sparkPath } from "@/utils/path";
import { gsap, useGSAP } from "@/lib/motion/gsap";
import { useInView } from "@/hooks/use-in-view";
import { useApiHealth } from "@/hooks/use-api-health";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { CHART, ChartLegend } from "@/components/charts/theme";
import { ActivityChart, DeviceChart, Heatmap, PriorityBars } from "@/components/charts/analytics";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsData, OverviewCounts, ServiceStatus, SystemHealth } from "@/types/domain";
import { SectionLabel } from "../components/SectionLabel";

interface Snapshot {
  analytics: AnalyticsData;
  health: SystemHealth;
  overview: OverviewCounts;
}

const DAYS = 30;

export function Analytics() {
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const near = useInView(root, { margin: "800px", once: true });
  const shown = useInView(panel, { margin: "-12% 0px", once: true });
  const visible = useInView(root, { margin: "0px" });
  const api = useApiHealth(visible);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!near || data) return;
    let cancelled = false;
    void import("@/services/data/demo/state").then(({ getDemoState }) => {
      if (cancelled) return;
      const s = getDemoState();
      setData({ analytics: s.analytics(DAYS), health: s.health(), overview: s.overview() });
    });
    return () => {
      cancelled = true;
    };
  }, [near, data]);

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-an-head] > *"), {
        opacity: 0,
        y: 28,
        duration: 1.1,
        stagger: 0.08,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
      });
      gsap.from(q("[data-an-card]"), {
        opacity: 0,
        y: 40,
        duration: 1.2,
        stagger: 0.08,
        ease: "expo.out",
        scrollTrigger: { trigger: panel.current, start: "top 80%", once: true },
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  const ready = data != null && shown;

  return (
    <section id="analytics" ref={root} aria-labelledby="analytics-title" className="relative py-(--section-space)">
      <div className="container-page">
        <div data-an-head className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionLabel index="09">Analytics</SectionLabel>
            <h2 id="analytics-title" className="mt-6 max-w-[15ch] text-display-m font-light text-bone">
              The whole unit, <span className="text-editorial text-ivory">at a glance.</span>
            </h2>
          </div>
          <p className="max-w-[28rem] text-body text-graphite-300 lg:col-span-4 lg:col-start-9">
            The admin workspace on the demo facility. The API status is measured live against the deployed service; everything else is the simulated unit.
          </p>
        </div>

        <div ref={panel} className="mt-14 grid gap-4 lg:mt-20 lg:grid-cols-12">
          <Card className="lg:col-span-8" title="Patient monitoring activity" meta={`Last ${DAYS} days`}>
            <ChartLegend
              className="mb-4"
              items={[
                { label: "Readings", color: CHART.series.signal },
                { label: "Bedside check-ins", color: CHART.series.bone, dashed: true },
              ]}
            />
            <div className="h-[240px]">{ready ? <ActivityChart data={data.analytics} reduced={reduced} /> : <Skeleton className="size-full" />}</div>
          </Card>

          <Card className="lg:col-span-4" title="Review priority" meta={data ? `${data.overview.patients} patients` : undefined}>
            {data ? <PriorityBars distribution={data.analytics.priorityDistribution} animate={ready && !reduced} /> : <Skeleton className="h-[240px] w-full" />}
          </Card>

          <Card className="lg:col-span-4" title="Device connectivity" meta={data ? `${data.overview.onlineDevices}/${data.overview.devices} online` : undefined}>
            <ChartLegend
              className="mb-4"
              items={[
                { label: "Online", color: CHART.series.deep },
                { label: "Warning", color: CHART.series.watch },
                { label: "Offline", color: CHART.series.muted },
              ]}
            />
            <div className="h-[180px]">{ready ? <DeviceChart data={data.analytics} reduced={reduced} /> : <Skeleton className="size-full" />}</div>
          </Card>

          <Card className="lg:col-span-5" title="Alert volume" meta="By weekday and hour">
            {data ? <Heatmap cells={data.analytics.alertHeatmap} animate={ready && !reduced} /> : <Skeleton className="h-[180px] w-full" />}
          </Card>

          <Card className="lg:col-span-3" title="System performance" meta={api.configured ? "API live" : "Simulated"}>
            {data ? <Services services={data.health.services} api={api} /> : <Skeleton className="h-[180px] w-full" />}
          </Card>
        </div>
      </div>
    </section>
  );
}

function Card({ title, meta, className, children }: { title: string; meta?: string; className?: string; children: React.ReactNode }) {
  return (
    <div data-an-card className={cn("flex flex-col rounded-xl border border-(--line) bg-graphite-900/70 p-5 lg:p-6", className)}>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h3 className="text-small font-medium text-bone">{title}</h3>
        {meta && <span className="text-label text-graphite-400">{meta}</span>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Services({ services, api }: { services: ServiceStatus[]; api: ReturnType<typeof useApiHealth> }) {
  const rows = services
    .filter((s) => ["api", "database", "realtime", "sync"].includes(s.id))
    .map((s) =>
      s.id === "api" && api.configured
        ? { ...s, live: true, status: api.status === "down" ? ("down" as const) : ("operational" as const), latencyMs: api.latencyMs, history: api.history.map((h) => h ?? 0) }
        : { ...s, live: false },
    );
  return (
    <ul className="divide-y divide-(--line)">
      {rows.map((s) => {
        const checking = s.live && api.status === "checking";
        const tone = checking ? "neutral" : s.status === "operational" ? "signal" : s.status === "degraded" ? "watch" : "critical";
        return (
          <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <StatusDot tone={tone} pulse={s.live && s.status === "operational" && !checking} label={checking ? "Checking" : s.status} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-small text-bone">
                {s.name}
                {s.live && (
                  <Badge tone="signal" className="h-5 px-1.5 text-[9px]">
                    Live
                  </Badge>
                )}
              </p>
              <p className="tabular font-mono text-[10.5px] text-graphite-400">
                {checking ? "Checkingâ€¦" : s.status === "down" ? "No response" : s.latencyMs != null ? `${s.latencyMs} ms` : `${s.uptimePercent}% uptime`}
              </p>
            </div>
            <svg viewBox="0 0 60 20" preserveAspectRatio="none" className="h-5 w-14 shrink-0" aria-hidden>
              <path d={sparkPath(s.history, 60, 20)} fill="none" stroke={s.live ? "var(--color-signal)" : "var(--color-graphite-400)"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
          </li>
        );
      })}
    </ul>
  );
}
