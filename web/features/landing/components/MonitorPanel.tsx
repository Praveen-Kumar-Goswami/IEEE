"use client";

import { forwardRef, useMemo, useState } from "react";
import { Activity, BatteryMedium, Bluetooth, Check, Droplets, Thermometer, Waves } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format";
import { areaPath, smoothPath, sparkPath, type Point } from "@/utils/path";
import { useNow } from "@/hooks/use-now";
import { Badge, PriorityBadge, StatusDot } from "@/components/ui/badge";
import { RollingNumber } from "@/components/ui/count-up";
import { GLOBAL_THRESHOLDS, REVIEW_SUFFIX } from "@/lib/domain/rules";
import type { MonitoringStatus, ReviewPriority } from "@/types/domain";
import { SHOWCASE, SHOWCASE_BASELINE, SHOWCASE_THRESHOLD, showcaseEvents, showcaseTime, showcaseWindow } from "../data/showcase";

const W = 1000;
const H = 300;
const PAD_T = 18;
const PAD_B = 10;
const Y_MIN = SHOWCASE_BASELINE - 0.7;
const Y_MAX = SHOWCASE_BASELINE + 2.1;
const STEP = W / (SHOWCASE.windowMs / SHOWCASE.sampleEveryMs - 1);
const yOf = (v: number) => PAD_T + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD_T - PAD_B);

const STATUS_META: Record<MonitoringStatus, { label: string; priority: ReviewPriority }> = {
  normal: { label: "Normal", priority: "low" },
  watch: { label: "Watch", priority: "high" },
  attention: { label: "Attention", priority: "critical" },
  offline: { label: "Offline", priority: "medium" },
};

/** Live panel on the landing page. Replays the showcase signal; `revealRef` is the chart clip GSAP draws in. */
export const MonitorPanel = forwardRef<SVGRectElement, { className?: string; reduced: boolean }>(function MonitorPanel({ className, reduced }, revealRef) {
  const now = useNow(1000);
  const t = now == null ? null : showcaseTime(now);
  const samples = useMemo(() => (t == null ? [] : showcaseWindow(t)), [t]);
  const events = useMemo(() => (t == null ? [] : showcaseEvents(t)), [t]);
  const latest = samples.at(-1)?.sample ?? null;

  const temp = latest?.localizedTemperatureC ?? null;
  const delta = temp == null ? null : temp - SHOWCASE_BASELINE;
  const status: MonitoringStatus =
    latest == null
      ? "normal"
      : (latest.relativeMoistureValue ?? 0) >= GLOBAL_THRESHOLDS.moisture
        ? "attention"
        : temp != null && temp >= SHOWCASE_THRESHOLD
          ? "watch"
          : "normal";
  const open = events.some((e) => e.kind === "opened") && !events.some((e) => e.kind === "settled");
  const meta = STATUS_META[status];

  return (
    <div className={cn("overflow-hidden rounded-xl border border-(--line) bg-graphite-900/90 shadow-e3 backdrop-blur-md", className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-(--line) px-5 py-4 lg:px-7">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-(--line-strong) font-mono text-[11px] text-bone">P12</span>
          <div className="min-w-0">
            <p className="truncate text-small font-medium text-bone">{SHOWCASE.patient}</p>
            <p className="text-label mt-0.5 text-graphite-400">Ward 4B · Bay 2 · Session S-0412</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={status === "normal" ? "signal" : status === "watch" ? "watch" : "attention"} dot>
            {meta.label}
          </Badge>
          <span className="hidden sm:inline-flex">
            <PriorityBadge priority={meta.priority} />
          </span>
          <span className="tabular font-mono text-[11px] tracking-[0.1em] text-graphite-300" aria-label="Dressing time">
            {t == null ? "--:--:--" : formatTime(t, true)}
          </span>
        </div>
      </header>

      <div className="grid lg:grid-cols-12">
        <div className="border-(--line) p-5 lg:col-span-8 lg:border-r lg:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-label text-graphite-400">Localized temperature · last 30 min</p>
              <p className="mt-2 flex items-baseline gap-3">
                <RollingNumber value={temp} decimals={1} className="text-h1 font-light text-bone" />
                <span className="text-small text-graphite-300">°C</span>
                {delta != null && (
                  <span className={cn("tabular font-mono text-[11px] tracking-[0.1em]", delta >= GLOBAL_THRESHOLDS.temperatureDelta ? "text-watch" : "text-graphite-300")}>
                    {delta >= 0 ? "+" : "−"}
                    {Math.abs(delta).toFixed(2)} from baseline
                  </span>
                )}
              </p>
            </div>
            <ul className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-px w-4 bg-signal" /> Reading
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-px w-4 border-t border-dashed border-graphite-300" /> Baseline
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="h-2 w-4 bg-watch/15" /> Review band
              </li>
            </ul>
          </div>
          <TrendChart points={samples} events={events} revealRef={revealRef} reduced={reduced} />
        </div>

        <div className="grid grid-cols-2 gap-px bg-(--line) lg:col-span-4 lg:grid-cols-1 xl:grid-cols-2">
          <Tile icon={Droplets} label="Humidity" unit="%RH" value={latest?.humidityPercent ?? null} decimals={1} series={samples.map((p) => p.sample.humidityPercent)} />
          <Tile
            icon={Waves}
            label="Moisture"
            unit="ADC"
            value={latest?.relativeMoistureValue ?? null}
            decimals={0}
            series={samples.map((p) => p.sample.relativeMoistureValue)}
            warn={(latest?.relativeMoistureValue ?? 0) >= GLOBAL_THRESHOLDS.moisture * 0.95}
          />
          <Tile icon={Thermometer} label="Ambient" unit="°C" value={latest?.ambientTemperatureC ?? null} decimals={1} series={samples.map((p) => p.sample.ambientTemperatureC)} />
          <Tile icon={BatteryMedium} label="Battery" unit="%" value={latest?.batteryPercent ?? null} decimals={0} series={samples.map((p) => p.sample.batteryPercent)} />
          <div className="col-span-2 bg-graphite-900 p-5 lg:col-span-1 xl:col-span-2">
            <IndicatorCard open={open} events={events} />
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-(--line) px-5 py-3.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-400 lg:px-7">
        <span className="flex items-center gap-2 text-graphite-200">
          <StatusDot tone="signal" pulse /> {SHOWCASE.device} · Connected
        </span>
        <span className="flex items-center gap-2">
          <Bluetooth aria-hidden className="size-3.5" /> BLE → phone gateway → API
        </span>
        <span className="flex items-center gap-2">
          <Activity aria-hidden className="size-3.5" /> Sample every 5 s · replay ×{SHOWCASE.speed}
        </span>
        <span className="hidden md:inline">Firmware 1.4.2</span>
      </footer>
    </div>
  );
});

function TrendChart({
  points,
  events,
  revealRef,
  reduced,
}: {
  points: ReturnType<typeof showcaseWindow>;
  events: ReturnType<typeof showcaseEvents>;
  revealRef: React.Ref<SVGRectElement>;
  reduced: boolean;
}) {
  const from = points[0]?.t ?? 0;
  const to = points.at(-1)?.t ?? 1;
  const span = to - from || 1;
  const pts: Point[] = points.map((p, i) => [i * STEP, yOf(p.sample.localizedTemperatureC ?? SHOWCASE_BASELINE)]);
  const line = smoothPath(pts);
  const area = areaPath(line, pts, H);
  const last = pts.at(-1);
  const marker = events.find((e) => e.kind === "opened" && e.t >= from);
  const markerX = marker ? ((marker.t - from) / span) * 100 : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => from + f * span);

  return (
    <div className="relative mt-6">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[200px] w-full overflow-visible sm:h-[260px] lg:h-[300px]" role="img" aria-label="Localized temperature over the last 30 minutes, against the session baseline and review threshold">
        <defs>
          <linearGradient id="mon-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
          </linearGradient>
          <clipPath id="mon-reveal">
            <rect ref={revealRef} x="0" y="-20" width={W} height={H + 40} />
          </clipPath>
          <clipPath id="mon-plot">
            <rect x="0" y="-20" width={W} height={H + 40} />
          </clipPath>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
        ))}
        <rect x="0" y="0" width={W} height={yOf(SHOWCASE_THRESHOLD)} fill="var(--color-watch)" fillOpacity="0.06" />
        <line x1="0" x2={W} y1={yOf(SHOWCASE_THRESHOLD)} y2={yOf(SHOWCASE_THRESHOLD)} stroke="var(--color-watch)" strokeOpacity="0.5" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2={W} y1={yOf(SHOWCASE_BASELINE)} y2={yOf(SHOWCASE_BASELINE)} stroke="var(--color-graphite-300)" strokeOpacity="0.5" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        <g clipPath="url(#mon-reveal)">
          <g clipPath="url(#mon-plot)">
            <g key={to} className={reduced ? undefined : "motion-safe:animate-[chart-slide_1s_linear]"} style={{ ["--slide" as string]: `${STEP}px` }}>
              <path d={area} fill="url(#mon-area)" />
              <path d={line} fill="none" stroke="var(--color-signal)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </g>
          </g>
        </g>
      </svg>

      <div aria-hidden className="pointer-events-none absolute inset-0">
        {last && (
          <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-glow" style={{ left: "100%", top: `${(last[1] / H) * 100}%` }}>
            <span className="absolute inset-0 rounded-full bg-signal motion-safe:animate-ping [animation-duration:2.4s]" />
          </span>
        )}
        {markerX != null && (
          <div className="absolute inset-y-0 border-l border-watch/60 transition-[left] duration-1000 ease-linear" style={{ left: `${markerX}%` }}>
            <span className="absolute left-2 top-1 whitespace-nowrap rounded-full border border-watch/30 bg-graphite-900/90 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-watch">
              Indicator · {formatTime(marker!.t)}
            </span>
          </div>
        )}
        <span className="absolute right-0 font-mono text-[10px] tracking-[0.1em] text-watch/80" style={{ top: `calc(${(yOf(SHOWCASE_THRESHOLD) / H) * 100}% - 16px)` }}>
          +{GLOBAL_THRESHOLDS.temperatureDelta.toFixed(1)} °C
        </span>
        <span className="absolute right-0 font-mono text-[10px] tracking-[0.1em] text-graphite-400" style={{ top: `calc(${(yOf(SHOWCASE_BASELINE) / H) * 100}% + 4px)` }}>
          {SHOWCASE_BASELINE.toFixed(1)} °C baseline
        </span>
      </div>
      <div aria-hidden className="mt-3 flex justify-between font-mono text-[10px] tracking-[0.1em] text-graphite-500">
        {ticks.map((tk) => (
          <span key={tk} className="tabular">
            {points.length ? formatTime(tk) : "--:--"}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  unit,
  value,
  decimals,
  series,
  warn,
}: {
  icon: typeof Droplets;
  label: string;
  unit: string;
  value: number | null;
  decimals: number;
  series: (number | null)[];
  warn?: boolean;
}) {
  return (
    <div className="bg-graphite-900 p-5">
      <p className="text-label flex items-center gap-2 text-graphite-400">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </p>
      <p className="mt-3 flex items-baseline gap-1.5">
        <RollingNumber value={value} decimals={decimals} className={cn("text-h2 font-light", warn ? "text-attention" : "text-bone")} />
        <span className="text-small text-graphite-400">{unit}</span>
      </p>
      <svg viewBox="0 0 120 28" preserveAspectRatio="none" className="mt-3 h-7 w-full" aria-hidden>
        <path d={sparkPath(series, 120, 28)} fill="none" stroke={warn ? "var(--color-attention)" : "var(--color-graphite-300)"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function IndicatorCard({ open, events }: { open: boolean; events: ReturnType<typeof showcaseEvents> }) {
  const [ackedAt, setAckedAt] = useState<number | null>(null);
  const opened = events.find((e) => e.kind === "opened");
  const scripted = events.find((e) => e.kind === "acknowledged");
  const acknowledged = open && (scripted != null || (ackedAt != null && opened != null && ackedAt >= opened.t));

  if (!open) {
    const settled = events.find((e) => e.kind === "settled");
    return (
      <div className="flex h-full flex-col justify-between gap-4" aria-live="polite">
        <p className="text-label flex items-center gap-2 text-graphite-300">
          <Check aria-hidden className="size-3.5 text-signal" /> No open indicators
        </p>
        <p className="text-small text-graphite-400">
          {settled ? `Last indicator settled at ${formatTime(settled.t)}. Readings are within the review band.` : "Readings are within the session baseline and review band."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col gap-3 rounded-md border border-watch/25 bg-watch/[0.05] p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label flex items-center gap-2 text-watch">
          <StatusDot tone="watch" pulse={!acknowledged} /> Monitoring indicator
        </p>
        {opened && <span className="tabular font-mono text-[10px] text-graphite-400">{formatTime(opened.t)}</span>}
      </div>
      <p className="text-small text-graphite-100">Localized temperature trend changed from baseline. Review is recommended.</p>
      <p className="sr-only">{REVIEW_SUFFIX}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-graphite-400">{acknowledged ? "Acknowledged · bedside check in progress" : "Assigned: Nurse A. Rahman"}</span>
        <button
          type="button"
          disabled={acknowledged}
          onClick={() => setAckedAt(events.at(-1)?.t ?? null)}
          data-cursor="button"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] uppercase tracking-[0.12em] transition-[background-color,border-color,color,transform] duration-(--dur-micro) ease-(--ease-out-quart) active:scale-[0.97]",
            acknowledged ? "border-signal/30 text-signal" : "border-watch/40 text-watch hover:bg-watch/10",
          )}
        >
          {acknowledged ? <Check aria-hidden className="size-3" /> : null}
          {acknowledged ? "Acknowledged" : "Acknowledge"}
        </button>
      </div>
    </div>
  );
}
