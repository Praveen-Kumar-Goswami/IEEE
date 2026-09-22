"use client";

import { Check, Minus } from "lucide-react";
import { cn } from "@/utils/cn";
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { useMounted } from "@/hooks/use-mounted";
import { useUiStore } from "@/stores/ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, KeyValue } from "@/components/ui/misc";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";

const PRESENCE_LABEL = { available: "Available", busy: "Busy", off_shift: "Off shift" } as const;

export function ProfileView() {
  const { viewer } = useWorkspace();
  const mounted = useMounted();
  const presence = useUiStore((s) => s.presence);
  const granted = new Set(ROLE_PERMISSIONS[viewer.role]);

  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" />
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <div className="flex items-center gap-5 p-6">
            <Avatar name={viewer.fullName} size="lg" />
            <div className="min-w-0">
              <p className="text-h3 text-bone">{viewer.fullName}</p>
              <p className="text-small text-graphite-300">{viewer.title ?? ROLE_LABEL[viewer.role]}</p>
              <Badge tone="signal" className="mt-3">
                {ROLE_LABEL[viewer.role]}
              </Badge>
            </div>
          </div>
          <dl className="divide-y divide-(--line) border-t border-(--line) px-6">
            <KeyValue label="Email" value={viewer.email || "--"} />
            <KeyValue label="Department" value={viewer.department ?? "--"} />
            <KeyValue label="Facility" value={viewer.facilityName ?? "--"} />
            <KeyValue label="Presence" value={mounted ? PRESENCE_LABEL[presence] : "--"} />
            <KeyValue label="Sign-in" value="AWS Lambda · one staff account" />
          </dl>
        </Card>
        <Card className="lg:col-span-7">
          <SectionTitle title="What your role can do" meta={`${granted.size} of ${Object.keys(PERMISSIONS).length} permissions`} />
          <p className="px-5 pb-4 text-small text-graphite-300">Permissions come from your role. Row level security in the database enforces the same rules, so a hidden button is never the only safeguard.</p>
          <ul className="grid border-t border-(--line) sm:grid-cols-2">
            {(Object.entries(PERMISSIONS) as [Permission, string][]).map(([key, label]) => {
              const on = granted.has(key);
              return (
                <li key={key} className="flex items-center gap-3 border-b border-(--line) px-5 py-3 sm:odd:border-r">
                  <span className={cn("flex size-5 items-center justify-center rounded-full", on ? "bg-signal/15 text-signal" : "bg-graphite-800 text-graphite-500")}>
                    {on ? <Check className="size-3" /> : <Minus className="size-3" />}
                  </span>
                  <span className={cn("text-small", on ? "text-bone" : "text-graphite-400")}>{label}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
