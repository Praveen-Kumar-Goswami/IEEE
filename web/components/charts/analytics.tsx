"use client";

import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/utils/cn";
import { ALERT_TYPE_LABEL } from "@/lib/domain/labels";
import { formatDate, formatNumber } from "@/utils/format";
import { gsap, useGSAP } from "@/lib/motion/gsap";
import { PriorityBadge } from "@/components/ui/badge";
import type { AnalyticsData, ReviewPriority } from "@/types/domain";
import { CHART, ChartTooltip } from "./theme";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRIORITIES: ReviewPriority[] = ["critical", "high", "medium", "low"];

export function ActivityChart({ data, reduced }: { data: AnalyticsData; reduced: boolean }) {
  const rows = data.monitoringActivity.map((d) => ({ ...d, label: formatDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="an-readings" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={CHART.series.signal} stopOpacity={0.28} />
            <stop offset="1" stopColor={CHART.series.signal} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...CHART.grid} />
        <XAxis dataKey="label" {...CHART.axis} interval="preserveStartEnd" minTickGap={40} />
        <YAxis yAxisId="r" {...CHART.axis} width={48} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
        <YAxis yAxisId="c" orientation="right" {...CHART.axis} width={28} />
        <Tooltip cursor={CHART.cursor} content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
        <Area yAxisId="r" type="monotone" dataKey="readings" name="Readings" stroke={CHART.series.signal} strokeWidth={1.5} fill="url(#an-readings)" {...CHART.animation} isAnimationActive={!reduced} />
        <Line yAxisId="c" type="monotone" dataKey="checkins" name="Check-ins" stroke={CHART.series.bone} strokeWidth={1} strokeDasharray="3 4" dot={false} {...CHART.animation} isAnimationActive={!reduced} animationBegin={300} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DeviceChart({ data, reduced, days = 14 }: { data: AnalyticsData; reduced: boolean; days?: number }) {
  const rows = data.deviceHealth.slice(-days).map((d) => ({ ...d, label: formatDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: -28 }} barCategoryGap="28%">
        <CartesianGrid {...CHART.grid} />
        <XAxis dataKey="label" {...CHART.axis} interval="preserveStartEnd" minTickGap={30} />
        <YAxis {...CHART.axis} width={40} allowDecimals={false} />
        <Tooltip cursor={CHART.barCursor} content={<ChartTooltip />} />
        <Bar dataKey="online" name="Online" stackId="d" fill={CHART.series.deep} {...CHART.animation} isAnimationActive={!reduced} />
        <Bar dataKey="warning" name="Warning" stackId="d" fill={CHART.series.watch} {...CHART.animation} isAnimationActive={!reduced} />
        <Bar dataKey="offline" name="Offline" stackId="d" fill={CHART.series.muted} radius={[2, 2, 0, 0]} {...CHART.animation} isAnimationActive={!reduced} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function UserGrowthChart({ data, reduced }: { data: AnalyticsData; reduced: boolean }) {
  const rows = data.userGrowth.map((d) => ({ ...d, label: formatDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
        <CartesianGrid {...CHART.grid} />
        <XAxis dataKey="label" {...CHART.axis} interval="preserveStartEnd" minTickGap={40} />
        <YAxis {...CHART.axis} width={40} allowDecimals={false} />
        <Tooltip cursor={CHART.cursor} content={<ChartTooltip />} />
        <Area type="monotone" dataKey="patients" name="Patients" stackId="u" stroke={CHART.series.signal} fill={CHART.series.signal} fillOpacity={0.14} strokeWidth={1.25} {...CHART.animation} isAnimationActive={!reduced} />
        <Area type="monotone" dataKey="nurses" name="Nurses" stackId="u" stroke={CHART.series.bone} fill={CHART.series.bone} fillOpacity={0.08} strokeWidth={1.25} {...CHART.animation} isAnimationActive={!reduced} />
        <Area type="monotone" dataKey="doctors" name="Doctors" stackId="u" stroke={CHART.series.info} fill={CHART.series.info} fillOpacity={0.1} strokeWidth={1.25} {...CHART.animation} isAnimationActive={!reduced} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function UtilizationChart({ data, reduced }: { data: AnalyticsData; reduced: boolean }) {
  const rows = data.utilization.map((d) => ({ ...d, label: formatDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
        <CartesianGrid {...CHART.grid} />
        <XAxis dataKey="label" {...CHART.axis} interval="preserveStartEnd" minTickGap={40} />
        <YAxis {...CHART.axis} width={40} allowDecimals={false} />
        <Tooltip cursor={CHART.cursor} content={<ChartTooltip />} />
        <Line type="monotone" dataKey="activeUsers" name="Active users" stroke={CHART.series.signal} strokeWidth={1.5} dot={false} {...CHART.animation} isAnimationActive={!reduced} />
        <Line type="monotone" dataKey="sessions" name="Monitoring sessions" stroke={CHART.series.watch} strokeWidth={1.25} strokeDasharray="3 4" dot={false} {...CHART.animation} isAnimationActive={!reduced} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AlertTypeBars({ data, animate }: { data: AnalyticsData; animate: boolean }) {
  const max = Math.max(1, ...data.alertsByType.map((a) => a.count));
  const grown = useGrow(animate);
  return (
    <ul className="space-y-4">
      {[...data.alertsByType]
        .sort((a, b) => b.count - a.count)
        .map((a, i) => (
          <li key={a.type}>
            <div className="flex items-baseline justify-between gap-3 text-small">
              <span className="truncate text-graphite-100">{ALERT_TYPE_LABEL[a.type]}</span>
              <span className="tabular font-mono text-[12px] text-bone">{a.count}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-graphite-800">
              <div
                className={cn("h-full origin-left rounded-full transition-transform duration-(--dur-cine) ease-(--ease-out-expo)", a.type === "moisture_change" ? "bg-attention" : a.type === "device_offline" || a.type === "sync_issue" ? "bg-graphite-400" : "bg-watch")}
                style={{ transform: `scaleX(${grown ? a.count / max : 0})`, transitionDelay: `${i * 90}ms` }}
              />
            </div>
          </li>
        ))}
    </ul>
  );
}

function useGrow(animate: boolean) {
  const [grown, setGrown] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);
  return grown || !animate;
}

export function PriorityBars({ distribution, animate }: { distribution: Record<ReviewPriority, number>; animate: boolean }) {
  const total = Math.max(1, PRIORITIES.reduce((s, p) => s + distribution[p], 0));
  const grown = useGrow(animate);
  return (
    <ul className="space-y-5">
      {PRIORITIES.map((p, i) => {
        const share = distribution[p] / total;
        return (
          <li key={p}>
            <div className="flex items-center justify-between">
              <PriorityBadge priority={p} />
              <span className="tabular font-mono text-[12px] text-bone">{distribution[p]}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-graphite-800">
              <div
                className={cn(
                  "h-full origin-left rounded-full transition-transform duration-(--dur-cine) ease-(--ease-out-expo)",
                  p === "critical" ? "bg-critical" : p === "high" ? "bg-attention" : p === "medium" ? "bg-watch" : "bg-signal",
                )}
                style={{ transform: `scaleX(${grown ? share : 0})`, transitionDelay: `${i * 90}ms` }}
              />
            </div>
          </li>
        );
      })}
      <li className="text-[11px] leading-snug text-graphite-400">Priority ranks the review queue. It is not a clinical risk score.</li>
    </ul>
  );
}

export function Heatmap({ cells, animate }: { cells: AnalyticsData["alertHeatmap"]; animate: boolean }) {
  const grid = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...cells.map((c) => c.count));
  useGSAP(
    () => {
      if (!animate || !grid.current) return;
      gsap.from(grid.current.querySelectorAll("[data-cell]"), { opacity: 0, scale: 0.4, duration: 0.6, ease: "power3.out", stagger: { grid: [7, 24], from: "start", amount: 0.9 } });
    },
    { dependencies: [animate], scope: grid },
  );
  return (
    <div>
      <div className="flex gap-3">
        <ul aria-hidden className="flex flex-col justify-between py-px font-mono text-[9.5px] text-graphite-500">
          {WEEKDAYS.map((d) => (
            <li key={d} className="leading-none">
              {d}
            </li>
          ))}
        </ul>
        <div ref={grid} role="img" aria-label="Alert volume heatmap by weekday and hour. Mornings between 06:00 and 09:00 are busiest." className="grid flex-1 grid-cols-24 gap-[3px]">
          {cells.map((c) => (
            <span
              key={`${c.day}-${c.hour}`}
              data-cell
              title={`${WEEKDAYS[c.day]} ${String(c.hour).padStart(2, "0")}:00 · ${c.count} alerts`}
              className="aspect-square rounded-[2px] bg-signal"
              style={{ opacity: 0.06 + (c.count / max) * 0.88, gridRow: c.day + 1, gridColumn: c.hour + 1 }}
            />
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-3 flex justify-between pl-9 font-mono text-[9.5px] text-graphite-500">
        {["00", "06", "12", "18", "23"].map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
    </div>
  );
}
