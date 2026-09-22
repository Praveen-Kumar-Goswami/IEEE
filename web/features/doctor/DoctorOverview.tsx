"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BellRing, CalendarDays, CircleAlert, Users } from "lucide-react";
import { cn } from "@/utils/cn";
import { APPOINTMENT_KIND_LABEL, APPOINTMENT_STATUS_META } from "@/lib/domain/labels";
import { formatTime } from "@/utils/format";
import { sparkPath } from "@/utils/path";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import { useGreeting } from "@/features/dashboard/Greeting";
import { AlertCard } from "@/features/alerts/AlertCard";
import { LiveValue, PatientCell } from "@/features/patients/cells";
import { useLiveTrail } from "@/features/patients/live";
import type { PatientSummary, ReviewPriority } from "@/types/domain";

const RANK: Record<ReviewPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function DoctorOverview() {
  const { data, viewer, home } = useWorkspace();
  const hello = useGreeting(viewer);
  const { from, to } = useMemo(dayBounds, []);
  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients() });
  const alerts = useQuery({ queryKey: ["alerts", "active"], queryFn: () => data.listAlerts({ status: "active" }) });
  const appointments = useQuery({ queryKey: ["appointments", from, to], queryFn: () => data.listAppointments(from, to) });

  const queue = useMemo(() => [...(patients.data ?? [])].sort((a, b) => RANK[a.priority] - RANK[b.priority] || b.openAlertCount - a.openAlertCount).slice(0, 6), [patients.data]);
  const open = alerts.data?.filter((a) => a.status === "open") ?? [];
  const review = patients.data?.filter((p) => p.priority === "critical" || p.priority === "high").length;
  const today = (appointments.data ?? []).filter((a) => a.status !== "cancelled");

  return (
    <>
      <PageHeader
        eyebrow={hello.date}
        title={hello.title}
        description={
          patients.data && alerts.data
            ? `${review === 0 ? "No patient needs priority review" : `${review} patient${review === 1 ? " needs" : "s need"} priority review`}, and ${open.length === 0 ? "every indicator has been acknowledged" : `${open.length} indicator${open.length === 1 ? " is" : "s are"} waiting for acknowledgement`}.`
            : "Loading your unit…"
        }
      />
      <div className="stagger-in grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Monitored patients" value={patients.data?.length} href={`${home}/patients`} icon={<Users />} hint={viewer.facilityName ?? undefined} />
        <MetricCard label="Open indicators" value={open.length} tone="attention" emphasis href={`${home}/alerts`} hint={alerts.data ? `${alerts.data.length - open.length} acknowledged, not resolved` : undefined} />
        <MetricCard label="Priority review" value={review} tone="critical" emphasis icon={<CircleAlert />} hint="High or critical review priority" />
        <MetricCard label="Appointments today" value={appointments.data ? today.length : undefined} href={`${home}/appointments`} icon={<CalendarDays />} hint={today[0] ? `Next at ${formatTime(today.find((a) => Date.parse(a.startsAt) > Date.now())?.startsAt ?? today[0].startsAt)}` : "Nothing scheduled"} />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <SectionTitle
            title="Review queue"
            meta="By review priority"
            actions={
              <Link href={`${home}/patients`} className="flex items-center gap-1.5 text-small text-graphite-300 transition-colors hover:text-bone">
                All patients <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {!patients.data ? (
            <SkeletonRows rows={5} />
          ) : (
            <ul className="border-t border-(--line)">
              {queue.map((p) => (
                <QueueRow key={p.id} patient={p} href={`${home}/patients/${p.id}`} />
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-4">
          <Card>
            <SectionTitle
              title="Waiting for you"
              meta={`${open.length} open`}
              actions={
                <Link href={`${home}/alerts`} className="text-small text-graphite-300 transition-colors hover:text-bone">
                  Queue
                </Link>
              }
            />
            <div className="space-y-2.5 px-4 pb-4">
              {!alerts.data && <Skeleton className="h-28 rounded-lg" />}
              {alerts.data && open.length === 0 && (
                <p className="flex items-center gap-2.5 rounded-md border border-dashed border-(--line) px-4 py-5 text-small text-graphite-400">
                  <BellRing className="size-4" /> Every indicator has been acknowledged.
                </p>
              )}
              {open.slice(0, 3).map((a) => (
                <AlertCard key={a.id} alert={a} compact />
              ))}
            </div>
          </Card>
          <Card>
            <SectionTitle title="Today" meta={`${today.length} appointments`} />
            <ul className="divide-y divide-(--line) border-t border-(--line)">
              {!appointments.data && (
                <li>
                  <SkeletonRows rows={3} />
                </li>
              )}
              {appointments.data && today.length === 0 && <li className="px-5 py-6 text-small text-graphite-400">No appointments today.</li>}
              {today.slice(0, 5).map((a) => {
                const past = Date.parse(a.endsAt) < Date.now();
                return (
                  <li key={a.id} className={cn("flex items-center gap-4 px-5 py-3.5", past && "opacity-60")}>
                    <span className="tabular w-11 font-mono text-small text-bone">{formatTime(a.startsAt)}</span>
                    <span className="min-w-0 flex-1">
                      <Link href={`${home}/patients/${a.patientId}`} className="block truncate text-small text-bone hover:underline">
                        {a.patientName}
                      </Link>
                      <span className="block truncate text-[12px] text-graphite-400">
                        {APPOINTMENT_KIND_LABEL[a.kind]}
                        {a.location && ` · ${a.location}`}
                      </span>
                    </span>
                    {a.status !== "scheduled" && <Badge tone={APPOINTMENT_STATUS_META[a.status].tone}>{APPOINTMENT_STATUS_META[a.status].label}</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function QueueRow({ patient, href }: { patient: PatientSummary; href: string }) {
  const trail = useLiveTrail(patient.id);
  const values = trail.slice(-48).map((p) => p.localizedTemperatureC);
  return (
    <li className="border-b border-(--line) last:border-0">
      <Link
        href={href}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1.4fr)_7rem_6rem_5.5rem_auto] lg:grid-cols-[minmax(0,1fr)_7rem_5.5rem_auto] xl:grid-cols-[minmax(0,1.4fr)_7rem_6rem_5.5rem_auto]"
      >
        <PatientCell patient={patient} />
        <span className="hidden sm:block">
          <PriorityBadge priority={patient.priority} />
        </span>
        <svg viewBox="0 0 96 24" className="hidden h-6 w-24 sm:block lg:hidden xl:block" aria-hidden>
          <path d={sparkPath(values, 96, 24)} fill="none" stroke="var(--color-signal)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" opacity="0.85" />
        </svg>
        <LiveValue patient={patient} metric="localizedTemperatureC" className="hidden text-right sm:block" />
        <span className="flex items-center justify-end gap-3">
          {patient.openAlertCount > 0 && <Badge tone="attention">{patient.openAlertCount} open</Badge>}
          <ArrowRight className="size-4 text-graphite-500 transition-transform duration-(--dur-micro) group-hover:translate-x-0.5 group-hover:text-bone" />
        </span>
      </Link>
    </li>
  );
}
