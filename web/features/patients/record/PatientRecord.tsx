"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, Lock, NotebookPen } from "lucide-react";
import { formatDate, formatRelative } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { DeviceHealthBadge, MonitoringBadge, PriorityBadge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Avatar, KeyValue } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useCan, useWorkspace } from "@/features/dashboard/context";
import { SectionTitle } from "@/features/dashboard/PageHeader";
import { AlertCard } from "@/features/alerts/AlertCard";
import { NoteComposer } from "@/features/notes/NoteComposer";
import type { PatientDetail } from "@/types/domain";
import { useDeviceHealth } from "../live";
import { LiveTiles } from "./LiveTiles";
import { TrendsPanel, useSeries } from "./TrendsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { CarePlanPanel } from "./CarePlanPanel";
import { NotesPanel } from "./NotesPanel";

type Tab = "overview" | "trends" | "history" | "plan" | "notes";
const TABS: Tab[] = ["overview", "trends", "history", "plan", "notes"];

export function PatientRecord({ patientId }: { patientId: string }) {
  const { data, home } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "overview";
  const setTab = (t: Tab) => router.replace(t === "overview" ? pathname : `${pathname}?tab=${t}`, { scroll: false });

  const patient = useQuery({ queryKey: ["patients", patientId], queryFn: () => data.getPatient(patientId), retry: false });
  const series = useSeries(patientId, "6H");
  const notes = useQuery({ queryKey: ["notes", patientId], queryFn: () => data.listNotes(patientId), enabled: Boolean(patient.data) });

  const back = (
    <Link href={`${home}/patients`} className="group mb-6 inline-flex items-center gap-2 text-small text-graphite-300 transition-colors hover:text-bone">
      <ArrowLeft className="size-4 transition-transform duration-(--dur-micro) group-hover:-translate-x-0.5" /> Patients
    </Link>
  );

  if (patient.error) {
    const denied = (patient.error as { code?: string }).code === "not_found";
    return (
      <>
        {back}
        <Card>
          {denied ? (
            <EmptyState icon={<Lock />} title="This patient is not on your list" body="Records open only for patients with an active assignment. The attempt was written to the audit log." />
          ) : (
            <ErrorState error={patient.error} onRetry={() => patient.refetch()} />
          )}
        </Card>
      </>
    );
  }
  if (patient.data === null) {
    return (
      <>
        {back}
        <Card>
          <EmptyState icon={<Lock />} title="Patient not found" body="The record may have been discharged or the link is out of date." />
        </Card>
      </>
    );
  }
  if (!patient.data) {
    return (
      <>
        {back}
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="mt-6 h-40 rounded-lg" />
        <Skeleton className="mt-6 h-96 rounded-lg" />
      </>
    );
  }

  const p = patient.data;
  return (
    <>
      {back}
      <RecordHeader patient={p} />
      <div className="mt-6">
        <LiveTiles patient={p} series={series.data} />
      </div>
      <Tabs
        label="Patient record"
        idBase="record"
        value={tab}
        onChange={setTab}
        className="mt-8"
        items={[
          { value: "overview", label: "Overview" },
          { value: "trends", label: "Trends" },
          { value: "history", label: "History" },
          { value: "plan", label: "Care plan", count: p.carePlans.filter((c) => c.active).length || undefined },
          { value: "notes", label: "Notes", count: notes.data?.length },
        ]}
      />
      <div className="pt-6">
        <TabPanel idBase="record" value="overview" active={tab}>
          <OverviewPanel patient={p} onTab={setTab} />
        </TabPanel>
        <TabPanel idBase="record" value="trends" active={tab}>
          <TrendsPanel patientId={p.id} />
        </TabPanel>
        <TabPanel idBase="record" value="history" active={tab}>
          <HistoryPanel patient={p} />
        </TabPanel>
        <TabPanel idBase="record" value="plan" active={tab}>
          <CarePlanPanel patient={p} />
        </TabPanel>
        <TabPanel idBase="record" value="notes" active={tab}>
          <NotesPanel patient={p} />
        </TabPanel>
      </div>
    </>
  );
}

function RecordHeader({ patient }: { patient: PatientDetail }) {
  const { viewer } = useWorkspace();
  const canNote = useCan("notes.create");
  const canCheckIn = useCan("checkins.create");
  const health = useDeviceHealth(patient);
  const [noting, setNoting] = useState(false);

  return (
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="flex min-w-0 items-start gap-5">
        <Avatar name={patient.fullName} size="lg" />
        <div className="min-w-0">
          <h1 className="text-h1 font-light text-bone">{patient.fullName}</h1>
          <p className="mt-2 text-small text-graphite-300">
            {[patient.age != null ? `${patient.age} years` : null, patient.roomLabel, patient.facilityName, patient.session?.label].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PriorityBadge priority={patient.priority} />
            <MonitoringBadge status={patient.monitoringStatus} />
            {health && <DeviceHealthBadge health={health} />}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {canCheckIn && viewer.role === "nurse" && (
          <Link href={`/nurse/measurements?patient=${patient.id}`} className={buttonStyles({ variant: "primary", size: "md" })}>
            <ClipboardCheck className="size-4" /> Record check-in
          </Link>
        )}
        {canNote && (
          <Button variant={viewer.role === "nurse" ? "outline" : "primary"} iconLeft={<NotebookPen className="size-4" />} onClick={() => setNoting(true)}>
            Add note
          </Button>
        )}
      </div>
      <NoteComposer open={noting} onClose={() => setNoting(false)} patientId={patient.id} patientName={patient.fullName} />
    </div>
  );
}

function OverviewPanel({ patient, onTab }: { patient: PatientDetail; onTab: (t: Tab) => void }) {
  const { data } = useWorkspace();
  const alerts = useQuery({ queryKey: ["alerts", "patient", patient.id], queryFn: () => data.listAlerts({ patientId: patient.id }) });
  const active = (alerts.data ?? []).filter((a) => a.status !== "resolved");
  const plan = patient.carePlans.find((c) => c.active);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <TrendsPanel patientId={patient.id} compact />
        <Card>
          <SectionTitle
            title="Active indicators"
            meta={`${active.length}`}
            actions={
              <Button size="sm" variant="ghost" onClick={() => onTab("history")}>
                Full history
              </Button>
            }
          />
          <div className="space-y-3 px-5 pb-5">
            {alerts.data && active.length === 0 && <p className="rounded-md border border-dashed border-(--line) px-4 py-6 text-center text-small text-graphite-400">No open indicators for this patient.</p>}
            {!alerts.data && <Skeleton className="h-32 rounded-lg" />}
            {active.map((a) => (
              <AlertCard key={a.id} alert={a} showPatient={false} />
            ))}
          </div>
        </Card>
      </div>
      <div className="space-y-4 lg:col-span-4">
        <Card>
          <SectionTitle title="Care team" />
          <dl className="divide-y divide-(--line) border-t border-(--line) px-5">
            <KeyValue label="Doctor" value={patient.doctor?.name ?? "Unassigned"} />
            <KeyValue label="Nurse" value={patient.nurse?.name ?? "Unassigned"} />
            <KeyValue label="Admitted" value={patient.admittedAt ? formatDate(patient.admittedAt, "long") : "--"} />
            <KeyValue label="Last bedside check" value={patient.lastCheckAt ? formatRelative(patient.lastCheckAt) : "--"} />
            <KeyValue label="Emergency contact" value={patient.emergencyContact ?? "--"} />
          </dl>
        </Card>
        <Card>
          <SectionTitle title="Device" meta={patient.device?.serial} />
          {patient.device ? (
            <dl className="divide-y divide-(--line) border-t border-(--line) px-5">
              <KeyValue label="Pairing" value={<span className="capitalize">{patient.device.pairingStatus}</span>} />
              <KeyValue label="Battery" value={patient.device.batteryPercent != null ? `${Math.round(patient.device.batteryPercent)}%` : "--"} />
              <KeyValue label="Firmware" value={<span className="font-mono text-[12px]">{patient.device.firmware ?? "--"}</span>} />
              <KeyValue label="Last seen" value={patient.device.lastSeenAt ? formatRelative(patient.device.lastSeenAt) : "--"} />
            </dl>
          ) : (
            <p className="border-t border-(--line) px-5 py-5 text-small text-graphite-400">No dressing paired. An administrator assigns devices.</p>
          )}
        </Card>
        <Card>
          <SectionTitle
            title="Care plan"
            actions={
              <Button size="sm" variant="ghost" onClick={() => onTab("plan")}>
                Open
              </Button>
            }
          />
          <div className="border-t border-(--line) px-5 py-4">
            {plan ? (
              <>
                <p className="text-small text-bone">{plan.title}</p>
                <p className="mt-1 line-clamp-3 text-small text-graphite-300">{plan.instructions}</p>
                <p className="tabular mt-3 font-mono text-[11px] text-graphite-400">
                  Change {plan.dressingChangeIntervalHours ? `/${plan.dressingChangeIntervalHours} h` : "--"} · Review {plan.reviewIntervalHours ? `/${plan.reviewIntervalHours} h` : "--"}
                </p>
              </>
            ) : (
              <p className="text-small text-graphite-400">No active plan.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
