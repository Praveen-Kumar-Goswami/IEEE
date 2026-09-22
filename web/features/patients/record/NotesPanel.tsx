"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Link2, NotebookPen } from "lucide-react";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { checkClinicalWording } from "@/lib/domain/rules";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { formatDateTime, formatRelative } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Avatar } from "@/components/ui/misc";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAction, useCan, useWorkspace } from "@/features/dashboard/context";
import type { PatientDetail } from "@/types/domain";

export function NotesPanel({ patient }: { patient: PatientDetail }) {
  const { data } = useWorkspace();
  const canWrite = useCan("notes.create");
  const [text, setText] = useState("");
  const wording = checkClinicalWording(text);
  const notes = useQuery({ queryKey: ["notes", patient.id], queryFn: () => data.listNotes(patient.id) });
  const save = useAction((d, body: string) => d.addNote({ patientId: patient.id, text: body }), {
    invalidate: ["notes", "timeline"],
    success: "Note saved",
  });

  const submit = () => {
    if (!text.trim() || wording) return;
    save.mutate(text.trim(), { onSuccess: () => setText("") });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {canWrite && (
        <Card className="p-4">
          <label htmlFor="note-body" className="sr-only">
            New note
          </label>
          <Textarea
            id="note-body"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            aria-invalid={wording ? true : undefined}
            placeholder={`Write a note about ${patient.fullName.split(" ")[0]}…`}
            className="min-h-20 border-transparent bg-transparent px-1 focus:bg-transparent focus:shadow-none"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-(--line) pt-3">
            <p className={wording ? "text-small text-attention" : "text-[12px] text-graphite-400"} role={wording ? "alert" : undefined}>
              {wording ?? "Ctrl + Enter to save. Notes describe indicators, not diagnoses."}
            </p>
            <Button size="sm" variant="primary" loading={save.isPending} disabled={!text.trim() || Boolean(wording)} onClick={submit}>
              Save note
            </Button>
          </div>
        </Card>
      )}
      {notes.error ? (
        <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
      ) : !notes.data ? (
        <SkeletonRows rows={4} />
      ) : notes.data.length === 0 ? (
        <Card>
          <EmptyState icon={<NotebookPen />} title="No notes yet" body="Notes written here are visible to the whole care team." />
        </Card>
      ) : (
        <ol className="space-y-3">
          <AnimatePresence initial={false}>
            {notes.data.map((n) => (
              <motion.li
                key={n.id}
                layout="position"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }}
                className="rounded-lg border border-(--line) bg-graphite-900/80 p-5"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={n.author.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-medium text-bone">{n.author.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-graphite-400">{ROLE_LABEL[n.author.role]}</p>
                  </div>
                  {n.alertId && (
                    <Badge tone="info">
                      <Link2 className="size-3" /> Indicator
                    </Badge>
                  )}
                  <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} className="font-mono text-[10.5px] text-graphite-400">
                    {formatRelative(n.createdAt)}
                  </time>
                </div>
                <p className="mt-3 whitespace-pre-line text-small leading-relaxed text-graphite-100">{n.text}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}
