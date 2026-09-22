"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { DRESSING_LABEL, TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { checkClinicalWording } from "@/lib/domain/rules";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { formatRelative, formatTime } from "@/utils/format";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Card } from "@/components/ui/card";
import { MonitoringBadge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Avatar, KeyValue } from "@/components/ui/misc";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useAction, useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import { isOpen } from "@/features/tasks/TaskRow";
import type { CheckIn, CheckInInput, DressingCondition } from "@/types/domain";

const STEPS = ["Patient", "Measurements", "Dressing", "Confirm"] as const;

const DRESSING_HINT: Record<DressingCondition, string> = {
  intact: "Seal intact, no visible moisture.",
  damp: "Some moisture at the edge; the seal is holding.",
  saturated: "Pad saturated; a change is due.",
  lifted: "An edge has lifted; check device contact.",
  replaced: "Dressing replaced during this check.",
};

export function CheckInFlow() {
  const { data } = useWorkspace();
  const params = useSearchParams();
  const reduced = useReducedMotion();
  const preset = params.get("patient");
  const [step, setStep] = useState(preset ? 1 : 0);
  const [dir, setDir] = useState(1);
  const [patientId, setPatientId] = useState(preset ?? "");
  const [taskId, setTaskId] = useState(params.get("task") ?? "");
  const [temp, setTemp] = useState<number | null>(36.8);
  const [pain, setPain] = useState<number | null>(null);
  const [dressing, setDressing] = useState<DressingCondition | null>(null);
  const [secure, setSecure] = useState<boolean | null>(true);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState<CheckIn | null>(null);

  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients() });
  const tasks = useQuery({ queryKey: ["tasks", "mine"], queryFn: () => data.listTasks({ scope: "mine" }) });
  const recent = useQuery({ queryKey: ["checkins", "all"], queryFn: () => data.listCheckIns() });
  const patient = patients.data?.find((p) => p.id === patientId) ?? null;
  const patientTasks = useMemo(() => (tasks.data ?? []).filter((t) => t.patientId === patientId && isOpen(t)), [tasks.data, patientId]);
  const wording = checkClinicalWording(notes);

  const submit = useAction((d, input: CheckInInput) => d.submitCheckIn(input), {
    invalidate: ["checkins", "tasks", "patients", "timeline", "overview"],
    success: "Check-in saved",
  });

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  const reset = () => {
    setSaved(null);
    setPatientId("");
    setTaskId("");
    setTemp(36.8);
    setPain(null);
    setDressing(null);
    setSecure(true);
    setNotes("");
    go(0);
  };

  const confirm = () => {
    if (!patient) return;
    submit.mutate(
      { patientId: patient.id, taskId: taskId || null, bodyTemperatureC: temp, painScore: pain, dressingCondition: dressing, deviceSecure: secure, notes: notes.trim() || null },
      { onSuccess: (c) => setSaved(c) },
    );
  };

  const canNext = step === 0 ? Boolean(patient) : step === 1 ? temp != null || pain != null : step === 2 ? dressing != null && !wording : true;
  const variants = reduced
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : { enter: (d: number) => ({ opacity: 0, x: d * 40 }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: d * -40 }) };

  return (
    <>
      <PageHeader eyebrow="Bedside check-in" title="Measurements" description="Record what you measured and saw at the bedside. It joins the sensor record so the doctor sees both." />
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-8">
          {!saved && (
            <div className="relative border-b border-(--line)">
            <ol className="grid grid-cols-4">
              {STEPS.map((label, i) => (
                <li key={label} className="relative px-4 py-3.5">
                  <button onClick={() => i < step && go(i)} disabled={i >= step} className="flex items-center gap-2.5 text-left disabled:cursor-default" aria-current={i === step ? "step" : undefined}>
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] transition-colors duration-(--dur-standard-fast)",
                        i < step ? "border-signal bg-signal text-graphite-950" : i === step ? "border-bone text-bone" : "border-(--line-strong) text-graphite-500",
                      )}
                    >
                      {i < step ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={cn("hidden text-small sm:block", i <= step ? "text-bone" : "text-graphite-500")}>{label}</span>
                  </button>
                </li>
              ))}
            </ol>
            <motion.span aria-hidden className="absolute -bottom-px left-0 h-px bg-signal" initial={false} animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }} />
            </div>
          )}
          <div className="relative min-h-[26rem] p-5 sm:p-7">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={saved ? "done" : step} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: DURATION.standardFast, ease: BEZIER.outExpo }}>
                {saved ? (
                  <Success checkIn={saved} onAgain={reset} />
                ) : step === 0 ? (
                  <div>
                    <h2 className="text-h3 text-bone">Who are you checking?</h2>
                    <p className="mt-1 text-small text-graphite-300">Patients on your assignment list.</p>
                    {!patients.data ? (
                      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                        {Array.from({ length: 6 }, (_, i) => (
                          <Skeleton key={i} className="h-20 rounded-md" />
                        ))}
                      </div>
                    ) : (
                      <div role="radiogroup" aria-label="Patient" className="mt-6 grid gap-2.5 sm:grid-cols-2">
                        {patients.data.map((p) => {
                          const pending = (tasks.data ?? []).filter((t) => t.patientId === p.id && isOpen(t)).length;
                          const selected = p.id === patientId;
                          return (
                            <button
                              key={p.id}
                              role="radio"
                              aria-checked={selected}
                              onClick={() => {
                                setPatientId(p.id);
                                setTaskId("");
                              }}
                              onDoubleClick={() => {
                                setPatientId(p.id);
                                go(1);
                              }}
                              className={cn(
                                "flex items-center gap-3 rounded-md border p-3.5 text-left transition-[border-color,background-color] duration-(--dur-micro-slow)",
                                selected ? "border-signal/45 bg-signal/[0.05]" : "border-(--line) hover:border-(--line-strong) hover:bg-white/[0.02]",
                              )}
                            >
                              <Avatar name={p.fullName} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-small font-medium text-bone">{p.fullName}</span>
                                <span className="block truncate text-[12px] text-graphite-400">
                                  {p.roomLabel ?? "--"} · last check {p.lastCheckAt ? formatRelative(p.lastCheckAt) : "never"}
                                </span>
                              </span>
                              {pending > 0 && <span className="tabular rounded-full bg-graphite-750 px-1.5 font-mono text-[10px] leading-5 text-graphite-100">{pending}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : step === 1 ? (
                  <div className="space-y-8">
                    <StepTitle patientName={patient?.fullName} title="Measurements" />
                    <div>
                      <p className="text-small font-medium text-graphite-100">Body temperature</p>
                      <div className="mt-3 flex items-center gap-3">
                        <Button variant="outline" size="lg" className="w-12 px-0" aria-label="Lower by 0.1 degrees" onClick={() => setTemp((t) => Math.max(34, Math.round(((t ?? 36.8) - 0.1) * 10) / 10))}>
                          <Minus className="size-4" />
                        </Button>
                        <label className="relative">
                          <span className="sr-only">Body temperature in degrees Celsius</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step={0.1}
                            min={34}
                            max={42}
                            value={temp ?? ""}
                            onChange={(e) => setTemp(e.target.value === "" ? null : Number(e.target.value))}
                            className="tabular h-16 w-40 rounded-md border border-(--line-strong) bg-graphite-900 text-center text-[2rem] font-light text-bone focus:border-signal/60 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-graphite-400">°C</span>
                        </label>
                        <Button variant="outline" size="lg" className="w-12 px-0" aria-label="Raise by 0.1 degrees" onClick={() => setTemp((t) => Math.min(42, Math.round(((t ?? 36.8) + 0.1) * 10) / 10))}>
                          <Plus className="size-4" />
                        </Button>
                        <button onClick={() => setTemp(null)} className="text-[12px] text-graphite-400 underline-offset-4 hover:text-bone hover:underline">
                          Not taken
                        </button>
                      </div>
                      {temp != null && (temp < 35 || temp > 38.5) && <p className="mt-2 text-small text-watch">Outside the usual range. Re-check before saving; the doctor is not notified automatically.</p>}
                    </div>
                    <div>
                      <p className="text-small font-medium text-graphite-100">Pain score</p>
                      <p className="text-[12px] text-graphite-400">As reported by the patient, 0 is no pain.</p>
                      <div role="radiogroup" aria-label="Pain score" className="mt-3 grid grid-cols-11 gap-1.5">
                        {Array.from({ length: 11 }, (_, n) => (
                          <button
                            key={n}
                            role="radio"
                            aria-checked={pain === n}
                            onClick={() => setPain(pain === n ? null : n)}
                            className={cn(
                              "tabular h-11 rounded-sm border font-mono text-small transition-colors duration-(--dur-micro)",
                              pain === n ? (n >= 7 ? "border-attention bg-attention text-graphite-950" : n >= 4 ? "border-watch bg-watch text-graphite-950" : "border-signal bg-signal text-graphite-950") : "border-(--line) text-graphite-200 hover:border-(--line-strong)",
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : step === 2 ? (
                  <div className="space-y-7">
                    <StepTitle patientName={patient?.fullName} title="Dressing and device" />
                    <div role="radiogroup" aria-label="Dressing condition" className="grid gap-2 sm:grid-cols-2">
                      {(Object.keys(DRESSING_LABEL) as DressingCondition[]).map((c) => (
                        <button
                          key={c}
                          role="radio"
                          aria-checked={dressing === c}
                          onClick={() => setDressing(c)}
                          className={cn(
                            "rounded-md border p-3.5 text-left transition-[border-color,background-color] duration-(--dur-micro-slow)",
                            dressing === c ? "border-signal/45 bg-signal/[0.05]" : "border-(--line) hover:border-(--line-strong)",
                          )}
                        >
                          <span className="block text-small font-medium text-bone">{DRESSING_LABEL[c]}</span>
                          <span className="mt-0.5 block text-[12px] text-graphite-400">{DRESSING_HINT[c]}</span>
                        </button>
                      ))}
                    </div>
                    <div>
                      <p className="text-small font-medium text-graphite-100">Sensor device secure</p>
                      <div role="radiogroup" aria-label="Device secure" className="mt-2 flex gap-2">
                        {[
                          { v: true, label: "Secure" },
                          { v: false, label: "Needs attention" },
                        ].map((o) => (
                          <button
                            key={o.label}
                            role="radio"
                            aria-checked={secure === o.v}
                            onClick={() => setSecure(o.v)}
                            className={cn(
                              "h-10 rounded-full border px-4 text-small transition-colors",
                              secure === o.v ? (o.v ? "border-signal/50 bg-signal/10 text-signal" : "border-watch/50 bg-watch/10 text-watch") : "border-(--line) text-graphite-300 hover:text-bone",
                            )}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Field label="Notes" optional error={wording}>
                      {({ id, describedBy, invalid }) => (
                        <Textarea id={id} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} placeholder="What you saw and did." />
                      )}
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <StepTitle patientName={patient?.fullName} title="Check and save" />
                    <dl className="divide-y divide-(--line) border-y border-(--line)">
                      <KeyValue label="Patient" value={`${patient?.fullName ?? "--"}${patient?.roomLabel ? ` · ${patient.roomLabel}` : ""}`} />
                      <KeyValue label="Body temperature" value={temp != null ? `${temp.toFixed(1)} °C` : "Not taken"} />
                      <KeyValue label="Pain score" value={pain != null ? `${pain} / 10` : "Not recorded"} />
                      <KeyValue label="Dressing" value={dressing ? DRESSING_LABEL[dressing] : "--"} />
                      <KeyValue label="Device" value={secure == null ? "--" : secure ? "Secure" : "Needs attention"} />
                      {notes.trim() && <KeyValue label="Notes" value={<span className="block max-w-sm text-right">{notes.trim()}</span>} />}
                    </dl>
                    <Field label="Completes task" optional hint="The task is marked done when the check-in saves.">
                      {({ id, describedBy }) => (
                        <Select id={id} value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-describedby={describedBy}>
                          <option value="">No linked task</option>
                          {patientTasks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title} · {TASK_TYPE_LABEL[t.taskType]} · due {formatTime(t.delayedUntil ?? t.dueAt)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          {!saved && (
            <div className="flex items-center justify-between gap-3 border-t border-(--line) px-5 py-4 sm:px-7">
              <Button variant="ghost" iconLeft={<ArrowLeft className="size-4" />} onClick={() => go(step - 1)} disabled={step === 0}>
                Back
              </Button>
              {step < 3 ? (
                <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={() => go(step + 1)} disabled={!canNext}>
                  Continue
                </Button>
              ) : (
                <Button variant="signal" iconLeft={<Check className="size-4" />} onClick={confirm} loading={submit.isPending}>
                  Save check-in
                </Button>
              )}
            </div>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-4">
          {patient && !saved && (
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={patient.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-medium text-bone">{patient.fullName}</p>
                  <p className="truncate text-[12px] text-graphite-400">{patient.roomLabel}</p>
                </div>
              </div>
              <div className="mt-4">
                <MonitoringBadge status={patient.monitoringStatus} />
              </div>
              {patient.latest && (
                <p className="tabular mt-4 font-mono text-[11px] text-graphite-300">
                  Sensor: {patient.latest.localizedTemperatureC?.toFixed(1) ?? "--"} °C local · {patient.latest.humidityPercent?.toFixed(0) ?? "--"} %RH · {Math.round(patient.latest.relativeMoistureValue ?? 0)} ADC
                </p>
              )}
            </Card>
          )}
          <Card>
            <SectionTitle title="Recent check-ins" />
            <ul className="divide-y divide-(--line) border-t border-(--line)">
              {!recent.data && (
                <li>
                  <SkeletonRows rows={4} />
                </li>
              )}
              {recent.data?.slice(0, 6).map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-small text-bone">{c.patientName}</p>
                    <span className="shrink-0 font-mono text-[10.5px] text-graphite-400">{formatRelative(c.recordedAt)}</span>
                  </div>
                  <p className="tabular text-[11px] text-graphite-400">
                    {c.dressingCondition ? DRESSING_LABEL[c.dressingCondition] : "--"}
                    {c.bodyTemperatureC != null && ` · ${c.bodyTemperatureC.toFixed(1)} °C`}
                    {c.painScore != null && ` · pain ${c.painScore}`}
                  </p>
                </li>
              ))}
              {recent.data?.length === 0 && <li className="px-5 py-5 text-small text-graphite-400">No check-ins yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function StepTitle({ patientName, title }: { patientName?: string; title: string }) {
  return (
    <div>
      <p className="text-label text-graphite-400">{patientName}</p>
      <h2 className="mt-1 text-h3 text-bone">{title}</h2>
    </div>
  );
}

function Success({ checkIn, onAgain }: { checkIn: CheckIn; onAgain: () => void }) {
  const { home } = useWorkspace();
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <svg viewBox="0 0 64 64" className="size-20" aria-hidden>
        <motion.circle cx="32" cy="32" r="29" fill="none" stroke="var(--color-signal)" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: DURATION.standardSlow, ease: BEZIER.outExpo }} />
        <motion.path d="M20 33 l8 8 l16 -18" fill="none" stroke="var(--color-signal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: DURATION.standard, ease: BEZIER.outExpo, delay: 0.35 }} />
      </svg>
      <h2 className="mt-6 text-h2 font-light text-bone">Check-in saved</h2>
      <p className="mt-2 max-w-sm text-small text-graphite-300">
        {checkIn.patientName} · {formatTime(checkIn.recordedAt)}
        {checkIn.taskId && ". The linked task is complete."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2.5">
        <Button variant="primary" onClick={onAgain}>
          Record another
        </Button>
        <Link href={`${home}/patients/${checkIn.patientId}?tab=history`} className={buttonStyles({ variant: "outline" })}>
          Open patient
        </Link>
        <Link href={`${home}/tasks`} className={buttonStyles({ variant: "ghost" })}>
          Back to tasks
        </Link>
      </div>
    </div>
  );
}
