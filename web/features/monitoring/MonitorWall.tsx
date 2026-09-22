"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { METRIC_META, MONITORING_META, TONE_CLASS } from "@/lib/domain/labels";
import { smoothPath } from "@/utils/path";
import { useNow } from "@/hooks/use-now";
import { useLiveStore } from "@/stores/live";
import { RollingNumber } from "@/components/ui/count-up";
import { MonitoringBadge, StatusDot } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/tabs";
import { IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { thresholdFor } from "@/components/charts/TrendChart";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import { useDeviceHealth, useLatestReading, useLiveTrail } from "@/features/patients/live";
import type { MetricKey, PatientSummary, ReviewPriority } from "@/types/domain";

type Filter = "all" | "review" | "offline";
const RANK: Record<ReviewPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function MonitorWall() {
  const { data } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [metric, setMetric] = useState<MetricKey>("localizedTemperatureC");
  const [full, setFull] = useState(false);
  const connection = useLiveStore((s) => s.connection);
  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients() });

  const list = useMemo(() => {
    const all = [...(patients.data ?? [])].sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.fullName.localeCompare(b.fullName));
    if (filter === "review") return all.filter((p) => p.priority === "critical" || p.priority === "high" || p.openAlertCount > 0);
    if (filter === "offline") return all.filter((p) => p.monitoringStatus === "offline" || p.device?.health === "offline");
    return all;
  }, [patients.data, filter]);

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFull(Boolean(document.fullscreenElement));
    } catch {
      setFull(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <StatusDot tone={connection === "live" ? "signal" : "watch"} pulse={connection === "live"} /> Realtime {connection}
          </span>
        }
        title="Live monitoring"
        description="Every dressing on your list, streaming. Tiles are ordered by review priority, so the ones to look at first sit top left."
        actions={
          <IconButton label={full ? "Exit full screen" : "Full screen"} onClick={toggleFull}>
            {full ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "review", label: "Needs review" },
            { value: "offline", label: "Offline" },
          ]}
        />
        <Segmented
          label="Trace"
          value={metric}
          onChange={setMetric}
          options={(["localizedTemperatureC", "humidityPercent", "relativeMoistureValue"] as MetricKey[]).map((m) => ({ value: m, label: METRIC_META[m].short }))}
        />
      </div>
      {patients.error ? (
        <ErrorState error={patients.error} onRetry={() => patients.refetch()} />
      ) : !patients.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Activity />} title="Nothing to show" body="No patient matches this filter." />
      ) : (
        <ul className="stagger-in grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((p) => (
            <li key={p.id}>
              <MonitorTile patient={p} metric={metric} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function MonitorTile({ patient, metric = "localizedTemperatureC" }: { patient: PatientSummary; metric?: MetricKey }) {
  const { data, home } = useWorkspace();
  const series = useQuery({ queryKey: ["series", patient.id, "1H"], queryFn: () => data.getSeries(patient.id, "1H"), refetchInterval: 60_000, staleTime: 50_000 });
  const trail = useLiveTrail(patient.id);
  const reading = useLatestReading(patient);
  const health = useDeviceHealth(patient);
  const now = useNow(1000);
  const meta = METRIC_META[metric];

  const values = useMemo(() => {
    const base = series.data?.points ?? [];
    const last = base[base.length - 1]?.t ?? 0;
    return [...base, ...trail.filter((t) => t.t > last)].slice(-140).map((pt) => pt[metric]);
  }, [series.data, trail, metric]);

  const threshold = series.data ? thresholdFor(metric, series.data) : null;
  const value = reading?.[metric] ?? null;
  const over = value != null && threshold != null && value >= threshold;
  const age = reading && now ? Math.max(0, Math.round((now - Date.parse(reading.capturedAt)) / 1000)) : null;
  const offline = health === "offline";
  const tone = offline ? "offline" : patient.priority === "critical" ? "critical" : MONITORING_META[patient.monitoringStatus].tone;

  const nums = values.filter((v): v is number => v != null);
  const lo = Math.min(...nums, threshold ?? Infinity);
  const hi = Math.max(...nums, threshold ?? -Infinity);
  const y = (v: number) => 3 + (1 - (v - lo) / (hi - lo || 1)) * 50;
  const trace = nums.length > 1 ? smoothPath(values.flatMap((v, i) => (v == null ? [] : [[(i / (values.length - 1)) * 200, y(v)] as const])), 0.5) : "";
  const thresholdY = threshold != null && nums.length > 1 ? y(threshold) : null;

  return (
    <Link
      href={`${home}/patients/${patient.id}?tab=trends`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-lg border bg-graphite-900/80 p-4 transition-[border-color,background-color,transform] duration-(--dur-standard-fast) ease-(--ease-out-expo) hover:-translate-y-0.5 hover:bg-graphite-850",
        tone === "critical" || tone === "attention" ? "border-attention/30" : "border-(--line) hover:border-(--line-strong)",
      )}
    >
      {(tone === "critical" || tone === "attention") && <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px", TONE_CLASS[tone].dot)} />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-bone">{patient.fullName}</p>
          <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-400">{patient.roomLabel ?? "--"}</p>
        </div>
        <MonitoringBadge status={offline ? "offline" : patient.monitoringStatus} />
      </div>
      <div className="mt-5 flex items-baseline gap-1.5">
        <RollingNumber value={offline ? null : value} decimals={meta.digits} className={cn("text-[2.4rem] font-light tracking-[-0.035em]", over ? "text-attention" : "text-bone")} />
        <span className="font-mono text-[11px] text-graphite-400">{meta.unit}</span>
      </div>
      <svg viewBox="0 0 200 56" preserveAspectRatio="none" className="mt-3 h-14 w-full" aria-hidden>
        {thresholdY != null && <line x1="0" x2="200" y1={thresholdY} y2={thresholdY} stroke="var(--color-attention)" strokeOpacity="0.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
        <path
          d={trace}
          fill="none"
          stroke={offline ? "var(--color-graphite-500)" : over ? "var(--color-attention)" : "var(--color-signal)"}
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-(--line) pt-3 font-mono text-[10.5px] text-graphite-400">
        <span className="tabular">
          {metric !== "humidityPercent" && reading?.humidityPercent != null && <>{reading.humidityPercent.toFixed(0)} %RH · </>}
          {metric !== "relativeMoistureValue" && reading?.relativeMoistureValue != null && <>{Math.round(reading.relativeMoistureValue)} ADC</>}
          {metric === "relativeMoistureValue" && reading?.localizedTemperatureC != null && <>{reading.localizedTemperatureC.toFixed(1)} °C</>}
        </span>
        <span className="tabular flex items-center gap-1.5">
          <StatusDot tone={offline ? "offline" : age != null && age < 30 ? "signal" : "watch"} pulse={!offline && age != null && age < 30} />
          {offline ? "offline" : age == null ? "--" : age < 60 ? `${age}s` : `${Math.round(age / 60)}m`}
        </span>
      </div>
    </Link>
  );
}
