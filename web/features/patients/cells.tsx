"use client";

import { Battery, BatteryLow } from "lucide-react";
import { cn } from "@/utils/cn";
import { METRIC_META } from "@/lib/domain/labels";
import { formatRelative } from "@/utils/format";
import { DeviceHealthBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import type { MetricKey, PatientSummary } from "@/types/domain";
import { useDeviceHealth, useLatestReading } from "./live";

export function PatientCell({ patient }: { patient: PatientSummary }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar name={patient.fullName} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-bone">{patient.fullName}</span>
        <span className="block truncate text-[12px] text-graphite-400">
          {[patient.roomLabel, patient.age != null ? `${patient.age} y` : null].filter(Boolean).join(" · ") || "No room"}
        </span>
      </span>
    </span>
  );
}

export function LiveValue({ patient, metric, className }: { patient: PatientSummary; metric: MetricKey; className?: string }) {
  const reading = useLatestReading(patient);
  const meta = METRIC_META[metric];
  const value = reading?.[metric];
  return (
    <span className={cn("tabular font-mono text-[12.5px]", value == null ? "text-graphite-500" : "text-bone", className)}>
      {value == null ? "--" : value.toFixed(meta.digits)}
      <span className="ml-1 text-[10.5px] text-graphite-400">{meta.unit}</span>
    </span>
  );
}

export function DeviceCell({ patient }: { patient: PatientSummary }) {
  const health = useDeviceHealth(patient);
  const reading = useLatestReading(patient);
  if (!patient.device || !health) return <span className="text-small text-graphite-500">No device</span>;
  const battery = reading?.batteryPercent ?? patient.device.batteryPercent;
  const low = battery != null && battery < 25;
  return (
    <span className="flex items-center gap-3">
      <DeviceHealthBadge health={health} />
      {battery != null && (
        <span className={cn("tabular flex items-center gap-1 font-mono text-[11px]", low ? "text-watch" : "text-graphite-400")}>
          {low ? <BatteryLow className="size-3.5" /> : <Battery className="size-3.5" />}
          {Math.round(battery)}%
        </span>
      )}
    </span>
  );
}

export function LastSeen({ at }: { at: string | null }) {
  if (!at) return <span className="text-graphite-500">--</span>;
  return <span className="text-graphite-300">{formatRelative(at)}</span>;
}
