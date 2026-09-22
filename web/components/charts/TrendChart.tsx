"use client";

import { useId, useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { METRIC_META } from "@/lib/domain/labels";
import { formatDate, formatDateTime, formatTime } from "@/utils/format";
import type { ChartEvent, MetricKey, ReadingSeries, SeriesPoint } from "@/types/domain";
import { CHART, ChartTooltip } from "./theme";

const EVENT_COLOR: Record<ChartEvent["kind"], string> = {
  alert: CHART.series.attention,
  note: CHART.series.info,
  checkin: CHART.series.bone,
  device: CHART.series.muted,
  session: CHART.series.signal,
};

/** Upper review line for a metric: session baseline + delta for temperature, absolute for the rest. */
export function thresholdFor(metric: MetricKey, series: Pick<ReadingSeries, "baseline" | "thresholds">) {
  if (metric === "localizedTemperatureC") return series.baseline == null ? null : series.baseline + series.thresholds.temperatureDelta;
  if (metric === "humidityPercent") return series.thresholds.humidity;
  if (metric === "relativeMoistureValue") return series.thresholds.moisture;
  return null;
}

interface TrendChartProps {
  series: ReadingSeries;
  metric: MetricKey;
  /** Realtime points appended after the last bucket. */
  live?: SeriesPoint[];
  compare?: boolean;
  showEvents?: boolean;
  height?: number;
  animate?: boolean;
}

export function TrendChart({ series, metric, live, compare, showEvents = true, height = 300, animate = true }: TrendChartProps) {
  const id = useId().replace(/:/g, "");
  const meta = METRIC_META[metric];
  const threshold = thresholdFor(metric, series);
  const long = series.to - series.from > 36 * 3_600_000;

  const rows = useMemo(() => {
    const base = series.points.map((p, i) => ({ t: p.t, value: p[metric], cmp: series.comparison[i]?.[metric] ?? null }));
    const last = base[base.length - 1]?.t ?? 0;
    const tail = (live ?? []).filter((p) => p.t > last).map((p) => ({ t: p.t, value: p[metric], cmp: null }));
    return [...base, ...tail];
  }, [series, metric, live]);

  const domain = useMemo<[number, number]>(() => {
    const values = rows.flatMap((r) => [r.value, compare ? r.cmp : null]).filter((v): v is number => v != null);
    if (threshold != null) values.push(threshold);
    if (series.baseline != null && metric === "localizedTemperatureC") values.push(series.baseline);
    if (values.length === 0) return meta.domain;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.18, meta.digits === 0 ? 10 : 0.2);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [rows, compare, threshold, series.baseline, metric, meta]);

  const to = Math.max(series.to, rows[rows.length - 1]?.t ?? series.to);
  const tick = (t: number) => (long ? formatDate(t) : formatTime(t));
  const fmt = (v: number) => `${v.toFixed(meta.digits)} ${meta.unit}`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={`trend-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={CHART.series.signal} stopOpacity={0.26} />
              <stop offset="1" stopColor={CHART.series.signal} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...CHART.grid} />
          <XAxis dataKey="t" type="number" scale="time" domain={[series.from, to]} tickFormatter={tick} minTickGap={56} {...CHART.axis} />
          <YAxis domain={domain} tickFormatter={(v: number) => v.toFixed(meta.digits === 0 ? 0 : 1)} width={52} {...CHART.axis} />
          <Tooltip
            cursor={CHART.cursor}
            content={<ChartTooltip labelFormatter={(l) => formatDateTime(Number(l))} valueFormatter={(v) => fmt(v)} />}
          />
          {threshold != null && <ReferenceArea y1={threshold} y2={domain[1]} fill={CHART.series.attention} fillOpacity={0.045} strokeOpacity={0} />}
          {threshold != null && (
            <ReferenceLine
              y={threshold}
              stroke={CHART.series.attention}
              strokeOpacity={0.7}
              strokeDasharray="4 4"
              label={{ value: `Review ${fmt(threshold)}`, position: "insideTopRight", fill: CHART.series.attention, fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
            />
          )}
          {metric === "localizedTemperatureC" && series.baseline != null && (
            <ReferenceLine
              y={series.baseline}
              stroke={CHART.series.bone}
              strokeOpacity={0.35}
              strokeDasharray="2 5"
              label={{ value: `Baseline ${fmt(series.baseline)}`, position: "insideBottomRight", fill: CHART.series.muted, fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
            />
          )}
          {showEvents &&
            series.events
              .filter((e) => e.t >= series.from)
              .map((e) => <ReferenceLine key={`${e.kind}-${e.t}`} x={e.t} stroke={EVENT_COLOR[e.kind]} strokeOpacity={0.45} strokeDasharray="1 3" />)}
          {compare && (
            <Line dataKey="cmp" name="Previous period" type="monotone" stroke={CHART.series.muted} strokeWidth={1} strokeDasharray="3 4" dot={false} isAnimationActive={false} connectNulls />
          )}
          <Area
            dataKey="value"
            name={meta.label}
            type="monotone"
            stroke={CHART.series.signal}
            strokeWidth={1.5}
            fill={`url(#trend-${id})`}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3.5, fill: CHART.series.signal, stroke: "var(--color-graphite-950)", strokeWidth: 2 }}
            {...CHART.animation}
            isAnimationActive={animate}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
