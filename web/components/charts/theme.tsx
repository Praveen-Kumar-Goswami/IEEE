"use client";

import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { COLOR } from "@/lib/design/tokens";

/** Shared Recharts styling so every chart reads as the same instrument. */
export const CHART = {
  grid: { stroke: "rgb(237 234 228 / 0.06)", strokeDasharray: "0", vertical: false },
  axis: {
    tick: { fill: COLOR.graphite400, fontSize: 10.5, fontFamily: "var(--font-geist-mono)", letterSpacing: "0.06em" },
    tickLine: false,
    axisLine: false,
    tickMargin: 10,
  },
  cursor: { stroke: "rgb(237 234 228 / 0.18)", strokeWidth: 1 },
  barCursor: { fill: "rgb(237 234 228 / 0.04)" },
  animation: { isAnimationActive: true, animationDuration: 1400, animationEasing: "ease-out" as const },
  series: {
    signal: COLOR.signal,
    soft: COLOR.signalSoft,
    deep: COLOR.signalDeep,
    bone: COLOR.bone,
    muted: COLOR.graphite500,
    watch: COLOR.watch,
    attention: COLOR.attention,
    critical: COLOR.critical,
    info: COLOR.info,
    offline: COLOR.offline,
  },
} as const;

interface TooltipRow {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
}

/** Tooltip content for Recharts `content` prop. */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  labelFormatter?: (label: string | number) => ReactNode;
  valueFormatter?: (value: number, name: string) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[10rem] rounded-md border border-(--line-strong) bg-graphite-850/95 px-3 py-2.5 shadow-e3 backdrop-blur-md">
      {label != null && <p className="text-label mb-2 text-graphite-300">{labelFormatter ? labelFormatter(label) : label}</p>}
      <ul className="space-y-1">
        {payload.map((row) => (
          <li key={String(row.dataKey ?? row.name)} className="flex items-center justify-between gap-6 text-small">
            <span className="flex items-center gap-2 text-graphite-200">
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: row.color }} />
              {row.name}
            </span>
            <span className="tabular font-mono text-[12px] text-bone">
              {typeof row.value === "number" ? (valueFormatter ? valueFormatter(row.value, String(row.name)) : row.value) : String(row.value ?? "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartLegend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span aria-hidden className={cn("h-0 w-4 border-t", i.dashed && "border-dashed")} style={{ borderColor: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
