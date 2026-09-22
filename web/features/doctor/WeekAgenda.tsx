"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { APPOINTMENT_KIND_LABEL, APPOINTMENT_STATUS_META, TONE_CLASS, type Tone } from "@/lib/domain/labels";
import { formatDate, formatTime, formatWeekday } from "@/utils/format";
import { useNow } from "@/hooks/use-now";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { KeyValue } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useAction, useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { Appointment, AppointmentInput, AppointmentKind } from "@/types/domain";

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_PX = 56;
const DAY = 86_400_000;

const KIND_TONE: Record<AppointmentKind, Tone> = {
  indicator_review: "signal",
  dressing_change: "watch",
  follow_up: "info",
  device_fitting: "neutral",
};

const KIND_BLOCK: Record<AppointmentKind, string> = {
  indicator_review: "bg-signal/10 border-l-signal",
  dressing_change: "bg-watch/10 border-l-watch",
  follow_up: "bg-info/10 border-l-info",
  device_fitting: "bg-graphite-700/50 border-l-graphite-300",
};

function mondayOf(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7;
  return d.getTime() - shift * DAY;
}

export function WeekAgenda() {
  const { data } = useWorkspace();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);
  const now = useNow(60_000);

  const week = useMemo(() => {
    const start = mondayOf(Date.now()) + offset * 7 * DAY;
    return { start, end: start + 7 * DAY, days: Array.from({ length: 7 }, (_, i) => start + i * DAY) };
  }, [offset]);

  const from = new Date(week.start).toISOString();
  const to = new Date(week.end).toISOString();
  const appointments = useQuery({ queryKey: ["appointments", from, to], queryFn: () => data.listAppointments(from, to), placeholderData: (prev) => prev });

  const byDay = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    for (const a of appointments.data ?? []) {
      const d = new Date(a.startsAt);
      d.setHours(0, 0, 0, 0);
      map.set(d.getTime(), [...(map.get(d.getTime()) ?? []), a].sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt)));
    }
    return map;
  }, [appointments.data]);

  const total = (appointments.data ?? []).filter((a) => a.status !== "cancelled").length;

  return (
    <>
      <PageHeader
        eyebrow={`${formatDate(week.start, "long")} – ${formatDate(week.end - DAY, "long")}`}
        title="Appointments"
        description={`${total} scheduled this week: indicator reviews, dressing changes and follow-ups.`}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-full border border-(--line) p-1">
              <IconButton label="Previous week" size="sm" tone="subtle" onClick={() => setOffset((o) => o - 1)}>
                <ChevronLeft />
              </IconButton>
              <button onClick={() => setOffset(0)} className="h-8 rounded-full px-3 text-small text-graphite-200 transition-colors hover:bg-white/[0.05] hover:text-bone">
                This week
              </button>
              <IconButton label="Next week" size="sm" tone="subtle" onClick={() => setOffset((o) => o + 1)}>
                <ChevronRight />
              </IconButton>
            </div>
            <Button variant="primary" iconLeft={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              New appointment
            </Button>
          </>
        }
      />
      {appointments.error ? (
        <ErrorState error={appointments.error} onRetry={() => appointments.refetch()} />
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-(--line)">
              <span />
              {week.days.map((d) => {
                const today = now != null && d <= now && now < d + DAY;
                return (
                  <div key={d} className="border-l border-(--line) px-3 py-3">
                    <p className={cn("text-label", today ? "text-signal" : "text-graphite-400")}>{new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d)}</p>
                    <p className={cn("tabular mt-0.5 text-h3 font-light", today ? "text-bone" : "text-graphite-200")}>{new Date(d).getDate()}</p>
                  </div>
                );
              })}
            </div>
            <div className="relative grid max-h-[40rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] overflow-y-auto">
              <div>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} style={{ height: HOUR_PX }} className="tabular pr-2 pt-1 text-right font-mono text-[10px] text-graphite-500">
                    {String(START_HOUR + i).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {week.days.map((d) => {
                const items = byDay.get(d) ?? [];
                const today = now != null && d <= now && now < d + DAY;
                const nowTop = today && now ? ((now - d) / 3_600_000 - START_HOUR) * HOUR_PX : null;
                return (
                  <div key={d} className={cn("relative border-l border-(--line)", today && "bg-signal/[0.02]")} style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div key={i} aria-hidden className="border-b border-(--line)/60" style={{ height: HOUR_PX }} />
                    ))}
                    {nowTop != null && nowTop > 0 && nowTop < (END_HOUR - START_HOUR) * HOUR_PX && (
                      <div aria-hidden className="absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                        <span className="-ml-1 size-2 rounded-full bg-signal" />
                        <span className="h-px flex-1 bg-signal/70" />
                      </div>
                    )}
                    {!appointments.data && <Skeleton className="absolute inset-x-1.5 top-24 h-20" />}
                    {items.map((a) => {
                      const start = new Date(a.startsAt);
                      const hours = start.getHours() + start.getMinutes() / 60;
                      const top = Math.max(0, (hours - START_HOUR) * HOUR_PX);
                      const height = Math.max(26, ((Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 3_600_000) * HOUR_PX - 3);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelected(a)}
                          style={{ top: top + 1, height }}
                          className={cn(
                            "absolute inset-x-1.5 overflow-hidden rounded-sm border-l-2 px-2 py-1 text-left transition-[filter,transform] duration-(--dur-micro) hover:brightness-125 focus-visible:z-20",
                            KIND_BLOCK[a.kind],
                            a.status === "cancelled" && "opacity-40 line-through",
                            a.status === "completed" && "opacity-60",
                          )}
                        >
                          <p className="truncate text-[12px] font-medium text-bone">{a.patientName}</p>
                          {height > 40 && (
                            <p className="truncate font-mono text-[10px] text-graphite-300">
                              {formatTime(a.startsAt)} · {APPOINTMENT_KIND_LABEL[a.kind]}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-6 lg:hidden">
            {week.days.map((d) => {
              const items = byDay.get(d) ?? [];
              return (
                <section key={d}>
                  <h2 className="text-label mb-2 text-graphite-400">{formatWeekday(d)}</h2>
                  {items.length === 0 ? (
                    <p className="rounded-md border border-dashed border-(--line) px-4 py-3 text-small text-graphite-500">Nothing scheduled</p>
                  ) : (
                    <Card>
                      <ul className="divide-y divide-(--line)">
                        {items.map((a) => (
                          <li key={a.id}>
                            <button onClick={() => setSelected(a)} className="flex w-full items-center gap-4 px-4 py-3 text-left">
                              <span className={cn("h-9 w-0.5 rounded-full", TONE_CLASS[KIND_TONE[a.kind]].dot)} />
                              <span className="tabular w-11 font-mono text-small text-bone">{formatTime(a.startsAt)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-small text-bone">{a.patientName}</span>
                                <span className="block truncate text-[12px] text-graphite-400">{APPOINTMENT_KIND_LABEL[a.kind]}</span>
                              </span>
                              {a.status !== "scheduled" && <Badge tone={APPOINTMENT_STATUS_META[a.status].tone}>{APPOINTMENT_STATUS_META[a.status].label}</Badge>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
      <AppointmentDrawer appointment={selected} onClose={() => setSelected(null)} />
      <NewAppointment open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function AppointmentDrawer({ appointment, onClose }: { appointment: Appointment | null; onClose: () => void }) {
  const { home } = useWorkspace();
  const update = useAction((d, args: { id: string; status: Appointment["status"] }) => d.updateAppointmentStatus(args.id, args.status), {
    invalidate: ["appointments", "timeline"],
    success: (a) => `Marked ${APPOINTMENT_STATUS_META[a.status].label.toLowerCase()}`,
  });
  const a = appointment;
  const set = (status: Appointment["status"]) => a && update.mutate({ id: a.id, status }, { onSuccess: onClose });

  return (
    <Drawer
      open={Boolean(a)}
      onClose={onClose}
      title={a ? APPOINTMENT_KIND_LABEL[a.kind] : ""}
      description={a ? `${formatWeekday(a.startsAt)} · ${formatTime(a.startsAt)}–${formatTime(a.endsAt)}` : undefined}
      footer={
        a?.status === "scheduled" && (
          <>
            <Button variant="ghost" onClick={() => set("cancelled")} disabled={update.isPending}>
              Cancel appointment
            </Button>
            <Button variant="outline" onClick={() => set("missed")} disabled={update.isPending}>
              Missed
            </Button>
            <Button variant="primary" onClick={() => set("completed")} loading={update.isPending}>
              Mark completed
            </Button>
          </>
        )
      }
    >
      {a && (
        <>
          <Badge tone={APPOINTMENT_STATUS_META[a.status].tone}>{APPOINTMENT_STATUS_META[a.status].label}</Badge>
          <dl className="mt-5 divide-y divide-(--line) border-y border-(--line)">
            <KeyValue
              label="Patient"
              value={
                <Link href={`${home}/patients/${a.patientId}`} className="link-underline">
                  {a.patientName}
                </Link>
              }
            />
            <KeyValue label="Clinician" value={a.clinician.name} />
            <KeyValue
              label="Location"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-graphite-400" />
                  {a.location ?? "--"}
                </span>
              }
            />
          </dl>
          {a.notes && <p className="mt-5 whitespace-pre-line text-small leading-relaxed text-graphite-200">{a.notes}</p>}
        </>
      )}
    </Drawer>
  );
}

function NewAppointment({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useWorkspace();
  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients(), enabled: open });
  const tomorrow = new Date(Date.now() + DAY).toISOString().slice(0, 10);
  const [form, setForm] = useState({ patientId: "", kind: "indicator_review" as AppointmentKind, date: tomorrow, time: "10:00", duration: "30", location: "", notes: "" });
  const create = useAction((d, input: AppointmentInput) => d.createAppointment(input), { invalidate: ["appointments", "timeline"], success: "Appointment scheduled" });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const patientId = form.patientId || patients.data?.[0]?.id;
    if (!patientId) return;
    create.mutate(
      {
        patientId,
        kind: form.kind,
        startsAt: new Date(`${form.date}T${form.time}`).toISOString(),
        durationMinutes: Number(form.duration),
        location: form.location || null,
        notes: form.notes || null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New appointment"
      description="The patient's nurse sees it on their task list."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-appointment" loading={create.isPending} iconLeft={<CalendarDays className="size-4" />}>
            Schedule
          </Button>
        </>
      }
    >
      <form id="new-appointment" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Patient" className="sm:col-span-2">
          {({ id }) => (
            <Select id={id} value={form.patientId} onChange={(e) => set("patientId", e.target.value)} data-autofocus>
              {(patients.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} {p.roomLabel ? `· ${p.roomLabel}` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Type">
          {({ id }) => (
            <Select id={id} value={form.kind} onChange={(e) => set("kind", e.target.value as AppointmentKind)}>
              {(Object.keys(APPOINTMENT_KIND_LABEL) as AppointmentKind[]).map((k) => (
                <option key={k} value={k}>
                  {APPOINTMENT_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Duration">
          {({ id }) => (
            <Select id={id} value={form.duration} onChange={(e) => set("duration", e.target.value)}>
              {["15", "30", "45", "60"].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date">{({ id }) => <Input id={id} type="date" value={form.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => set("date", e.target.value)} required />}</Field>
        <Field label="Time">{({ id }) => <Input id={id} type="time" value={form.time} step={900} onChange={(e) => set("time", e.target.value)} required />}</Field>
        <Field label="Location" optional className="sm:col-span-2">
          {({ id }) => <Input id={id} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Bedside, treatment room 2…" />}
        </Field>
        <Field label="Notes" optional className="sm:col-span-2">
          {({ id }) => <Textarea id={id} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
