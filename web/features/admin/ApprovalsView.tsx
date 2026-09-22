"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Check, UserCheck, X } from "lucide-react";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { formatDateTime, formatRelative } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Avatar, KeyValue } from "@/components/ui/misc";
import { Modal } from "@/components/ui/overlay";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAction, useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { AccessRequest, AccessRequestStatus } from "@/types/domain";

export function ApprovalsView() {
  const { data } = useWorkspace();
  const [view, setView] = useState<AccessRequestStatus>("pending");
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null);
  const [note, setNote] = useState("");
  const requests = useQuery({ queryKey: ["approvals"], queryFn: () => data.listAccessRequests() });

  const review = useAction((d, args: { id: string; decision: "approved" | "rejected"; note?: string }) => d.reviewAccessRequest(args.id, args.decision, args.note), {
    invalidate: ["approvals", "overview", "audit", "staff", "notifications"],
    success: (r) => (r.status === "approved" ? `${r.requester.name} can now sign in as a ${ROLE_LABEL[r.requestedRole].toLowerCase()}` : `Request from ${r.requester.name} rejected`),
  });

  const counts = useMemo(() => {
    const list = requests.data ?? [];
    return { pending: list.filter((r) => r.status === "pending").length, approved: list.filter((r) => r.status === "approved").length, rejected: list.filter((r) => r.status === "rejected").length };
  }, [requests.data]);
  const visible = (requests.data ?? []).filter((r) => r.status === view);

  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="Approvals"
        description="Clinicians who registered through the app and asked for staff access. Check the licence and unit before approving; the role takes effect at their next sign-in."
      />
      <Tabs
        label="Request status"
        value={view}
        onChange={setView}
        items={[
          { value: "pending", label: "Pending", count: counts.pending },
          { value: "approved", label: "Approved", count: counts.approved },
          { value: "rejected", label: "Rejected", count: counts.rejected },
        ]}
        className="mb-6"
      />
      {requests.error ? (
        <ErrorState error={requests.error} onRetry={() => requests.refetch()} />
      ) : !requests.data ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={<UserCheck />} title={view === "pending" ? "No requests waiting" : `No ${view} requests`} body={view === "pending" ? "New requests appear here and in your notifications." : undefined} />
        </Card>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((r) => (
              <motion.li
                key={r.id}
                layout="position"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: DURATION.micro } }}
                transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }}
              >
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start gap-4">
                    <Avatar name={r.requester.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-body font-medium text-bone">{r.requester.name}</p>
                        <Badge tone="info">{ROLE_LABEL[r.requestedRole]}</Badge>
                      </div>
                      <p className="truncate text-small text-graphite-400">{r.requester.email ?? "No email on file"}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10.5px] text-graphite-400" title={formatDateTime(r.createdAt)}>
                      {formatRelative(r.createdAt)}
                    </span>
                  </div>
                  <dl className="mt-4 divide-y divide-(--line) border-y border-(--line)">
                    <KeyValue label="Facility" value={r.facilityName ?? "--"} />
                    <KeyValue label="Department" value={r.department ?? "--"} />
                    <KeyValue label="Licence" value={<span className="font-mono text-[12px]">{r.licenseNumber ?? "Not provided"}</span>} />
                  </dl>
                  {r.justification && <p className="mt-4 text-small text-graphite-200">&ldquo;{r.justification}&rdquo;</p>}
                  <div className="mt-auto pt-5">
                    {r.status === "pending" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={<X className="size-3.5" />}
                          onClick={() => {
                            setNote("");
                            setRejecting(r);
                          }}
                        >
                          Reject
                        </Button>
                        <Button variant="signal" size="sm" iconLeft={<Check className="size-3.5" />} loading={review.isPending && review.variables?.id === r.id} onClick={() => review.mutate({ id: r.id, decision: "approved" })}>
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <p className="text-[12px] text-graphite-400">
                        {r.status === "approved" ? "Approved" : "Rejected"} by {r.reviewedBy?.name ?? "an administrator"}
                        {r.reviewedAt && ` · ${formatRelative(r.reviewedAt)}`}
                        {r.reviewNote && <span className="mt-1 block text-graphite-300">{r.reviewNote}</span>}
                      </p>
                    )}
                  </div>
                </Card>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <Modal
        open={rejecting != null}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${rejecting.requester.name}?` : ""}
        description="They keep their patient app account. The note is saved with the request in the audit log."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={review.isPending}
              onClick={() => rejecting && review.mutate({ id: rejecting.id, decision: "rejected", note }, { onSuccess: () => setRejecting(null) })}
            >
              Reject request
            </Button>
          </>
        }
      >
        <Field label="Reason" optional>
          {({ id }) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: licence number could not be verified." />}
        </Field>
      </Modal>
    </>
  );
}
