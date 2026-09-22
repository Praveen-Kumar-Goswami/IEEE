"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, UserX } from "lucide-react";
import { formatDate, formatRelative } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/misc";
import { Modal } from "@/components/ui/overlay";
import { Search } from "@/components/ui/search";
import { Segmented } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { useAction, useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { StaffMember, StaffRole, StaffStatus } from "@/types/domain";

type Filter = "all" | StaffStatus;

const COPY: Record<Exclude<StaffRole, "admin">, { title: string; description: string; noun: string }> = {
  doctor: { title: "Doctors", description: "Doctors with access to the clinical workspace, their unit and how many patients they are assigned.", noun: "doctor" },
  nurse: { title: "Nurses", description: "Nurses with access to the bedside workspace. Suspending an account signs it out and blocks new sessions.", noun: "nurse" },
};

export function StaffView({ role }: { role: Exclude<StaffRole, "admin"> }) {
  const { data, viewer } = useWorkspace();
  const copy = COPY[role];
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<StaffMember | null>(null);
  const staff = useQuery({ queryKey: ["staff", role], queryFn: () => data.listStaff(role) });

  const setStatus = useAction((d, args: { id: string; status: StaffStatus }) => d.setStaffStatus(args.id, args.status), {
    invalidate: ["staff", "overview", "audit"],
    success: (m) => (m.status === "suspended" ? `${m.fullName} suspended` : `${m.fullName} reactivated`),
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (staff.data ?? []).filter((s) => (filter === "all" || s.status === filter) && (!q || `${s.fullName} ${s.email ?? ""} ${s.department ?? ""} ${s.title ?? ""}`.toLowerCase().includes(q)));
  }, [staff.data, filter, query]);

  const suspended = (staff.data ?? []).filter((s) => s.status === "suspended").length;

  const columns: Column<StaffMember>[] = [
    {
      id: "name",
      header: "Name",
      sortValue: (s) => s.fullName,
      cell: (s) => (
        <span className="flex items-center gap-3">
          <Avatar name={s.fullName} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-bone">{s.fullName}</span>
            <span className="block truncate text-[12px] text-graphite-400">{s.email ?? s.title ?? "--"}</span>
          </span>
        </span>
      ),
    },
    { id: "title", header: "Title", cell: (s) => <span className="text-graphite-200">{s.title ?? "--"}</span>, hideBelow: "lg" },
    { id: "unit", header: "Unit", cell: (s) => <span className="text-graphite-200">{s.department ?? s.facilityName ?? "--"}</span>, sortValue: (s) => s.department ?? "", hideBelow: "md" },
    { id: "patients", header: "Patients", cell: (s) => <span className="tabular font-mono text-[12.5px]">{s.assignedPatientCount}</span>, sortValue: (s) => s.assignedPatientCount, align: "right", hideBelow: "sm" },
    {
      id: "status",
      header: "Status",
      cell: (s) => (
        <Badge tone={s.status === "active" ? "signal" : "attention"} dot>
          {s.status === "active" ? "Active" : "Suspended"}
        </Badge>
      ),
      sortValue: (s) => s.status,
    },
    { id: "active", header: "Last active", cell: (s) => <span className="text-[12.5px] text-graphite-300">{s.lastActiveAt ? formatRelative(s.lastActiveAt) : "Never"}</span>, sortValue: (s) => (s.lastActiveAt ? Date.parse(s.lastActiveAt) : null), hideBelow: "lg" },
    { id: "joined", header: "Joined", cell: (s) => <span className="text-[12.5px] text-graphite-400">{formatDate(s.createdAt)}</span>, sortValue: (s) => Date.parse(s.createdAt), hideBelow: "xl" },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "3.5rem",
      cell: (s) =>
        s.id === viewer.id ? null : (
          <Dropdown
            label={`Actions for ${s.fullName}`}
            width="w-52"
            trigger={(p) => (
              <IconButton label={`Actions for ${s.fullName}`} size="sm" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-haspopup="menu" aria-controls={p["aria-controls"]}>
                <MoreHorizontal />
              </IconButton>
            )}
            items={
              s.status === "active"
                ? [{ id: "suspend", label: "Suspend account", tone: "danger", onSelect: () => setConfirm(s) }]
                : [{ id: "reactivate", label: "Reactivate account", onSelect: () => setStatus.mutate({ id: s.id, status: "active" }) }]
            }
          />
        ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Users" title={copy.title} description={copy.description} />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) px-5 py-4">
          <Segmented
            label={`Filter ${copy.title.toLowerCase()}`}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All ${staff.data?.length ?? ""}` },
              { value: "active", label: "Active" },
              { value: "suspended", label: `Suspended ${suspended}` },
            ]}
          />
          <Search value={query} onChange={setQuery} label={`Search ${copy.title.toLowerCase()}`} placeholder="Name, email or unit" className="w-full sm:w-72" />
        </div>
        <DataTable
          caption={copy.title}
          rows={staff.data ? rows : undefined}
          columns={columns}
          rowKey={(s) => s.id}
          rowTone={(s) => (s.status === "suspended" ? "attention" : null)}
          error={staff.error}
          onRetry={() => staff.refetch()}
          initialSort={{ id: "name", dir: "asc" }}
          empty={<EmptyState title={`No ${copy.noun}s match`} body={query || filter !== "all" ? "Clear the filter to see everyone." : undefined} />}
        />
      </Card>
      <Modal
        open={confirm != null}
        onClose={() => setConfirm(null)}
        title={confirm ? `Suspend ${confirm.fullName}?` : ""}
        description="Their sessions end and they cannot sign in until reactivated. Assignments and records stay as they are."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              iconLeft={<UserX className="size-4" />}
              loading={setStatus.isPending}
              onClick={() => confirm && setStatus.mutate({ id: confirm.id, status: "suspended" }, { onSuccess: () => setConfirm(null) })}
            >
              Suspend
            </Button>
          </>
        }
      >
        {confirm && (
          <p className="text-small text-graphite-300">
            {confirm.assignedPatientCount > 0 ? `${confirm.assignedPatientCount} patient${confirm.assignedPatientCount === 1 ? " is" : "s are"} assigned to this ${copy.noun}. Reassign them so nobody is left without cover.` : `This ${copy.noun} has no active assignments.`}
          </p>
        )}
      </Modal>
    </>
  );
}
