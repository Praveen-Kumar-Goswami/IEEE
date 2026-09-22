"use client";

import { cn } from "@/utils/cn";
import { BRAND } from "@/lib/brand";
import { METRIC_META } from "@/lib/domain/labels";
import { smoothPath, type Point } from "@/utils/path";
import { useNow } from "@/hooks/use-now";
import { RollingNumber } from "@/components/ui/count-up";
import { LogoMark } from "@/components/brand/Logo";
import { showcaseTime, showcaseWindow } from "@/features/landing/data/showcase";
import type { MetricKey } from "@/types/domain";

const TRACES: { key: MetricKey; color: string }[] = [
  { key: "localizedTemperatureC", color: "var(--color-signal)" },
  { key: "humidityPercent", color: "var(--color-bone)" },
  { key: "relativeMoistureValue", color: "var(--color-watch)" },
];

const W = 640;
const H = 64;
const POINTS = 72;

/** Left half of the sign-in page: the simulated dressing from the landing page, still streaming. */
export function SignalPanel({ className }: { className?: string }) {
  const now = useNow(1000);
  const samples = now ? showcaseWindow(showcaseTime(now), POINTS) : null;
  const latest = samples?.[samples.length - 1]?.sample ?? null;

  return (
    <aside className={cn("relative flex-col justify-between overflow-hidden border-r border-(--line) p-10 xl:p-14", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_40%_45%,black,transparent_75%)]"
      />
      <div aria-hidden className="pointer-events-none absolute -left-40 top-1/3 size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(116_216_192/0.09),transparent)]" />

      <div className="relative flex items-center gap-3">
        <LogoMark className="size-8" />
        <div className="leading-tight">
          <p className="text-body font-medium text-bone">{BRAND.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">{BRAND.program}</p>
        </div>
      </div>

      <div className="relative">
        <h2 className="max-w-[12ch] text-display-m font-light text-bone">
          Every dressing, <span className="text-editorial text-ivory">reporting in.</span>
        </h2>
        <div className="mt-14 max-w-[40rem] space-y-7">
          {TRACES.map(({ key, color }) => {
            const meta = METRIC_META[key];
            const [lo, hi] = meta.domain;
            const pts: Point[] = (samples ?? []).map((s, i) => {
              const v = s.sample[key];
              const y = v == null ? H / 2 : H - 6 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (H - 12);
              return [(i / (POINTS - 1)) * W, y];
            });
            const head = pts[pts.length - 1];
            const value = latest?.[key] ?? null;
            return (
              <div key={key}>
                <div className="mb-2 flex items-baseline justify-between gap-6">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-300">
                    {meta.label} <span className="text-graphite-500">· {meta.sensor}</span>
                  </p>
                  <p className="font-mono text-small text-bone">
                    <RollingNumber value={value} decimals={meta.digits} /> <span className="text-graphite-400">{meta.unit}</span>
                  </p>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full overflow-visible" aria-hidden>
                  <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--line)" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
                  {pts.length > 1 && (
                    <>
                      <path d={smoothPath(pts, 0.6)} fill="none" stroke={color} strokeWidth="1.25" strokeOpacity="0.85" vectorEffect="non-scaling-stroke" />
                      <circle cx={head[0]} cy={head[1]} r="3" fill={color} />
                      <circle cx={head[0]} cy={head[1]} r="9" fill={color} opacity="0.14" />
                    </>
                  )}
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      <dl className="relative grid max-w-[40rem] grid-cols-3 gap-6 border-t border-(--line) pt-6">
        {[
          ["Sampling", "every 5 s"],
          ["Transport", "BLE → phone → API"],
          ["Review", "clinician-led"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-label text-graphite-400">{k}</dt>
            <dd className="mt-1.5 text-small text-graphite-100">{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
