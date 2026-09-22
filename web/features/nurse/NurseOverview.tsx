"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BellRing, ClipboardCheck, Clock, ListChecks, Users } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { buttonStyles } from "@/components/ui/button";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import { useGreeting } from "@/features/dashboard/Greeting";
import { AlertCard } from "@/features/alerts/AlertCard";
import { MonitorTile } from "@/features/monitoring/MonitorWall";
import { effectiveDue, isOpen, TaskRow } from "@/features/tasks/TaskRow";
import type { ReviewPriority } from "@/types/domain";

const RANK: Record<ReviewPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function NurseOverview() {
  const { data, viewer, home } = useWorkspace();
  const hello = useGreeting(viewer);
  const now = useNow(30_000);
  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients() });
  const tasks = useQuery({ queryKey: ["tasks", "mine"], queryFn: () => data.listTasks({ scope: "mine" }) });
  const alerts = useQuery({ queryKey: ["alerts", "active"], queryFn: () => data.listAlerts({ status: "active" }) });

  const open = useMemo(() => (tasks.data ?? []).filter(isOpen).sort((a, b) => effectiveDue(a) - effectiveDue(b)), [tasks.data]);
  const overdue = now == null ? 0 : open.filter((t) => effectiveDue(t) < now).length;
  const openAlerts = (alerts.data ?? []).filter((a) => a.status === "open");
  const watchList = [...(patients.data ?? [])].sort((a, b) => RANK[a.priority] - RANK[b.priority]).slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow={hello.date}
        title={hello.title}
        description={tasks.data && alerts.data ? `${open.length} task${open.length === 1 ? "" : "s"} left on your shift${overdue ? `, ${overdue} overdue` : ""}. ${openAlerts.length ? `${openAlerts.length} indicator${openAlerts.length === 1 ? " needs" : "s need"} acknowledging.` : "No indicator is waiting."}` : "Loading your shift…"}
        actions={
          <Link href={`${home}/measurements`} className={buttonStyles({ variant: "primary" })}>
            <ClipboardCheck className="size-4" /> Record check-in
          </Link>
        }
      />
      <div className="stagger-in grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assigned patients" value={patients.data?.length} href={`${home}/patients`} icon={<Users />} />
        <MetricCard label="Tasks left" value={tasks.data ? open.length : undefined} href={`${home}/tasks`} icon={<ListChecks />} hint={tasks.data ? `${tasks.data.filter((t) => t.status === "completed").length} done this shift` : undefined} />
        <MetricCard label="Overdue" value={tasks.data ? overdue : undefined} tone="watch" emphasis icon={<Clock />} hint="Past due or past the delay" />
        <MetricCard label="Open indicators" value={alerts.data ? openAlerts.length : undefined} tone="attention" emphasis href={`${home}/alerts`} />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <SectionTitle
            title="Up next"
            meta="By due time"
            actions={
              <Link href={`${home}/tasks`} className="flex items-center gap-1.5 text-small text-graphite-300 transition-colors hover:text-bone">
                All tasks <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {!tasks.data ? (
            <SkeletonRows rows={5} />
          ) : open.length === 0 ? (
            <p className="border-t border-(--line) px-5 py-10 text-center text-small text-graphite-400">Every task is done.</p>
          ) : (
            <ul className="divide-y divide-(--line) border-t border-(--line)">
              {open.slice(0, 6).map((t) => (
                <TaskRow key={t.id} task={t} now={now} />
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-5">
          <SectionTitle
            title="Indicators"
            meta={`${openAlerts.length} open`}
            actions={
              <Link href={`${home}/alerts`} className="text-small text-graphite-300 transition-colors hover:text-bone">
                Queue
              </Link>
            }
          />
          <div className="space-y-2.5 px-4 pb-4">
            {!alerts.data && <Skeleton className="h-28 rounded-lg" />}
            {alerts.data && openAlerts.length === 0 && (
              <p className="flex items-center gap-2.5 rounded-md border border-dashed border-(--line) px-4 py-5 text-small text-graphite-400">
                <BellRing className="size-4" /> Nothing waiting for acknowledgement.
              </p>
            )}
            {openAlerts.slice(0, 3).map((a) => (
              <AlertCard key={a.id} alert={a} compact />
            ))}
          </div>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="watch-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="watch-title" className="text-body font-medium text-bone">
            Keep an eye on
          </h2>
          <Link href={`${home}/monitoring`} className="flex items-center gap-1.5 text-small text-graphite-300 transition-colors hover:text-bone">
            Monitoring wall <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {!patients.data && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
          {watchList.map((p) => (
            <li key={p.id}>
              <MonitorTile patient={p} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
