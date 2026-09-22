"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { HeartPulse, PanelLeftClose, PanelLeftOpen, ShieldCheck, Stethoscope } from "lucide-react";
import { cn } from "@/utils/cn";
import { SPRING } from "@/lib/motion/tokens";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { LogoMark } from "@/components/brand/Logo";
import { StatusDot } from "@/components/ui/badge";
import { useLiveStore } from "@/stores/live";
import { useWorkspace } from "./context";
import { useNavBadges } from "./badges";
import { NAV, isActive } from "./nav";
import { ROLE_HOME } from "@/lib/auth/roles";
import type { StaffRole } from "@/types/domain";

const WORKSPACES: { role: StaffRole; label: string; icon: typeof Stethoscope }[] = [
  { role: "doctor", label: "Doctor", icon: Stethoscope },
  { role: "nurse", label: "Nurse", icon: HeartPulse },
  { role: "admin", label: "Admin", icon: ShieldCheck },
];

export function WorkspaceSwitch({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { viewer } = useWorkspace();
  return (
    <div className={cn("px-3 pt-4", collapsed && "px-2")}>
      {!collapsed && <p className="text-label mb-2 px-3 text-graphite-400">Workspaces</p>}
      <div className={cn("grid gap-1", collapsed ? "grid-cols-1" : "grid-cols-3")}>
        {WORKSPACES.map((item) => {
          const active = viewer.role === item.role;
          const Icon = item.icon;
          return (
            <Link
              key={item.role}
              href={ROLE_HOME[item.role]}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-md border text-[12px] transition-colors",
                active ? "border-signal/40 bg-signal/10 text-signal" : "border-(--line) text-graphite-300 hover:border-(--line-strong) hover:text-bone",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const CONNECTION: Record<string, { label: string; tone: "signal" | "watch" | "offline" }> = {
  live: { label: "Live", tone: "signal" },
  connecting: { label: "Connecting", tone: "watch" },
  reconnecting: { label: "Reconnecting", tone: "watch" },
  offline: { label: "Offline", tone: "offline" },
};

export function SidebarNav({ collapsed = false, onNavigate, layoutGroup = "sidebar" }: { collapsed?: boolean; onNavigate?: () => void; layoutGroup?: string }) {
  const { viewer } = useWorkspace();
  const pathname = usePathname();
  const badges = useNavBadges();

  return (
    <nav aria-label={`${ROLE_LABEL[viewer.role]} workspace`} className="flex-1 space-y-6 overflow-y-auto px-3 py-4 no-scrollbar">
      {NAV[viewer.role].map((group) => (
        <div key={group.label}>
          <p className={cn("text-label mb-2 px-3 text-graphite-400 transition-opacity", collapsed && "opacity-0")}>{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const count = item.badge ? badges[item.badge] : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group/nav relative flex h-9 items-center gap-3 rounded-md px-3 text-small transition-colors duration-(--dur-micro)",
                      active ? "text-bone" : "text-graphite-300 hover:text-bone",
                    )}
                  >
                    {active && (
                      <motion.span layoutId={`${layoutGroup}-active`} transition={SPRING.snappy} className="absolute inset-0 rounded-md border border-(--line) bg-white/[0.045]">
                        <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-signal" />
                      </motion.span>
                    )}
                    <item.icon aria-hidden className={cn("relative size-[17px] shrink-0 transition-transform duration-(--dur-micro) group-hover/nav:scale-105", active && "text-signal")} />
                    <span className={cn("relative truncate transition-opacity", collapsed && "sr-only")}>{item.label}</span>
                    {count != null && count > 0 && (
                      <span
                        className={cn(
                          "tabular relative ml-auto rounded-full px-1.5 font-mono text-[10px] leading-5",
                          item.badge === "alerts" ? "bg-attention/15 text-attention" : "bg-graphite-750 text-graphite-100",
                          collapsed && "absolute right-1 top-0.5 ml-0 px-1 leading-4",
                        )}
                      >
                        {count}
                        <span className="sr-only"> {item.badge === "alerts" ? "open alerts" : "new"}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function ConnectionCard({ collapsed }: { collapsed?: boolean }) {
  const connection = useLiveStore((s) => s.connection);
  const streams = useLiveStore((s) => Object.keys(s.latest).length);
  const meta = CONNECTION[connection] ?? CONNECTION.offline;
  return (
    <div className={cn("mx-3 mb-3 rounded-md border border-(--line) bg-graphite-900/60 p-3", collapsed && "flex justify-center p-2.5")}>
      <div className="flex items-center gap-2.5">
        <StatusDot tone={meta.tone} pulse={connection === "live"} label={`Realtime ${meta.label.toLowerCase()}`} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-small text-bone">Realtime {meta.label.toLowerCase()}</p>
            <p className="tabular font-mono text-[10.5px] text-graphite-400">{streams} device{streams === 1 ? "" : "s"} streaming</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { viewer, home } = useWorkspace();
  return (
    <aside
      className="fixed inset-y-0 left-0 z-(--z-sticky) hidden flex-col border-r border-(--line) bg-graphite-950/90 backdrop-blur-xl transition-[width] duration-(--dur-standard) ease-(--ease-out-expo) lg:flex"
      style={{ width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
    >
      <div className={cn("flex h-16 items-center border-b border-(--line) px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link href={home} className="flex items-center gap-2.5" aria-label="Workspace home">
          <LogoMark className="size-7" />
          {!collapsed && (
            <span className="leading-tight">
              <span className="block text-small font-medium text-bone">Tend</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-400">{ROLE_LABEL[viewer.role]} workspace</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button onClick={onToggle} aria-label="Collapse sidebar" className="rounded-full p-1.5 text-graphite-400 transition-colors hover:bg-white/[0.05] hover:text-bone">
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <button onClick={onToggle} aria-label="Expand sidebar" className="mx-auto mt-3 rounded-full p-1.5 text-graphite-400 transition-colors hover:bg-white/[0.05] hover:text-bone">
          <PanelLeftOpen className="size-4" />
        </button>
      )}
      <WorkspaceSwitch collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} />
      <ConnectionCard collapsed={collapsed} />
    </aside>
  );
}
