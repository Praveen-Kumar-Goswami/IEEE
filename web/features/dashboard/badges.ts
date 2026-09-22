"use client";

import { useQuery } from "@tanstack/react-query";
import type { NavBadge } from "./nav";
import { useWorkspace } from "./context";

/** Counts for the sidebar. Queries share keys with the pages, so they refetch together. */
export function useNavBadges(): Partial<Record<NavBadge, number>> {
  const { data, viewer } = useWorkspace();
  const role = viewer.role;
  const alerts = useQuery({ queryKey: ["alerts", "active"], queryFn: () => data.listAlerts({ status: "active" }) });
  const tasks = useQuery({ queryKey: ["tasks", "mine"], queryFn: () => data.listTasks({ scope: "mine" }), enabled: role === "nurse" });
  const approvals = useQuery({ queryKey: ["approvals"], queryFn: () => data.listAccessRequests(), enabled: role === "admin" });
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: () => data.listNotifications() });
  const conversations = useQuery({ queryKey: ["messages", "conversations"], queryFn: () => data.listConversations(), enabled: role !== "admin" });

  return {
    alerts: alerts.data?.filter((a) => a.status === "open").length,
    tasks: tasks.data?.filter((t) => t.status === "pending" || t.status === "in_progress" || t.status === "delayed").length,
    approvals: approvals.data?.filter((r) => r.status === "pending").length,
    notifications: notifications.data?.filter((n) => !n.readAt).length,
    messages: conversations.data?.reduce((sum, c) => sum + c.unreadCount, 0),
  };
}
