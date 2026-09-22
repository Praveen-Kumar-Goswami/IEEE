"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatNumber } from "@/utils/format";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { CHART, ChartLegend } from "@/components/charts/theme";
import { ActivityChart, AlertTypeBars, DeviceChart, Heatmap, PriorityBars, UserGrowthChart, UtilizationChart } from "@/components/charts/analytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/tabs";
import { ErrorState } from "@/components/ui/states";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";

type Days = "7" | "30" | "90";

export function AnalyticsView() {
  const { data } = useWorkspace();
  const reduced = useReducedMotion();
  const [days, setDays] = useState<Days>("30");
  const analytics = useQuery({ queryKey: ["analytics", Number(days)], queryFn: () => data.getAnalytics(Number(days)), placeholderData: (prev) => prev });
  const a = analytics.data;
  const readings = a?.monitoringActivity.reduce((s, d) => s + d.readings, 0) ?? 0;
  const checkins = a?.monitoringActivity.reduce((s, d) => s + d.checkins, 0) ?? 0;
  const alerts = a?.alertsByType.reduce((s, d) => s + d.count, 0) ?? 0;
  const uptime = a ? a.deviceHealth.reduce((s, d) => s + d.online / Math.max(1, d.online + d.warning + d.offline), 0) / Math.max(1, a.deviceHealth.length) : 0;

  const chart = (node: ReactNode, h: string) => <div className={h}>{a ? node : <Skeleton className="size-full" />}</div>;

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Analytics"
        description="Usage, device health and indicator volume across every facility."
        actions={
          <Segmented
            label="Period"
            value={days}
            onChange={setDays}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
            ]}
          />
        }
      />
      {analytics.error ? (
        <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <dl className="grid grid-cols-2 gap-3 lg:col-span-12 xl:grid-cols-4">
            {[
              ["Sensor readings", a ? formatNumber(readings) : "--"],
              ["Bedside check-ins", a ? formatNumber(checkins) : "--"],
              ["Indicators raised", a ? formatNumber(alerts) : "--"],
              ["Mean device availability", a ? `${formatNumber(uptime * 100, 1)}%` : "--"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-(--line) bg-graphite-900/80 px-5 py-4">
                <dt className="text-label text-graphite-400">{k}</dt>
                <dd className="tabular mt-2 text-[1.7rem] font-light tracking-[-0.02em] text-bone">{v}</dd>
              </div>
            ))}
          </dl>

          <Card className="lg:col-span-8">
            <SectionTitle title="Monitoring activity" meta={`${days} days`} />
            <div className="px-5 pb-5">
              <ChartLegend
                className="mb-4"
                items={[
                  { label: "Readings", color: CHART.series.signal },
                  { label: "Bedside check-ins", color: CHART.series.bone, dashed: true },
                ]}
              />
              {chart(a && <ActivityChart data={a} reduced={reduced} />, "h-[260px]")}
            </div>
          </Card>
          <Card className="lg:col-span-4">
            <SectionTitle title="Review priority" meta="Right now" />
            <div className="px-5 pb-5">{a ? <PriorityBars distribution={a.priorityDistribution} animate={!reduced} /> : <Skeleton className="h-[240px]" />}</div>
          </Card>

          <Card className="lg:col-span-6">
            <SectionTitle title="Accounts" meta="Cumulative" />
            <div className="px-5 pb-5">
              <ChartLegend
                className="mb-4"
                items={[
                  { label: "Patients", color: CHART.series.signal },
                  { label: "Nurses", color: CHART.series.bone },
                  { label: "Doctors", color: CHART.series.info },
                ]}
              />
              {chart(a && <UserGrowthChart data={a} reduced={reduced} />, "h-[220px]")}
            </div>
          </Card>
          <Card className="lg:col-span-6">
            <SectionTitle title="Utilisation" meta="Daily" />
            <div className="px-5 pb-5">
              <ChartLegend
                className="mb-4"
                items={[
                  { label: "Active users", color: CHART.series.signal },
                  { label: "Monitoring sessions", color: CHART.series.watch, dashed: true },
                ]}
              />
              {chart(a && <UtilizationChart data={a} reduced={reduced} />, "h-[220px]")}
            </div>
          </Card>

          <Card className="lg:col-span-5">
            <SectionTitle title="Device connectivity" meta={`Last ${Math.min(Number(days), 30)} days`} />
            <div className="px-5 pb-5">
              <ChartLegend
                className="mb-4"
                items={[
                  { label: "Online", color: CHART.series.deep },
                  { label: "Warning", color: CHART.series.watch },
                  { label: "Offline", color: CHART.series.muted },
                ]}
              />
              {chart(a && <DeviceChart data={a} reduced={reduced} days={30} />, "h-[200px]")}
            </div>
          </Card>
          <Card className="lg:col-span-4">
            <SectionTitle title="Indicator volume" meta="By weekday and hour" />
            <div className="px-5 pb-5">{a ? <Heatmap cells={a.alertHeatmap} animate={!reduced} /> : <Skeleton className="h-[200px]" />}</div>
          </Card>
          <Card className="lg:col-span-3">
            <SectionTitle title="Indicators by type" />
            <div className="px-5 pb-5">{a ? <AlertTypeBars data={a} animate={!reduced} /> : <Skeleton className="h-[200px]" />}</div>
          </Card>
        </div>
      )}
    </>
  );
}
