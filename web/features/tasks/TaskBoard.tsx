"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import type { CareTask } from "@/types/domain";
import { effectiveDue, isOpen, TaskActionsHint, TaskRow } from "./TaskRow";

type View = "open" | "done" | "all";
const HOUR = 3_600_000;

export function TaskBoard() {
  const { data } = useWorkspace();
  const [view, setView] = useState<View>("open");
  const now = useNow(30_000);
  const tasks = useQuery({ queryKey: ["tasks", "mine"], queryFn: () => data.listTasks({ scope: "mine" }) });

  const groups = useMemo(() => {
    const list = tasks.data ?? [];
    const t = now ?? Date.now();
    const open = list.filter(isOpen).sort((a, b) => effectiveDue(a) - effectiveDue(b));
    const done = list.filter((x) => x.status === "completed").sort((a, b) => Date.parse(b.completedAt ?? b.dueAt) - Date.parse(a.completedAt ?? a.dueAt));
    const sections: { id: string; title: string; tasks: CareTask[] }[] = [];
    if (view !== "done") {
      sections.push(
        { id: "overdue", title: "Overdue", tasks: open.filter((x) => effectiveDue(x) < t) },
        { id: "soon", title: "Next two hours", tasks: open.filter((x) => effectiveDue(x) >= t && effectiveDue(x) < t + 2 * HOUR) },
        { id: "later", title: "Later", tasks: open.filter((x) => effectiveDue(x) >= t + 2 * HOUR) },
      );
    }
    if (view !== "open") sections.push({ id: "done", title: "Completed", tasks: done });
    return { sections: sections.filter((s) => s.tasks.length > 0), open: open.length, done: done.length, overdue: open.filter((x) => effectiveDue(x) < t).length };
  }, [tasks.data, view, now]);

  return (
    <>
      <PageHeader
        eyebrow="Shift"
        title="Tasks"
        description={
          tasks.data
            ? `${groups.open} open${groups.overdue ? `, ${groups.overdue} overdue` : ""}. Measurement and dressing tasks complete themselves when you record the check-in.`
            : "Dressing checks, measurements and reviews assigned to you."
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: `Open ${groups.open}` },
            { value: "done", label: `Done ${groups.done}` },
            { value: "all", label: "All" },
          ]}
        />
        <TaskActionsHint />
      </div>
      {tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : !tasks.data ? (
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      ) : groups.sections.length === 0 ? (
        <Card>
          <EmptyState icon={<ListChecks />} title={view === "done" ? "Nothing completed yet" : "All clear"} body={view === "done" ? undefined : "Every task on your list is done. New tasks appear here as indicators open."} />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.sections.map((s) => (
            <Card key={s.id} className={s.id === "overdue" ? "border-attention/25" : undefined}>
              <SectionTitle title={s.title} meta={`${s.tasks.length}`} />
              <ul className="divide-y divide-(--line) border-t border-(--line)">
                {s.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} now={now} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
