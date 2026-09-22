"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { METRIC_META, TIME_RANGES } from "@/lib/domain/labels";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Card } from "@/components/ui/card";
import { Segmented, Tabs } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { ChartLegend, CHART } from "@/components/charts/theme";
import { TrendChart, thresholdFor } from "@/components/charts/TrendChart";
import { useWorkspace } from "@/features/dashboard/context";
import type { MetricKey, TimeRange } from "@/types/domain";
import { useLiveTrail } from "../live";

const METRICS: MetricKey[] = ["localizedTemperatureC", "humidityPercent", "relativeMoistureValue", "ambientTemperatureC"];

export function useSeries(patientId: string, range: TimeRange) {
  const { data } = useWorkspace();
  return useQuery({
    queryKey: ["series", patientId, range],
    queryFn: () => data.getSeries(patientId, range),
    refetchInterval: range === "1H" ? 30_000 : range === "6H" ? 60_000 : false,
    placeholderData: (prev) => prev,
  });
}

export function TrendsPanel({ patientId, compact }: { patientId: string; compact?: boolean }) {
  const [range, setRange] = useState<TimeRange>(compact ? "6H" : "24H");
  const [metric, setMetric] = useState<MetricKey>("localizedTemperatureC");
  const [compare, setCompare] = useState(false);
  const reduced = useReducedMotion();
  const series = useSeries(patientId, range);
  const trail = useLiveTrail(patientId);
  const meta = METRIC_META[metric];
  const live = range === "1H" || range === "6H" ? trail : undefined;

  const stats = useMemo(() => {
    if (!series.data) return null;
    const values = series.data.points.map((p) => p[metric]).filter((v): v is number => v != null);
    if (!values.length) return null;
    const threshold = thresholdFor(metric, series.data);
    const above = threshold == null ? null : values.filter((v) => v >= threshold).length / values.length;
    return { min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a, b) => a + b, 0) / values.length, above, coverage: values.length / series.data.points.length };
  }, [series.data, metric]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <Tabs label="Metric" value={metric} onChange={setMetric} items={METRICS.map((m) => ({ value: m, label: METRIC_META[m].short }))} className="border-b-0" />
        <div className="flex items-center gap-4">
          {!compact && (
            <div className="w-44">
              <Switch checked={compare} onChange={setCompare} label="Previous period" />
            </div>
          )}
          <Segmented label="Time range" value={range} onChange={setRange} options={TIME_RANGES.map((r) => ({ value: r.value, label: r.label }))} />
        </div>
      </div>
      <div className="px-3 pb-2 pt-4 sm:px-5">
        {series.error ? (
          <ErrorState error={series.error} onRetry={() => series.refetch()} />
        ) : series.data ? (
          <TrendChart series={series.data} metric={metric} live={live} compare={compare} height={compact ? 260 : 360} animate={!reduced} />
        ) : (
          <Skeleton className={compact ? "h-[260px]" : "h-[360px]"} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-(--line) px-5 py-3.5">
        <ChartLegend
          items={[
            { label: meta.label, color: CHART.series.signal },
            ...(metric !== "ambientTemperatureC" ? [{ label: "Review threshold", color: CHART.series.attention, dashed: true }] : []),
            ...(compare ? [{ label: "Previous period", color: CHART.series.muted, dashed: true }] : []),
            { label: "Events", color: CHART.series.info, dashed: true },
          ]}
        />
        {stats && (
          <dl className="tabular flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-graphite-300">
            <div className="flex gap-2">
              <dt className="text-graphite-500">MIN</dt>
              <dd>{stats.min.toFixed(meta.digits)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-graphite-500">MEAN</dt>
              <dd>{stats.mean.toFixed(meta.digits)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-graphite-500">MAX</dt>
              <dd>{stats.max.toFixed(meta.digits)}</dd>
            </div>
            {stats.above != null && (
              <div className="flex gap-2">
                <dt className="text-graphite-500">ABOVE</dt>
                <dd className={stats.above > 0 ? "text-attention" : undefined}>{Math.round(stats.above * 100)}%</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-graphite-500">COVERAGE</dt>
              <dd>{Math.round(stats.coverage * 100)}%</dd>
            </div>
          </dl>
        )}
      </div>
    </Card>
  );
}
