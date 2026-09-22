"use client";

import { useEffect, useState } from "react";
import { checkClinicalWording } from "@/lib/domain/rules";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Field, Textarea } from "@/components/ui/field";
import { useAction } from "@/features/dashboard/context";

const PROMPTS = ["Dressing reviewed at bedside.", "Indicator reviewed; continue monitoring.", "Plan discussed with the care team."];

export function NoteComposer({
  open,
  onClose,
  patientId,
  patientName,
  alertId,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  alertId?: string | null;
}) {
  const [text, setText] = useState("");
  const wording = checkClinicalWording(text);
  const save = useAction((d, input: { patientId: string; text: string; alertId?: string | null }) => d.addNote(input), {
    invalidate: ["notes", "timeline", "alerts"],
    success: "Note saved to the patient record",
    error: "The note was not saved",
  });

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const submit = () => {
    if (!text.trim() || wording) return;
    save.mutate({ patientId, text: text.trim(), alertId }, { onSuccess: onClose });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Clinical note"
      description={
        <>
          {patientName}
          {alertId ? " · linked to the indicator" : ""}
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={save.isPending} disabled={!text.trim() || Boolean(wording)}>
            Save note
          </Button>
        </>
      }
    >
      <Field label="Note" error={wording} hint="Describe what was observed and done. Notes describe indicators, not diagnoses.">
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            data-autofocus
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            placeholder="Dressing edge dry, device secure. Moisture indicator reviewed…"
          />
        )}
      </Field>
      <div className="mt-4 flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setText((t) => (t ? `${t.trimEnd()} ${p}` : p))}
            className="rounded-full border border-(--line) px-3 py-1.5 text-[12px] text-graphite-300 transition-colors hover:border-(--line-strong) hover:text-bone"
          >
            {p}
          </button>
        ))}
      </div>
    </Drawer>
  );
}
