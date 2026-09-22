"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { cn } from "@/utils/cn";
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { formatRelative } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/badge";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import type { StaffRole } from "@/types/domain";
import { describeAction, describeTarget, RESULT_TONE } from "./audit-format";

const ROLES: StaffRole[] = ["doctor", "nurse", "admin"];

const CONTROLS = [
  { title: "Row level security", body: "Every table checks the signed-in user's role and assignments in Postgres. Clinicians read only the patients assigned to them." },
  { title: "Role from the database", body: "The role comes from the profile row, never from the client. Patients are sent to the Android app and cannot open this site." },
  { title: "Short-lived sessions", body: "Supabase Auth issues JWTs that refresh on each request through the proxy. A suspended account cannot refresh." },
  { title: "Append-only audit", body: "Sign-ins, record access, denials and every change are written by database triggers and cannot be edited here." },
  { title: "Encrypted transport", body: "The browser, the API Lambda and the database talk over TLS. Sensor data reaches the API from the phone, not from the device directly." },
  { title: "Screening language", body: "Indicators are review prompts, not diagnoses. Notes and plans are checked for diagnostic wording before saving." },
];

export function SecurityView() {
  const { data, home } = useWorkspace();
  const audit = useQuery({ queryKey: ["audit", "security"], queryFn: () => data.listAuditLogs({ limit: 500 }) });
  const flagged = (audit.data ?? []).filter((e) => e.result !== "success").slice(0, 8);

  return (
    <>
      <PageHeader eyebrow="Governance" title="Security" description="How access is decided and enforced, and the attempts that were turned away." />
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-8">
          <SectionTitle title="Role permissions" meta="Enforced in the database" />
          <div className="overflow-x-auto border-t border-(--line)">
            <table className="w-full min-w-[34rem] text-left">
              <caption className="sr-only">Permissions by role</caption>
              <thead>
                <tr className="border-b border-(--line)">
                  <th scope="col" className="h-10 px-5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-graphite-300">
                    Permission
                  </th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col" className="h-10 w-24 px-3 text-center font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-graphite-300">
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.entries(PERMISSIONS) as [Permission, string][]).map(([key, label]) => (
                  <tr key={key} className="border-b border-(--line) last:border-0 hover:bg-white/[0.02]">
                    <th scope="row" className="px-5 py-2.5 text-small font-normal text-graphite-100">
                      {label}
                      <span className="ml-2 font-mono text-[10.5px] text-graphite-500">{key}</span>
                    </th>
                    {ROLES.map((r) => {
                      const on = ROLE_PERMISSIONS[r].includes(key);
                      return (
                        <td key={r} className="px-3 py-2.5 text-center">
                          <span className={cn("inline-flex size-5 items-center justify-center rounded-full", on ? "bg-signal/15 text-signal" : "text-graphite-600")}>
                            {on ? <Check className="size-3" aria-label="Granted" /> : <Minus className="size-3" aria-label="Not granted" />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-4">
          <Card>
            <SectionTitle
              title="Turned away"
              meta="Denied or failed"
              actions={
                <Link href={`${home}/audit`} className="text-small text-graphite-300 transition-colors hover:text-bone">
                  Audit log
                </Link>
              }
            />
            <ul className="divide-y divide-(--line) border-t border-(--line)">
              {!audit.data && (
                <li>
                  <SkeletonRows rows={4} />
                </li>
              )}
              {audit.data && flagged.length === 0 && <li className="px-5 py-6 text-small text-graphite-400">Nothing denied recently.</li>}
              {flagged.map((e) => (
                <li key={e.id} className="flex gap-3 px-5 py-3">
                  <StatusDot tone={RESULT_TONE[e.result]} className="mt-1.5" label={e.result} />
                  <div className="min-w-0 flex-1">
                    <p className="text-small text-bone">
                      {describeAction(e.action)} <span className="text-graphite-400">· {e.result}</span>
                    </p>
                    <p className="truncate text-[12px] text-graphite-400">
                      {e.actor?.name ?? "Unknown user"}
                      {describeTarget(e) && ` · ${describeTarget(e)}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] text-graphite-400">{formatRelative(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="lg:col-span-12">
          <SectionTitle title="Controls" meta="Always on" />
          <ul className="grid border-t border-(--line) sm:grid-cols-2 xl:grid-cols-3">
            {CONTROLS.map((c) => (
              <li key={c.title} className="flex gap-3.5 border-b border-(--line) p-5 sm:[&:nth-child(odd)]:border-r xl:border-r xl:[&:nth-child(3n)]:border-r-0">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                <div>
                  <p className="text-small font-medium text-bone">{c.title}</p>
                  <p className="mt-1 text-small text-graphite-300">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
