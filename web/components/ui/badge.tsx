import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import {
  DEVICE_HEALTH_META,
  MONITORING_META,
  PRIORITY_META,
  SEVERITY_META,
  TONE_CLASS,
  type Tone,
} from "@/lib/domain/labels";
import type { AlertSeverity, DeviceHealth, MonitoringStatus, ReviewPriority } from "@/types/domain";

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em]",
        t.text,
        t.bg,
        t.border,
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

/** Live dot. `pulse` is reserved for things that are actually streaming. */
export function StatusDot({ tone = "signal", pulse, className, label }: { tone?: Tone; pulse?: boolean; className?: string; label?: string }) {
  const t = TONE_CLASS[tone];
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {pulse && <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping [animation-duration:2.4s]", t.dot)} />}
      <span className={cn("relative size-2 rounded-full", t.dot)} />
    </span>
  );
}

const PRIORITY_BARS: Record<ReviewPriority, number> = { low: 1, medium: 2, high: 3, critical: 4 };

/** Four-step bar plus label, so priority never relies on colour alone. */
export function PriorityBadge({ priority, compact }: { priority: ReviewPriority; compact?: boolean }) {
  const meta = PRIORITY_META[priority];
  const t = TONE_CLASS[meta.tone];
  const level = PRIORITY_BARS[priority];
  return (
    <span className={cn("inline-flex items-center gap-2", t.text)} title={`${meta.label} review priority: ${meta.description}`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("w-[3px] rounded-[1px]", i <= level ? t.dot : "bg-graphite-600")} style={{ height: 4 + i * 2.5 }} />
        ))}
      </span>
      {!compact && <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]">{meta.label}</span>}
      {compact && <span className="sr-only">{meta.label} priority</span>}
    </span>
  );
}

export function MonitoringBadge({ status }: { status: MonitoringStatus }) {
  const meta = MONITORING_META[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const meta = SEVERITY_META[severity];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function DeviceHealthBadge({ health }: { health: DeviceHealth }) {
  const meta = DEVICE_HEALTH_META[health];
  return (
    <span className={cn("inline-flex items-center gap-2 text-small", TONE_CLASS[meta.tone].text)}>
      <StatusDot tone={meta.tone} pulse={health === "online"} />
      {meta.label}
    </span>
  );
}
