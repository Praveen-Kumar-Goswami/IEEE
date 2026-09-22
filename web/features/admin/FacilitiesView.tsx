"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { Facility } from "@/types/domain";

const UNIT_LABEL: Record<Facility["unitType"], string> = { ward: "Inpatient ward", day_unit: "Day unit", outpatient: "Outpatient clinic", simulation_lab: "Simulation lab" };

export function FacilitiesView() {
  const { data } = useWorkspace();
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: () => data.listFacilities() });

  return (
    <>
      <PageHeader eyebrow="Organisation" title="Facilities" description="Wards and units on the platform, how full they are and what is open in each." />
      {facilities.error ? (
        <ErrorState error={facilities.error} onRetry={() => facilities.refetch()} />
      ) : !facilities.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : facilities.data.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 />} title="No facilities yet" />
        </Card>
      ) : (
        <ul className="stagger-in grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {facilities.data.map((f) => {
            const occupancy = f.bedCapacity ? f.patientCount / f.bedCapacity : null;
            return (
              <li key={f.id}>
                <Card className="flex h-full flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-400">{f.code}</p>
                      <h2 className="mt-1.5 text-h3 text-bone">{f.name}</h2>
                      <p className="mt-0.5 text-small text-graphite-300">{UNIT_LABEL[f.unitType]}</p>
                    </div>
                    {f.openAlertCount > 0 ? <Badge tone="attention">{f.openAlertCount} open</Badge> : <Badge tone="signal">Clear</Badge>}
                  </div>
                  <div className="mb-8 mt-8">
                    <div className="flex items-baseline justify-between">
                      <span className="text-label text-graphite-400">Occupancy</span>
                      <span className="tabular font-mono text-small text-bone">
                        {f.patientCount}
                        <span className="text-graphite-400">{f.bedCapacity ? ` / ${f.bedCapacity} beds` : " patients"}</span>
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-graphite-800">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-(--dur-cine) ease-(--ease-out-expo)", occupancy != null && occupancy > 0.9 ? "bg-watch" : "bg-signal")}
                        style={{ width: `${Math.min(100, (occupancy ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-(--line) pt-5">
                    {[
                      ["Staff", f.staffCount],
                      ["Devices", f.deviceCount],
                      ["Patients", f.patientCount],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-label text-graphite-400">{k}</dt>
                        <dd className="tabular mt-1 text-[1.35rem] font-light text-bone">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
