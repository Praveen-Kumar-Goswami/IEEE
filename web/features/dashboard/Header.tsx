"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck, LogOut, Menu, Search, Settings2, UserRound } from "lucide-react";
import { cn } from "@/utils/cn";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { useSignOut } from "@/features/auth/SignOutButton";
import { formatRelative, formatTime, formatWeekday } from "@/utils/format";
import { useNow } from "@/hooks/use-now";
import { useUiStore } from "@/stores/ui";
import { Dropdown } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/button";
import { Avatar, Kbd } from "@/components/ui/misc";
import { StatusDot } from "@/components/ui/badge";
import type { Presence } from "@/types/domain";
import { useAction, useWorkspace } from "./context";
import { NOTIFICATION_ICON } from "./notification-icons";

const PRESENCE: Record<Presence, { label: string; tone: "signal" | "watch" | "offline" }> = {
  available: { label: "Available", tone: "signal" },
  busy: { label: "Busy", tone: "watch" },
  off_shift: { label: "Off shift", tone: "offline" },
};

export function Header() {
  const setCommand = useUiStore((s) => s.setCommand);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const now = useNow(15_000);

  return (
    <header className="sticky top-0 z-(--z-nav) flex h-16 items-center gap-3 border-b border-(--line) bg-graphite-950/80 px-(--margin) backdrop-blur-xl lg:px-8">
      <IconButton label="Open navigation" className="lg:hidden" onClick={() => setMobileNav(true)}>
        <Menu />
      </IconButton>
      <button
        onClick={() => setCommand(true)}
        className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full border border-(--line) bg-graphite-900/70 px-4 text-left text-small text-graphite-400 transition-[border-color,background-color] duration-(--dur-micro) hover:border-(--line-strong) hover:bg-graphite-900 sm:max-w-md"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="truncate">Search patients, rooms, pages</span>
        <span className="ml-auto hidden items-center gap-1 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <p className="hidden text-right leading-tight xl:block">
          <span className="tabular block font-mono text-small text-bone">{now ? formatTime(now) : "--:--"}</span>
          <span className="block text-[11px] text-graphite-400">{now ? formatWeekday(now) : "\u00a0"}</span>
        </p>
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}

function NotificationsMenu() {
  const { data, home } = useWorkspace();
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: () => data.listNotifications() });
  const unread = notifications.data?.filter((n) => !n.readAt) ?? [];
  const markRead = useAction((d, ids: string[]) => d.markNotificationsRead(ids), { invalidate: ["notifications"] });

  return (
    <Dropdown
      label="Notifications"
      width="w-[min(23rem,calc(100vw-2rem))]"
      trigger={(p) => (
        <IconButton label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"} onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-haspopup="dialog" aria-controls={p["aria-controls"]}>
          <Bell />
          {unread.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-attention ring-2 ring-graphite-950" />}
        </IconButton>
      )}
    >
      <div className="flex items-center justify-between border-b border-(--line) px-4 py-3">
        <p className="text-small font-medium text-bone">Notifications</p>
        {unread.length > 0 && (
          <button onClick={() => markRead.mutate(unread.map((n) => n.id))} className="flex items-center gap-1.5 text-[12px] text-graphite-300 transition-colors hover:text-bone">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        )}
      </div>
      <ul className="max-h-[22rem] overflow-y-auto">
        {(notifications.data ?? []).slice(0, 6).map((n) => {
          const Icon = NOTIFICATION_ICON[n.kind];
          return (
            <li key={n.id} className="border-b border-(--line) last:border-0">
              <Link href={n.patientId ? `${home}/patients/${n.patientId}` : `${home}/notifications`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-(--line)", !n.readAt ? "text-signal" : "text-graphite-400")}>
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-small", n.readAt ? "text-graphite-200" : "font-medium text-bone")}>{n.title}</span>
                  {n.body && <span className="line-clamp-2 block text-[12px] text-graphite-400">{n.body}</span>}
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-graphite-500">{formatRelative(n.createdAt)}</span>
                </span>
              </Link>
            </li>
          );
        })}
        {notifications.data?.length === 0 && <li className="px-4 py-8 text-center text-small text-graphite-300">No notifications yet.</li>}
      </ul>
      <Link href={`${home}/notifications`} className="block border-t border-(--line) px-4 py-3 text-center text-small text-graphite-200 transition-colors hover:bg-white/[0.03] hover:text-bone">
        View all notifications
      </Link>
    </Dropdown>
  );
}

function UserMenu() {
  const { viewer, home } = useWorkspace();
  const presence = useUiStore((s) => s.presence);
  const setPresence = useUiStore((s) => s.setPresence);
  const { signOut: leave, pending } = useSignOut();

  return (
    <Dropdown
      label="Account"
      width="w-64"
      trigger={(p) => (
        <button
          onClick={p.toggle}
          aria-label="Account menu"
          aria-expanded={p["aria-expanded"]}
          aria-haspopup="dialog"
          aria-controls={p["aria-controls"]}
          className="flex items-center gap-2.5 rounded-full border border-(--line) py-1 pl-1 pr-1 transition-colors hover:border-(--line-strong) sm:pr-3"
        >
          <span className="relative">
            <Avatar name={viewer.fullName} size="sm" />
            <StatusDot tone={PRESENCE[presence].tone} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-graphite-950 rounded-full" />
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[9rem] truncate text-small text-bone">{viewer.fullName}</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-graphite-400">{ROLE_LABEL[viewer.role]}</span>
          </span>
        </button>
      )}
    >
      <div className="border-b border-(--line) px-4 py-3">
        <p className="truncate text-small font-medium text-bone">{viewer.fullName}</p>
        <p className="truncate text-[12px] text-graphite-400">{viewer.title ?? ROLE_LABEL[viewer.role]}</p>
      </div>
      <div className="border-b border-(--line) p-1.5" role="radiogroup" aria-label="Presence">
        {(Object.keys(PRESENCE) as Presence[]).map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={presence === p}
            onClick={() => setPresence(p)}
            className={cn("flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-small transition-colors", presence === p ? "bg-white/[0.05] text-bone" : "text-graphite-300 hover:text-bone")}
          >
            <StatusDot tone={PRESENCE[p].tone} />
            {PRESENCE[p].label}
          </button>
        ))}
      </div>
      <div className="p-1.5">
        <Link href={`${home}/profile`} className="flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-small text-graphite-100 transition-colors hover:bg-white/[0.05] hover:text-bone">
          <UserRound className="size-4 text-graphite-300" /> Profile
        </Link>
        <Link href={`${home}/settings`} className="flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-small text-graphite-100 transition-colors hover:bg-white/[0.05] hover:text-bone">
          <Settings2 className="size-4 text-graphite-300" /> Settings
        </Link>
        <button onClick={leave} disabled={pending} className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-small text-critical transition-colors hover:bg-critical/10 disabled:opacity-50">
          <LogOut className="size-4" /> {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </Dropdown>
  );
}
