"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { formatDate } from "@/utils/format";
import { checkClinicalWording } from "@/lib/domain/rules";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useAction, useCan, useWorkspace } from "@/features/dashboard/context";
import { SectionTitle } from "@/features/dashboard/PageHeader";
import type { PatientDetail } from "@/types/domain";

export function CarePlanPanel({ patient }: { patient: PatientDetail }) {
  const { data } = useWorkspace();
  const canWrite = useCan("care_plans.write");
  const [composing, setComposing] = useState(false);
  const plans = useQuery({ queryKey: ["plans", patient.id], queryFn: () => data.listCarePlans(patient.id), initialData: patient.carePlans });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-7">
        {!plans.data ? (
          <SkeletonRows rows={3} />
        ) : plans.data.length === 0 ? (
          <Card>
            <EmptyState icon={<ClipboardList />} title="No care plan yet" body={canWrite ? "Set the dressing change and review intervals for the team." : "The assigned doctor has not written a plan yet."} />
          </Card>
        ) : (
          plans.data.map((plan) => (
            <Card key={plan.id} className={plan.active ? "border-signal/25" : "opacity-70"}>
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                <div>
                  <h3 className="text-body font-medium text-bone">{plan.title}</h3>
                  <p className="mt-0.5 text-[12px] text-graphite-400">
                    {plan.author.name} · {formatDate(plan.createdAt, "long")}
                  </p>
                </div>
                <Badge tone={plan.active ? "signal" : "neutral"} dot={plan.active}>
                  {plan.active ? "Active" : "Superseded"}
                </Badge>
              </div>
              <p className="whitespace-pre-line px-5 pt-4 text-small leading-relaxed text-graphite-200">{plan.instructions}</p>
              <dl className="mt-5 grid grid-cols-2 border-t border-(--line)">
                <div className="border-r border-(--line) px-5 py-3.5">
                  <dt className="text-label text-graphite-400">Dressing change</dt>
                  <dd className="tabular mt-1 font-mono text-small text-bone">{plan.dressingChangeIntervalHours ? `every ${plan.dressingChangeIntervalHours} h` : "--"}</dd>
                </div>
                <div className="px-5 py-3.5">
                  <dt className="text-label text-graphite-400">Indicator review</dt>
                  <dd className="tabular mt-1 font-mono text-small text-bone">{plan.reviewIntervalHours ? `every ${plan.reviewIntervalHours} h` : "--"}</dd>
                </div>
              </dl>
            </Card>
          ))
        )}
      </div>
      <div className="lg:col-span-5">
        {canWrite ? (
          composing ? (
            <PlanForm patientId={patient.id} onDone={() => setComposing(false)} />
          ) : (
            <Card className="p-5">
              <p className="text-body text-bone">Update the plan</p>
              <p className="mt-1 text-small text-graphite-300">A new plan replaces the active one. The nurse sees it on their next check.</p>
              <Button className="mt-4" variant="primary" size="sm" iconLeft={<Plus className="size-3.5" />} onClick={() => setComposing(true)}>
                New care plan
              </Button>
            </Card>
          )
        ) : (
          <Card className="p-5">
            <p className="text-small text-graphite-300">Care plans are written by the assigned doctor. Record what you observe in a note or a bedside check-in.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function PlanForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const [title, setTitle] = useState("Post-operative dressing plan");
  const [instructions, setInstructions] = useState("");
  const [change, setChange] = useState("48");
  const [review, setReview] = useState("8");
  const wording = checkClinicalWording(`${title} ${instructions}`);
  const save = useAction(
    (d, input: Parameters<typeof d.addCarePlan>[0]) => d.addCarePlan(input),
    { invalidate: ["plans", "patients", "timeline"], success: "Care plan saved" },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !instructions.trim() || wording) return;
    save.mutate(
      {
        patientId,
        title: title.trim(),
        instructions: instructions.trim(),
        dressingChangeIntervalHours: change ? Number(change) : null,
        reviewIntervalHours: review ? Number(review) : null,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <Card>
      <SectionTitle title="New care plan" />
      <form onSubmit={submit} className="space-y-4 px-5 pb-5">
        <Field label="Title">{({ id }) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        <Field label="Instructions" error={wording}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              data-autofocus
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              placeholder="Keep the dressing dry. Check the edge seal at every shift change…"
              required
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Change every (h)">{({ id }) => <Input id={id} type="number" min={1} max={168} value={change} onChange={(e) => setChange(e.target.value)} />}</Field>
          <Field label="Review every (h)">{({ id }) => <Input id={id} type="number" min={1} max={72} value={review} onChange={(e) => setReview(e.target.value)} />}</Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!instructions.trim() || Boolean(wording)}>
            Save plan
          </Button>
        </div>
      </form>
    </Card>
  );
}
