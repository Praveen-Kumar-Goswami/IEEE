"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { DRESSING_LABEL, SEVERITY_META, type Tone } from "@/lib/domain/labels";
import { formatDate, formatDateTime, formatTime } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useWorkspace } from "@/features/dashboard/context";
import { SectionTitle } from "@/features/dashboard/PageHeader";
import type { PatientDetail, TimelineEvent } from "@/types/domain";

const KIND_TONE: Record<TimelineEvent["kind"], Tone> = {
  session: "signal",
  alert: "attention",
  acknowledged: "info",
  resolved: "signal",
  note: "neutral",
  checkin: "signal",
  task: "neutral",
  appointment: "info",
  device: "offline",
};

export function HistoryPanel({ patient }: { patient: PatientDetail }) {
  const { data } = useWorkspace();
  const timeline = useQuery({ queryKey: ["timeline", patient.id], queryFn: () => data.getTimeline(patient.id) });
  const checkins = useQuery({ queryKey: ["checkins", patient.id], queryFn: () => data.listCheckIns(patient.id) });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <SectionTitle title="Timeline" meta={timeline.data ? `${timeline.data.length} events` : undefined} />
        <div className="px-5 pb-6 pt-2">
          {timeline.error ? (
            <ErrorState error={timeline.error} onRetry={() => timeline.refetch()} />
          ) : !timeline.data ? (
            <SkeletonRows rows={6} />
          ) : timeline.data.length === 0 ? (
            <EmptyState icon={<History />} title="No events yet" />
          ) : (
            <Timeline
              items={timeline.data.slice(0, 40).map((e) => ({
                id: e.id,
                at: (
                  <>
                    {formatTime(e.at)}
                    <br />
                    <span className="text-graphite-500">{formatDate(e.at)}</span>
                  </>
                ),
                title: e.title,
                detail: e.detail,
                meta: e.actor,
                tone: e.severity ? SEVERITY_META[e.severity].tone : KIND_TONE[e.kind],
              }))}
            />
          )}
        </div>
      </Card>
      <div className="space-y-4 lg:col-span-5">
        <Card>
          <SectionTitle title="Monitoring sessions" meta={`${patient.sessions.length}`} />
          <ul className="divide-y divide-(--line) border-t border-(--line)">
            {patient.sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-small text-bone">{s.label ?? "Monitoring session"}</p>
                  <p className="font-mono text-[11px] text-graphite-400">
                    {formatDate(s.startedAt)} → {s.endedAt ? formatDate(s.endedAt) : "now"} · {s.deviceSerial}
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone={s.status === "active" ? "signal" : s.status === "paused" ? "watch" : "neutral"} dot={s.status === "active"}>
                    {s.status}
                  </Badge>
                  <p className="tabular mt-1 font-mono text-[10.5px] text-graphite-400">
                    {s.readingCount.toLocaleString("en-GB")} readings · {s.alertCount} ind.
                  </p>
                </div>
              </li>
            ))}
            {patient.sessions.length === 0 && <li className="px-5 py-6 text-small text-graphite-400">No sessions recorded.</li>}
          </ul>
        </Card>
        <Card>
          <SectionTitle title="Bedside check-ins" meta={checkins.data ? `${checkins.data.length}` : undefined} />
          <ul className="divide-y divide-(--line) border-t border-(--line)">
            {(checkins.data ?? []).slice(0, 8).map((c) => (
              <li key={c.id} className="px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-small text-bone">{c.dressingCondition ? DRESSING_LABEL[c.dressingCondition] : "Check-in"}</p>
                  <time className="font-mono text-[10.5px] text-graphite-400" dateTime={c.recordedAt}>
                    {formatDateTime(c.recordedAt)}
                  </time>
                </div>
                <p className="tabular mt-1 font-mono text-[11px] text-graphite-300">
                  {c.bodyTemperatureC != null && <>Body {c.bodyTemperatureC.toFixed(1)} °C · </>}
                  {c.painScore != null && <>Pain {c.painScore}/10 · </>}
                  Device {c.deviceSecure === false ? "not secure" : "secure"}
                </p>
                {c.notes && <p className="mt-1.5 text-[12px] text-graphite-400">{c.notes}</p>}
                <p className="mt-1 text-[11px] text-graphite-500">{c.recordedBy.name}</p>
              </li>
            ))}
            {checkins.data?.length === 0 && <li className="px-5 py-6 text-small text-graphite-400">No check-ins recorded.</li>}
            {!checkins.data && (
              <li className="p-5">
                <SkeletonRows rows={3} />
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
