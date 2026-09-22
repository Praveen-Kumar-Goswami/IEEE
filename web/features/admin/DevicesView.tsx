"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, Link2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatRelative } from "@/utils/format";
import { useLiveStore } from "@/stores/live";
import { Card } from "@/components/ui/card";
import { DeviceHealthBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Select } from "@/components/ui/field";
import { Drawer } from "@/components/ui/overlay";
import { Search } from "@/components/ui/search";
import { Segmented } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { useAction, useCan, useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { DeviceHealth, DeviceRecord } from "@/types/domain";

type Filter = "all" | DeviceHealth | "spare";

const CONNECTION: Record<DeviceRecord["connection"], string> = { ble_gateway: "Phone gateway", pending_sync: "Buffered, syncing", none: "Not connected" };
const RANK: Record<DeviceHealth, number> = { offline: 0, warning: 1, online: 2 };

export function DevicesView() {
  const { data } = useWorkspace();
  const canManage = useCan("devices.manage");
  const liveHealth = useLiveStore((s) => s.deviceHealth);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [assigning, setAssigning] = useState<DeviceRecord | null>(null);
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => data.listDevices() });

  const list = useMemo(() => (devices.data ?? []).map((d) => ({ ...d, health: liveHealth[d.id] ?? d.health })), [devices.data, liveHealth]);
  const counts = useMemo(
    () => ({
      online: list.filter((d) => d.health === "online").length,
      warning: list.filter((d) => d.health === "warning").length,
      offline: list.filter((d) => d.health === "offline").length,
      spare: list.filter((d) => !d.patient).length,
      lowBattery: list.filter((d) => d.batteryPercent != null && d.batteryPercent < 25).length,
    }),
    [list],
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (d) => (filter === "all" || (filter === "spare" ? !d.patient : d.health === filter)) && (!q || `${d.serial} ${d.name} ${d.patient?.name ?? ""} ${d.firmware ?? ""}`.toLowerCase().includes(q)),
    );
  }, [list, filter, query]);

  const columns: Column<DeviceRecord>[] = [
    {
      id: "device",
      header: "Device",
      sortValue: (d) => d.serial,
      cell: (d) => (
        <span className="min-w-0">
          <span className="block font-mono text-[12.5px] text-bone">{d.serial}</span>
          <span className="block truncate text-[12px] text-graphite-400">{d.name}</span>
        </span>
      ),
    },
    {
      id: "patient",
      header: "Patient",
      sortValue: (d) => d.patient?.name ?? "",
      cell: (d) =>
        d.patient ? (
          <span className="text-graphite-100">{d.patient.name}</span>
        ) : canManage ? (
          <Button size="sm" variant="outline" iconLeft={<Link2 className="size-3.5" />} onClick={() => setAssigning(d)}>
            Assign
          </Button>
        ) : (
          <span className="text-graphite-500">Spare</span>
        ),
    },
    { id: "health", header: "Health", cell: (d) => <DeviceHealthBadge health={d.health} />, sortValue: (d) => RANK[d.health] },
    {
      id: "battery",
      header: "Battery",
      align: "right",
      sortValue: (d) => d.batteryPercent,
      hideBelow: "sm",
      cell: (d) =>
        d.batteryPercent == null ? (
          <span className="text-graphite-500">--</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-12 overflow-hidden rounded-full bg-graphite-800">
              <span className={cn("block h-full rounded-full", d.batteryPercent < 25 ? "bg-watch" : "bg-signal")} style={{ width: `${d.batteryPercent}%` }} />
            </span>
            <span className={cn("tabular w-9 font-mono text-[12px]", d.batteryPercent < 25 ? "text-watch" : "text-graphite-200")}>{Math.round(d.batteryPercent)}%</span>
          </span>
        ),
    },
    { id: "sync", header: "Last sync", cell: (d) => <span className="text-[12.5px] text-graphite-300">{d.lastSyncAt ? formatRelative(d.lastSyncAt) : "Never"}</span>, sortValue: (d) => (d.lastSyncAt ? Date.parse(d.lastSyncAt) : null), hideBelow: "md" },
    { id: "connection", header: "Link", cell: (d) => <span className="text-[12.5px] text-graphite-300">{CONNECTION[d.connection]}</span>, hideBelow: "lg" },
    { id: "session", header: "Session", cell: (d) => <span className={cn("text-[12.5px]", d.sessionActive ? "text-signal" : "text-graphite-500")}>{d.sessionActive ? "Recording" : "Idle"}</span>, hideBelow: "lg" },
    { id: "firmware", header: "Firmware", cell: (d) => <span className="font-mono text-[11.5px] text-graphite-400">{d.firmware ?? "--"}</span>, hideBelow: "xl" },
  ];

  return (
    <>
      <PageHeader eyebrow="Fleet" title="Devices" description="Every ESP32 dressing sensor, its health and who wears it. Devices report over BLE to the patient's phone, which syncs to the API." />
      <dl className="stagger-in mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Online", value: counts.online, tone: "text-signal" },
          { label: "Warning", value: counts.warning, tone: "text-watch" },
          { label: "Offline", value: counts.offline, tone: "text-graphite-300" },
          { label: "Spare", value: counts.spare, tone: "text-bone" },
          { label: "Battery under 25%", value: counts.lowBattery, tone: counts.lowBattery ? "text-watch" : "text-bone" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-(--line) bg-graphite-900/80 px-4 py-3.5">
            <dt className="text-label text-graphite-400">{s.label}</dt>
            <dd className={cn("tabular mt-1.5 text-[1.6rem] font-light tracking-[-0.02em]", s.tone)}>{devices.data ? s.value : "--"}</dd>
          </div>
        ))}
      </dl>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) px-5 py-4">
          <Segmented
            label="Filter devices"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All ${list.length || ""}` },
              { value: "online", label: "Online" },
              { value: "warning", label: "Warning" },
              { value: "offline", label: "Offline" },
              { value: "spare", label: "Spare" },
            ]}
          />
          <Search value={query} onChange={setQuery} label="Search devices" placeholder="Serial, patient or firmware" className="w-full sm:w-72" />
        </div>
        <DataTable
          caption="Devices"
          rows={devices.data ? rows : undefined}
          columns={columns}
          rowKey={(d) => d.id}
          rowTone={(d) => (d.health === "offline" ? "offline" : d.health === "warning" ? "watch" : null)}
          error={devices.error}
          onRetry={() => devices.refetch()}
          initialSort={{ id: "health", dir: "asc" }}
          empty={<EmptyState icon={<Cpu />} title="No devices match" />}
        />
      </Card>
      <AssignDrawer device={assigning} onClose={() => setAssigning(null)} />
    </>
  );
}

function AssignDrawer({ device, onClose }: { device: DeviceRecord | null; onClose: () => void }) {
  const { data } = useWorkspace();
  const [patientId, setPatientId] = useState("");
  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients(), enabled: device != null });
  const candidates = [...(patients.data ?? [])].sort((a, b) => Number(Boolean(a.device)) - Number(Boolean(b.device)) || a.fullName.localeCompare(b.fullName));
  const assign = useAction((d, args: { deviceId: string; patientId: string }) => d.assignDevice(args.deviceId, args.patientId), {
    invalidate: ["devices", "patients", "overview", "audit"],
    success: (d) => `${d.serial} assigned to ${d.patient?.name ?? "the patient"}`,
  });

  return (
    <Drawer
      open={device != null}
      onClose={() => {
        setPatientId("");
        onClose();
      }}
      title={device ? `Assign ${device.serial}` : "Assign device"}
      description="The device pairs with the patient's phone on first contact and starts a monitoring session."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!patientId}
            loading={assign.isPending}
            onClick={() =>
              device &&
              assign.mutate(
                { deviceId: device.id, patientId },
                {
                  onSuccess: () => {
                    setPatientId("");
                    onClose();
                  },
                },
              )
            }
          >
            Assign device
          </Button>
        </>
      }
    >
      <Field label="Patient" hint="Patients without a device are listed first. Choosing someone who has one swaps it for this device.">
        {({ id, describedBy }) => (
          <Select id={id} value={patientId} onChange={(e) => setPatientId(e.target.value)} aria-describedby={describedBy} disabled={!patients.data}>
            <option value="">Choose a patient</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.roomLabel ? ` · ${p.roomLabel}` : ""}
                {p.device ? ` · replaces ${p.device.serial}` : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Drawer>
  );
}
