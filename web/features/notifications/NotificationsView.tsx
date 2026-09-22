"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDate, formatTime } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAction, useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import { NOTIFICATION_ICON } from "@/features/dashboard/notification-icons";
import type { AppNotification } from "@/types/domain";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(d, "long");
}

export function NotificationsView() {
  const { data, home } = useWorkspace();
  const [view, setView] = useState<"all" | "unread">("all");
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: () => data.listNotifications() });
  const markRead = useAction((d, ids: string[]) => d.markNotificationsRead(ids), { invalidate: ["notifications"] });
  const unread = (notifications.data ?? []).filter((n) => !n.readAt);

  const groups = useMemo(() => {
    const list = (notifications.data ?? []).filter((n) => view === "all" || !n.readAt);
    const map = new Map<string, AppNotification[]>();
    for (const n of list) {
      const key = dayLabel(n.createdAt);
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return [...map.entries()];
  }, [notifications.data, view]);

  const href = (n: AppNotification) => {
    if (n.patientId) return `${home}/patients/${n.patientId}`;
    if (n.kind === "message") return `${home}/messages`;
    if (n.kind === "approval") return `${home}/approvals`;
    if (n.kind === "task") return `${home}/tasks`;
    return null;
  };

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Indicators, escalations, tasks and approvals addressed to you."
        actions={
          unread.length > 0 && (
            <Button variant="outline" iconLeft={<CheckCheck className="size-4" />} loading={markRead.isPending} onClick={() => markRead.mutate(unread.map((n) => n.id))}>
              Mark all read
            </Button>
          )
        }
      />
      <Tabs
        label="Notification filter"
        value={view}
        onChange={setView}
        items={[
          { value: "all", label: "All", count: notifications.data?.length },
          { value: "unread", label: "Unread", count: unread.length },
        ]}
        className="mb-6"
      />
      {notifications.error ? (
        <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
      ) : !notifications.data ? (
        <SkeletonRows rows={6} />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={<Bell />} title={view === "unread" ? "You are all caught up" : "No notifications yet"} />
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(([label, items]) => (
            <section key={label} aria-label={label}>
              <h2 className="text-label mb-3 text-graphite-400">{label}</h2>
              <Card>
                <ul className="divide-y divide-(--line)">
                  {items.map((n) => {
                    const Icon = NOTIFICATION_ICON[n.kind];
                    const link = href(n);
                    const body = (
                      <>
                        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border", n.readAt ? "border-(--line) text-graphite-400" : "border-signal/30 bg-signal/10 text-signal")}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-small", n.readAt ? "text-graphite-200" : "font-medium text-bone")}>{n.title}</span>
                          {n.body && <span className="mt-0.5 block text-small text-graphite-400">{n.body}</span>}
                        </span>
                        <span className="tabular shrink-0 font-mono text-[10.5px] text-graphite-400">{formatTime(n.createdAt)}</span>
                        {!n.readAt && <span aria-label="Unread" className="mt-2 size-1.5 shrink-0 rounded-full bg-signal" />}
                      </>
                    );
                    const cls = "flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/[0.025]";
                    return (
                      <li key={n.id}>
                        {link ? (
                          <Link href={link} className={cls} onClick={() => !n.readAt && markRead.mutate([n.id])}>
                            {body}
                          </Link>
                        ) : (
                          <button type="button" className={cn(cls, "w-full text-left")} onClick={() => !n.readAt && markRead.mutate([n.id])}>
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
