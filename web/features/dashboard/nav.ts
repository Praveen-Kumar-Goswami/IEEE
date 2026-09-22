import {
  Activity,
  Bell,
  BellRing,
  Building2,
  CalendarDays,
  ChartColumn,
  Cpu,
  FileText,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Plug,
  ScrollText,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  UserCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { StaffRole } from "@/types/domain";

/** Counts shown next to a nav item; each one is backed by a query the sidebar reads. */
export type NavBadge = "alerts" | "tasks" | "approvals" | "notifications" | "messages";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: NavBadge;
  /** Words the command palette also matches on. */
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const account = (home: string, badges = true): NavGroup => ({
  label: "Account",
  items: [
    { href: `${home}/notifications`, label: "Notifications", icon: Bell, badge: badges ? "notifications" : undefined, keywords: "inbox" },
    { href: `${home}/profile`, label: "Profile", icon: UserRound, keywords: "me account permissions" },
    { href: `${home}/settings`, label: "Settings", icon: Settings2, keywords: "preferences motion sound" },
  ],
});

export const NAV: Record<StaffRole, NavGroup[]> = {
  doctor: [
    {
      label: "Clinical",
      items: [
        { href: "/doctor", label: "Overview", icon: LayoutDashboard, keywords: "home dashboard" },
        { href: "/doctor/patients", label: "Patients", icon: Users },
        { href: "/doctor/monitoring", label: "Live monitoring", icon: Activity, keywords: "wall realtime" },
        { href: "/doctor/alerts", label: "Alerts", icon: BellRing, badge: "alerts", keywords: "indicators queue" },
        { href: "/doctor/appointments", label: "Appointments", icon: CalendarDays, keywords: "calendar agenda" },
        { href: "/doctor/reports", label: "Reports", icon: FileText, keywords: "export csv pdf" },
      ],
    },
    { label: "Team", items: [{ href: "/doctor/messages", label: "Messages", icon: MessagesSquare, badge: "messages" }] },
    account("/doctor"),
  ],
  nurse: [
    {
      label: "Shift",
      items: [
        { href: "/nurse", label: "Overview", icon: LayoutDashboard, keywords: "home dashboard" },
        { href: "/nurse/tasks", label: "Tasks", icon: ListChecks, badge: "tasks", keywords: "todo checks" },
        { href: "/nurse/patients", label: "Patients", icon: Users, keywords: "assigned" },
        { href: "/nurse/monitoring", label: "Live monitoring", icon: Activity, keywords: "wall realtime" },
        { href: "/nurse/measurements", label: "Measurements", icon: Thermometer, keywords: "check-in bedside record" },
        { href: "/nurse/alerts", label: "Alerts", icon: BellRing, badge: "alerts", keywords: "indicators escalate" },
      ],
    },
    { label: "Team", items: [{ href: "/nurse/messages", label: "Messages", icon: MessagesSquare, badge: "messages" }] },
    account("/nurse"),
  ],
  admin: [
    { label: "Platform", items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard, keywords: "home system" }] },
    {
      label: "People",
      items: [
        { href: "/admin/doctors", label: "Doctors", icon: Stethoscope, keywords: "staff users" },
        { href: "/admin/nurses", label: "Nurses", icon: HeartPulse, keywords: "staff users" },
        { href: "/admin/patients", label: "Patients", icon: Users, keywords: "assignments" },
        { href: "/admin/approvals", label: "Approvals", icon: UserCheck, badge: "approvals", keywords: "access requests" },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/admin/devices", label: "Devices", icon: Cpu, keywords: "dressing fleet battery" },
        { href: "/admin/facilities", label: "Facilities", icon: Building2, keywords: "wards units" },
        { href: "/admin/analytics", label: "Analytics", icon: ChartColumn, keywords: "charts usage" },
        { href: "/admin/reports", label: "Reports", icon: FileText, keywords: "export" },
      ],
    },
    {
      label: "Governance",
      items: [
        { href: "/admin/audit", label: "Audit log", icon: ScrollText, keywords: "history compliance" },
        { href: "/admin/security", label: "Security", icon: ShieldCheck, keywords: "roles permissions" },
        { href: "/admin/integrations", label: "Integrations", icon: Plug, keywords: "api lambda supabase" },
      ],
    },
    account("/admin", true),
  ],
};

export function isActive(pathname: string, href: string) {
  const root = href.split("/").length === 2;
  return root ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
