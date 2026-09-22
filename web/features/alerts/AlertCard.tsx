"use client";

import Link from "next/link";
import { forwardRef, useState } from "react";
import { motion } from "motion/react";
import { Check, CheckCheck, NotebookPen, Siren } from "lucide-react";
import { cn } from "@/utils/cn";
import { ALERT_STATUS_META, ALERT_TYPE_LABEL, SEVERITY_META, TONE_CLASS } from "@/lib/domain/labels";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { formatDateTime, formatRelative } from "@/utils/format";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction, useCan, useWorkspace } from "@/features/dashboard/context";
import { NoteComposer } from "@/features/notes/NoteComposer";
import type { IndicatorAlert } from "@/types/domain";

const REFRESH = ["alerts", "patients", "overview", "timeline", "notifications"];

export function useAlertActions() {
  const acknowledge = useAction((d, id: string) => d.acknowledgeAlert(id), { invalidate: REFRESH, success: "Indicator acknowledged" });
  const resolve = useAction((d, id: string) => d.resolveAlert(id), { invalidate: REFRESH, success: "Indicator resolved" });
  const escalate = useAction((d, id: string) => d.escalateAlert(id), { invalidate: REFRESH, success: "The assigned doctor has been notified" });
  return { acknowledge, resolve, escalate };
}

export const AlertCard = forwardRef<HTMLElement, { alert: IndicatorAlert; showPatient?: boolean; compact?: boolean }>(function AlertCard(
  { alert, showPatient = true, compact },
  ref,
) {
  const { home } = useWorkspace();
  const canAck = useCan("alerts.acknowledge");
  const canResolve = useCan("alerts.resolve");
  const canEscalate = useCan("alerts.escalate");
  const canNote = useCan("notes.create");
  const { acknowledge, resolve, escalate } = useAlertActions();
  const [noting, setNoting] = useState(false);
  const tone = alert.status === "resolved" ? "neutral" : SEVERITY_META[alert.severity].tone;
  const busy = acknowledge.isPending || resolve.isPending || escalate.isPending;

  return (
    <motion.article
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: DURATION.micro } }}
      transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }}
      className={cn("relative overflow-hidden rounded-lg border border-(--line) bg-graphite-900/80", compact ? "p-4" : "p-5")}
    >
      <span aria-hidden className={cn("absolute inset-y-4 left-0 w-[2px] rounded-full", TONE_CLASS[tone].dot, alert.status === "resolved" && "opacity-30")} />
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <Badge tone={ALERT_STATUS_META[alert.status].tone}>{ALERT_STATUS_META[alert.status].label}</Badge>
        {alert.escalatedAt && alert.status !== "resolved" && (
          <Badge tone="info">
            <Siren className="size-3" /> Doctor notified
          </Badge>
        )}
        <time dateTime={alert.createdAt} title={formatDateTime(alert.createdAt)} className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-400">
          {formatRelative(alert.createdAt)}
        </time>
      </div>
      <h3 className="mt-3 text-body font-medium text-bone">{ALERT_TYPE_LABEL[alert.alertType]}</h3>
      {showPatient && (
        <p className="mt-0.5 text-small text-graphite-300">
          <Link href={`${home}/patients/${alert.patientId}`} className="link-underline text-graphite-100 hover:text-bone">
            {alert.patientName}
          </Link>
          {alert.roomLabel && <> · {alert.roomLabel}</>}
          {alert.deviceSerial && <span className="font-mono text-[11px] text-graphite-400"> · {alert.deviceSerial}</span>}
        </p>
      )}
      {!compact && <p className="mt-3 text-small leading-relaxed text-graphite-300">{alert.message}</p>}
      {(alert.acknowledgedBy || alert.resolvedAt) && (
        <p className="mt-3 text-[12px] text-graphite-400">
          {alert.acknowledgedBy && (
            <>
              Acknowledged by {alert.acknowledgedBy.name}
              {alert.acknowledgedAt && <> · {formatRelative(alert.acknowledgedAt)}</>}
            </>
          )}
          {alert.resolvedAt && <> · Resolved {formatRelative(alert.resolvedAt)}</>}
        </p>
      )}
      {alert.status !== "resolved" && (canAck || canResolve || canEscalate || canNote) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canAck && alert.status === "open" && (
            <Button size="sm" variant="primary" iconLeft={<Check className="size-3.5" />} loading={acknowledge.isPending} disabled={busy} onClick={() => acknowledge.mutate(alert.id)}>
              Acknowledge
            </Button>
          )}
          {canEscalate && !alert.escalatedAt && (
            <Button size="sm" variant="outline" iconLeft={<Siren className="size-3.5" />} loading={escalate.isPending} disabled={busy} onClick={() => escalate.mutate(alert.id)}>
              Notify doctor
            </Button>
          )}
          {canResolve && (
            <Button size="sm" variant={alert.status === "acknowledged" ? "secondary" : "ghost"} iconLeft={<CheckCheck className="size-3.5" />} loading={resolve.isPending} disabled={busy} onClick={() => resolve.mutate(alert.id)}>
              Resolve
            </Button>
          )}
          {canNote && (
            <Button size="sm" variant="ghost" iconLeft={<NotebookPen className="size-3.5" />} onClick={() => setNoting(true)}>
              Add note
            </Button>
          )}
        </div>
      )}
      <NoteComposer open={noting} onClose={() => setNoting(false)} patientId={alert.patientId} patientName={alert.patientName} alertId={alert.id} />
    </motion.article>
  );
});
