"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { BellRing } from "lucide-react";
import { ALERT_TYPE_LABEL } from "@/lib/domain/labels";
import { Tabs } from "@/components/ui/tabs";
import { Search } from "@/components/ui/search";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { AlertStatus, IndicatorAlert } from "@/types/domain";
import { AlertCard } from "./AlertCard";

type View = "active" | AlertStatus;

const SEVERITY_RANK = { attention: 0, watch: 1, info: 2 } as const;

function sortAlerts(list: IndicatorAlert[], view: View) {
  return [...list].sort((a, b) => {
    if (view === "resolved") return Date.parse(b.resolvedAt ?? b.createdAt) - Date.parse(a.resolvedAt ?? a.createdAt);
    const status = (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1);
    if (status) return status;
    const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    return severity || Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function AlertQueue() {
  const { data, viewer } = useWorkspace();
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const alerts = useQuery({ queryKey: ["alerts", "all"], queryFn: () => data.listAlerts() });

  const counts = useMemo(() => {
    const list = alerts.data ?? [];
    return {
      active: list.filter((a) => a.status !== "resolved").length,
      open: list.filter((a) => a.status === "open").length,
      acknowledged: list.filter((a) => a.status === "acknowledged").length,
      resolved: list.filter((a) => a.status === "resolved").length,
    };
  }, [alerts.data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (alerts.data ?? []).filter((a) => (view === "active" ? a.status !== "resolved" : a.status === view));
    const matched = q ? list.filter((a) => `${a.patientName} ${a.roomLabel ?? ""} ${ALERT_TYPE_LABEL[a.alertType]} ${a.deviceSerial ?? ""}`.toLowerCase().includes(q)) : list;
    return sortAlerts(matched, view).slice(0, 60);
  }, [alerts.data, view, query]);

  return (
    <>
      <PageHeader
        eyebrow="Indicator queue"
        title="Alerts"
        description={
          viewer.role === "nurse"
            ? "Acknowledge an indicator when you have seen it, then check the patient. Notify the doctor if it needs their review."
            : "Indicators from the patients on your list, most urgent first. Acknowledge, review, and resolve when no further action is needed."
        }
      />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Tabs
          label="Alert status"
          value={view}
          onChange={setView}
          items={[
            { value: "active", label: "Active", count: counts.active },
            { value: "open", label: "Open", count: counts.open },
            { value: "acknowledged", label: "Acknowledged", count: counts.acknowledged },
            { value: "resolved", label: "Resolved", count: counts.resolved },
          ]}
          className="flex-1 border-b-0"
        />
        <Search value={query} onChange={setQuery} label="Filter alerts" placeholder="Patient, room or indicator" className="w-full sm:w-72" />
      </div>
      {alerts.error ? (
        <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />
      ) : !alerts.data ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<BellRing />}
          title={view === "resolved" ? "Nothing resolved yet" : "No indicators need attention"}
          body={query ? "No indicator matches that filter." : "New indicators appear here the moment a reading crosses a review threshold."}
        />
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
