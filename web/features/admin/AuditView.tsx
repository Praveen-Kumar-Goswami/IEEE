"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { formatDate, formatTime } from "@/utils/format";
import { downloadText, toCsv } from "@/utils/csv";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Search } from "@/components/ui/search";
import { Segmented } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { AuditEntry } from "@/types/domain";
import { describeAction, describeMetadata, describeTarget, RESULT_TONE } from "./audit-format";

type Result = "all" | AuditEntry["result"];
type Period = "1" | "7" | "30";
const DAY = 86_400_000;

export function AuditView() {
  const { data } = useWorkspace();
  const [result, setResult] = useState<Result>("all");
  const [period, setPeriod] = useState<Period>("7");
  const [query, setQuery] = useState("");
  const since = useMemo(() => new Date(Math.floor((Date.now() - Number(period) * DAY) / 60_000) * 60_000).toISOString(), [period]);
  const audit = useQuery({ queryKey: ["audit", since], queryFn: () => data.listAuditLogs({ since, limit: 1000 }), placeholderData: (prev) => prev });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (audit.data ?? []).filter(
      (e) => (result === "all" || e.result === result) && (!q || `${e.actor?.name ?? ""} ${e.action} ${describeAction(e.action)} ${e.entityType} ${describeMetadata(e)}`.toLowerCase().includes(q)),
    );
  }, [audit.data, result, query]);
  const flagged = (audit.data ?? []).filter((e) => e.result !== "success").length;

  const exportCsv = () =>
    downloadText(
      `audit-${since.slice(0, 10)}.csv`,
      toCsv(
        rows.map((e) => ({ at: e.createdAt, actor: e.actor?.name ?? "", role: e.actor?.role ?? "", action: e.action, entity: e.entityType, entity_id: e.entityId ?? "", result: e.result, details: describeMetadata(e) })),
        [
          { key: "at", label: "Time" },
          { key: "actor", label: "Actor" },
          { key: "role", label: "Role" },
          { key: "action", label: "Action" },
          { key: "entity", label: "Entity" },
          { key: "entity_id", label: "Entity ID" },
          { key: "result", label: "Result" },
          { key: "details", label: "Details" },
        ],
      ),
    );

  const columns: Column<AuditEntry>[] = [
    {
      id: "at",
      header: "Time",
      sortValue: (e) => Date.parse(e.createdAt),
      width: "8rem",
      cell: (e) => (
        <span className="tabular font-mono text-[12px] leading-tight">
          <span className="block text-bone">{formatTime(e.createdAt, true)}</span>
          <span className="block text-graphite-400">{formatDate(e.createdAt)}</span>
        </span>
      ),
    },
    {
      id: "actor",
      header: "Actor",
      sortValue: (e) => e.actor?.name ?? "",
      cell: (e) => (
        <span className="min-w-0">
          <span className="block truncate text-bone">{e.actor?.name ?? "Unknown"}</span>
          <span className="block text-[11.5px] text-graphite-400">{e.actor ? (e.actor.role === "patient" ? "Patient" : ROLE_LABEL[e.actor.role]) : "Not signed in"}</span>
        </span>
      ),
    },
    {
      id: "action",
      header: "Action",
      sortValue: (e) => e.action,
      cell: (e) => {
        const target = describeTarget(e);
        return (
          <span className="min-w-0">
            <span className="block text-graphite-100">{describeAction(e.action)}</span>
            <span className="block truncate font-mono text-[11px] text-graphite-500">
              {e.action}
              {target && <span className="font-sans text-graphite-400"> · {target}</span>}
            </span>
          </span>
        );
      },
    },
    { id: "entity", header: "Entity", cell: (e) => <span className="font-mono text-[11.5px] text-graphite-300">{e.entityType}</span>, hideBelow: "lg" },
    {
      id: "result",
      header: "Result",
      sortValue: (e) => e.result,
      cell: (e) => (
        <Badge tone={RESULT_TONE[e.result]} dot>
          {e.result}
        </Badge>
      ),
    },
    { id: "details", header: "Details", cell: (e) => <span className="line-clamp-2 max-w-xs text-[12px] text-graphite-400">{describeMetadata(e) || "--"}</span>, hideBelow: "xl" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Every sign-in, record access and change, written by the database. Entries cannot be edited or deleted from the workspace."
        actions={
          <Button variant="outline" iconLeft={<Download className="size-4" />} onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Result"
              value={result}
              onChange={setResult}
              options={[
                { value: "all", label: "All" },
                { value: "success", label: "Success" },
                { value: "denied", label: "Denied" },
                { value: "failed", label: "Failed" },
              ]}
            />
            <Segmented
              label="Period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "1", label: "24 h" },
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
              ]}
            />
            {flagged > 0 && <span className="text-[12px] text-attention">{flagged} denied or failed</span>}
          </div>
          <Search value={query} onChange={setQuery} label="Search the audit log" placeholder="Person, action or detail" className="w-full sm:w-72" />
        </div>
        <DataTable
          caption="Audit log"
          rows={audit.data ? rows : undefined}
          columns={columns}
          rowKey={(e) => e.id}
          rowTone={(e) => (e.result === "success" ? null : RESULT_TONE[e.result])}
          error={audit.error}
          onRetry={() => audit.refetch()}
          initialSort={{ id: "at", dir: "desc" }}
          pageSize={20}
          empty={<EmptyState icon={<ScrollText />} title="No entries match" body="Widen the period or clear the filter." />}
        />
      </Card>
    </>
  );
}
