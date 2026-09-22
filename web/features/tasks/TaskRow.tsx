"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, ClipboardCheck, Clock, Hourglass, Play } from "lucide-react";
import { cn } from "@/utils/cn";
import { TASK_PRIORITY_META, TASK_STATUS_META, TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { SPRING } from "@/lib/motion/tokens";
import { formatRelative, formatTime } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { useAction, useWorkspace } from "@/features/dashboard/context";
import type { TaskUpdate } from "@/services/data/types";
import type { CareTask } from "@/types/domain";

export const effectiveDue = (t: CareTask) => Date.parse(t.delayedUntil ?? t.dueAt);
export const isOpen = (t: CareTask) => t.status === "pending" || t.status === "in_progress" || t.status === "delayed";

const RECORDABLE = new Set(["measurement", "dressing_check", "device_check"]);

export function useTaskUpdate() {
  return useAction((d, args: { id: string; update: TaskUpdate }) => d.updateTask(args.id, args.update), {
    invalidate: ["tasks", "timeline", "overview"],
    success: (task) => (task.status === "completed" ? `Done: ${task.title}` : task.status === "delayed" ? "Task delayed" : "Task started"),
  });
}

export function TaskRow({ task, now }: { task: CareTask; now: number | null }) {
  const { home } = useWorkspace();
  const update = useTaskUpdate();
  const done = task.status === "completed";
  const due = effectiveDue(task);
  const overdue = isOpen(task) && now != null && due < now;
  const set = (u: TaskUpdate) => update.mutate({ id: task.id, update: u });

  return (
    <motion.li layout="position" transition={SPRING.soft} className={cn("group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]", done && "opacity-60")}>
      <button
        onClick={() => !done && set({ status: "completed" })}
        disabled={done || update.isPending}
        aria-label={done ? `${task.title} completed` : `Complete ${task.title}`}
        className={cn(
          "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-(--dur-micro-slow)",
          done ? "border-signal bg-signal text-graphite-950" : "border-graphite-500 text-transparent hover:border-signal hover:text-signal/60",
        )}
      >
        <motion.span initial={false} animate={{ scale: done ? 1 : 0.6, opacity: done ? 1 : 0.9 }} transition={SPRING.toggle}>
          <Check className="size-3.5" strokeWidth={3} />
        </motion.span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-small font-medium text-bone", done && "line-through decoration-graphite-500")}>{task.title}</p>
          {(task.priority === "high" || task.priority === "urgent") && !done && <Badge tone={TASK_PRIORITY_META[task.priority].tone}>{TASK_PRIORITY_META[task.priority].label}</Badge>}
          {(task.status === "delayed" || task.status === "in_progress") && <Badge tone={TASK_STATUS_META[task.status].tone}>{TASK_STATUS_META[task.status].label}</Badge>}
        </div>
        <p className="mt-0.5 text-[12px] text-graphite-400">
          <Link href={`${home}/patients/${task.patientId}`} className="text-graphite-200 hover:underline">
            {task.patientName}
          </Link>
          {task.roomLabel && <> · {task.roomLabel}</>} · {TASK_TYPE_LABEL[task.taskType]}
        </p>
        {task.details && <p className="mt-1.5 line-clamp-2 text-[12px] text-graphite-400">{task.details}</p>}
        {task.delayReason && task.status === "delayed" && <p className="mt-1 text-[12px] text-watch">Delayed: {task.delayReason}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className={cn("tabular flex items-center gap-1.5 font-mono text-[12px]", overdue ? "text-attention" : "text-graphite-200")}>
          <Clock className="size-3" />
          {done && task.completedAt ? formatTime(task.completedAt) : formatTime(due)}
        </p>
        <p className={cn("text-[11px]", overdue ? "text-attention" : "text-graphite-500")}>{done ? "done" : now != null ? formatRelative(due, now) : "\u00a0"}</p>
        {!done && (
          <div className="flex items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
            {RECORDABLE.has(task.taskType) && (
              <Link
                href={`/nurse/measurements?patient=${task.patientId}&task=${task.id}`}
                className="flex h-8 items-center gap-1.5 rounded-full border border-(--line) px-3 text-[12px] text-graphite-100 transition-colors hover:border-(--line-strong) hover:text-bone"
              >
                <ClipboardCheck className="size-3.5" /> Record
              </Link>
            )}
            {task.status === "pending" && (
              <IconButton label="Start task" size="sm" onClick={() => set({ status: "in_progress" })} disabled={update.isPending}>
                <Play />
              </IconButton>
            )}
            <Dropdown
              label="Delay task"
              width="w-48"
              trigger={(p) => (
                <IconButton label="Delay task" size="sm" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-haspopup="menu" aria-controls={p["aria-controls"]}>
                  <Hourglass />
                </IconButton>
              )}
              items={[15, 30, 60].map((m) => ({
                id: String(m),
                label: `Delay ${m < 60 ? `${m} minutes` : "1 hour"}`,
                onSelect: () => set({ status: "delayed", delayMinutes: m, delayReason: "Patient unavailable" }),
              }))}
            />
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function TaskActionsHint() {
  return <p className="text-[12px] text-graphite-500">Tick to complete. Hover a task to record, start or delay it.</p>;
}
