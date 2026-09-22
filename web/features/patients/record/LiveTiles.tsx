"use client";

import { cn } from "@/utils/cn";
import { METRIC_META, TONE_CLASS } from "@/lib/domain/labels";
import { useNow } from "@/hooks/use-now";
import { RollingNumber } from "@/components/ui/count-up";
import { StatusDot } from "@/components/ui/badge";
import { thresholdFor } from "@/components/charts/TrendChart";
import type { MetricKey, PatientSummary, ReadingSeries } from "@/types/domain";
import { useLatestReading } from "../live";

const METRICS: MetricKey[] = ["localizedTemperatureC", "humidityPercent", "relativeMoistureValue", "ambientTemperatureC"];

export function LiveTiles({ patient, series }: { patient: PatientSummary; series: ReadingSeries | undefined }) {
  const reading = useLatestReading(patient);
  const now = useNow(1000);
  const age = reading && now ? Math.max(0, Math.round((now - Date.parse(reading.capturedAt)) / 1000)) : null;
  const stale = age != null && age > 120;

  return (
    <section aria-label="Latest readings" className="rounded-lg border border-(--line) bg-graphite-900/80">
      <div className="flex items-center justify-between gap-4 border-b border-(--line) px-5 py-3">
        <p className="flex items-center gap-2.5 text-small text-graphite-200">
          <StatusDot tone={stale || !reading ? "offline" : "signal"} pulse={!stale && Boolean(reading)} />
          {reading ? (stale ? "Last reading" : "Streaming") : "Waiting for the first reading"}
        </p>
        <p className="tabular font-mono text-[10.5px] uppercase tracking-[0.12em] text-graphite-400">
          {age == null ? "--" : age < 60 ? `${age} s ago` : `${Math.round(age / 60)} min ago`}
          {patient.device && <> · {patient.device.serial}</>}
        </p>
      </div>
      <dl className="grid grid-cols-2 divide-(--line) lg:grid-cols-4 lg:divide-x [&>div:nth-child(-n+2)]:border-b [&>div:nth-child(-n+2)]:border-(--line) lg:[&>div:nth-child(-n+2)]:border-b-0 [&>div:nth-child(odd)]:border-r [&>div:nth-child(odd)]:border-(--line)">
        {METRICS.map((metric) => {
          const meta = METRIC_META[metric];
          const value = reading?.[metric] ?? null;
          const threshold = series ? thresholdFor(metric, series) : null;
          const over = value != null && threshold != null && value >= threshold;
          const baseline = metric === "localizedTemperatureC" ? series?.baseline : null;
          const delta = value != null && baseline != null ? value - baseline : null;
          return (
            <div key={metric} className="relative p-5">
              {over && <span aria-hidden className={cn("absolute inset-x-5 top-0 h-px", TONE_CLASS.attention.dot)} />}
              <dt className="text-label text-graphite-400">
                {meta.short} <span className="text-graphite-500">· {meta.sensor}</span>
              </dt>
              <dd className="mt-4 flex items-baseline gap-1.5">
                <RollingNumber value={value} decimals={meta.digits} className={cn("text-[2.1rem] font-light tracking-[-0.03em]", over ? "text-attention" : "text-bone")} />
                <span className="font-mono text-[11px] text-graphite-400">{meta.unit}</span>
              </dd>
              <dd className={cn("mt-2 text-[12px]", over ? "text-attention" : "text-graphite-400")}>
                {delta != null
                  ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} °C from session baseline`
                  : threshold != null
                    ? over
                      ? `Above review threshold ${threshold.toFixed(meta.digits)}`
                      : `Review at ${threshold.toFixed(meta.digits)} ${meta.unit}`
                    : "Reference only"}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
