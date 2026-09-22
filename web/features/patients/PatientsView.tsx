"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { PRIORITY_META } from "@/lib/domain/labels";
import { Card } from "@/components/ui/card";
import { MonitoringBadge, PriorityBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Search } from "@/components/ui/search";
import { Segmented } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { PatientSummary, ReviewPriority } from "@/types/domain";
import { DeviceCell, LastSeen, LiveValue, PatientCell } from "./cells";

type Filter = "all" | "review" | "watch" | "offline";

const PRIORITY_RANK: Record<ReviewPriority, number> = { critical: 3, high: 2, medium: 1, low: 0 };

const MATCH: Record<Filter, (p: PatientSummary) => boolean> = {
  all: () => true,
  review: (p) => p.priority === "critical" || p.priority === "high" || p.openAlertCount > 0,
  watch: (p) => p.monitoringStatus === "watch" || p.monitoringStatus === "attention",
  offline: (p) => p.monitoringStatus === "offline" || p.device?.health === "offline",
};

export function PatientsView() {
  const { data, viewer, home } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients() });
  const admin = viewer.role === "admin";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (patients.data ?? []).filter(
      (p) => MATCH[filter](p) && (!q || `${p.fullName} ${p.roomLabel ?? ""} ${p.device?.serial ?? ""} ${p.doctor?.name ?? ""} ${p.nurse?.name ?? ""}`.toLowerCase().includes(q)),
    );
  }, [patients.data, filter, query]);

  const columns: Column<PatientSummary>[] = [
    { id: "patient", header: "Patient", cell: (p) => <PatientCell patient={p} />, sortValue: (p) => p.fullName },
    { id: "priority", header: "Priority", cell: (p) => <PriorityBadge priority={p.priority} />, sortValue: (p) => PRIORITY_RANK[p.priority] },
    { id: "status", header: "Status", cell: (p) => <MonitoringBadge status={p.monitoringStatus} />, sortValue: (p) => p.monitoringStatus, hideBelow: "md" },
    { id: "temp", header: "Local temp", cell: (p) => <LiveValue patient={p} metric="localizedTemperatureC" />, sortValue: (p) => p.latest?.localizedTemperatureC ?? null, align: "right", hideBelow: "sm" },
    { id: "moisture", header: "Moisture", cell: (p) => <LiveValue patient={p} metric="relativeMoistureValue" />, sortValue: (p) => p.latest?.relativeMoistureValue ?? null, align: "right", hideBelow: "lg" },
    { id: "device", header: "Device", cell: (p) => <DeviceCell patient={p} />, hideBelow: "lg" },
    {
      id: "alerts",
      header: "Open",
      cell: (p) =>
        p.openAlertCount > 0 ? (
          <span className="tabular font-mono text-[12.5px] text-attention">
            {p.openAlertCount}
            {p.acknowledgedAlertCount > 0 && <span className="text-graphite-400"> +{p.acknowledgedAlertCount} ack</span>}
          </span>
        ) : (
          <span className="text-graphite-500">0</span>
        ),
      sortValue: (p) => p.openAlertCount,
      align: "right",
      hideBelow: "md",
    },
    {
      id: "team",
      header: admin ? "Care team" : viewer.role === "doctor" ? "Nurse" : "Doctor",
      cell: (p) => <span className="text-graphite-200">{admin ? [p.doctor?.name, p.nurse?.name].filter(Boolean).join(" · ") || "Unassigned" : ((viewer.role === "doctor" ? p.nurse?.name : p.doctor?.name) ?? "--")}</span>,
      hideBelow: "xl",
    },
    { id: "check", header: "Last check", cell: (p) => <LastSeen at={p.lastCheckAt} />, sortValue: (p) => (p.lastCheckAt ? Date.parse(p.lastCheckAt) : null), hideBelow: "xl" },
  ];

  const counts = useMemo(() => {
    const list = patients.data ?? [];
    return { review: list.filter(MATCH.review).length, watch: list.filter(MATCH.watch).length, offline: list.filter(MATCH.offline).length };
  }, [patients.data]);

  return (
    <>
      <PageHeader
        eyebrow={admin ? "Every facility" : "Active assignments"}
        title="Patients"
        description={
          admin
            ? "Every monitored patient with their care team and device. Review priority ranks the queue; it is not a clinical risk score."
            : "The patients you are assigned to. Values update as each dressing reports."
        }
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) px-5 py-4">
          <Segmented
            label="Filter patients"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All ${patients.data?.length ?? ""}` },
              { value: "review", label: `Needs review ${counts.review}` },
              { value: "watch", label: `Watch ${counts.watch}` },
              { value: "offline", label: `Offline ${counts.offline}` },
            ]}
          />
          <Search value={query} onChange={setQuery} label="Search patients" placeholder="Name, room, device or clinician" className="w-full sm:w-72" />
        </div>
        <DataTable
          caption="Patients"
          rows={patients.data ? rows : undefined}
          columns={columns}
          rowKey={(p) => p.id}
          rowHref={(p) => `${home}/patients/${p.id}`}
          rowTone={(p) => (p.priority === "critical" ? "critical" : p.priority === "high" ? PRIORITY_META.high.tone : null)}
          error={patients.error}
          onRetry={() => patients.refetch()}
          initialSort={{ id: "priority", dir: "desc" }}
          empty={<EmptyState icon={<Users />} title="No patients match" body={query || filter !== "all" ? "Clear the filter to see everyone." : "No active assignments yet."} />}
        />
      </Card>
    </>
  );
}
