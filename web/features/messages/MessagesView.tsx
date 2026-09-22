"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, MessagesSquare, Send } from "lucide-react";
import { cn } from "@/utils/cn";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { formatDate, formatRelative, formatTime } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAction, useWorkspace } from "@/features/dashboard/context";
import { PageHeader } from "@/features/dashboard/PageHeader";
import type { Conversation } from "@/types/domain";

export function MessagesView() {
  const { data } = useWorkspace();
  const params = useSearchParams();
  const conversations = useQuery({ queryKey: ["messages", "conversations"], queryFn: () => data.listConversations() });
  const [peerId, setPeerId] = useState<string | null>(params.get("peer"));
  const [mobileThread, setMobileThread] = useState(Boolean(params.get("peer")));
  const selected = conversations.data?.find((c) => c.peer.id === peerId) ?? conversations.data?.[0] ?? null;

  return (
    <>
      <PageHeader eyebrow="Care team" title="Messages" description="Direct messages with the doctors and nurses who share your patients." />
      {conversations.error ? (
        <ErrorState error={conversations.error} onRetry={() => conversations.refetch()} />
      ) : (
        <Card className="grid h-[min(46rem,calc(100dvh-15rem))] min-h-[30rem] overflow-hidden lg:grid-cols-[20rem_1fr]">
          <div className={cn("flex min-h-0 flex-col border-r border-(--line)", mobileThread && "hidden lg:flex")}>
            <p className="text-label border-b border-(--line) px-5 py-3.5 text-graphite-400">Conversations</p>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {!conversations.data && <SkeletonRows rows={5} />}
              {conversations.data?.length === 0 && <li className="px-5 py-8 text-small text-graphite-400">No colleagues to message yet.</li>}
              {conversations.data?.map((c) => (
                <li key={c.peer.id}>
                  <button
                    onClick={() => {
                      setPeerId(c.peer.id);
                      setMobileThread(true);
                    }}
                    aria-current={selected?.peer.id === c.peer.id ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-(--line) px-5 py-4 text-left transition-colors",
                      selected?.peer.id === c.peer.id ? "bg-white/[0.045]" : "hover:bg-white/[0.02]",
                    )}
                  >
                    <Avatar name={c.peer.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-small", c.unreadCount ? "font-medium text-bone" : "text-graphite-100")}>{c.peer.name}</span>
                        {c.lastMessage && <span className="shrink-0 font-mono text-[10px] text-graphite-500">{formatRelative(c.lastMessage.createdAt)}</span>}
                      </span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-graphite-400">{c.peer.title ?? ROLE_LABEL[c.peer.role]}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="line-clamp-1 flex-1 text-[12px] text-graphite-400">{c.lastMessage?.body ?? "No messages yet"}</span>
                        {c.unreadCount > 0 && <span className="tabular rounded-full bg-signal px-1.5 font-mono text-[10px] leading-4 text-graphite-950">{c.unreadCount}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className={cn("min-h-0", !mobileThread && "hidden lg:block")}>
            {selected ? (
              <Thread key={selected.peer.id} conversation={selected} onBack={() => setMobileThread(false)} />
            ) : conversations.data ? (
              <EmptyState icon={<MessagesSquare />} title="Select a conversation" className="h-full" />
            ) : (
              <Skeleton className="size-full" />
            )}
          </div>
        </Card>
      )}
    </>
  );
}

function Thread({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { data, viewer } = useWorkspace();
  const peer = conversation.peer;
  const [body, setBody] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const messages = useQuery({ queryKey: ["messages", "thread", peer.id], queryFn: () => data.listMessages(peer.id) });
  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients() });
  const names = useMemo(() => new Map((patients.data ?? []).map((p) => [p.id, p.fullName])), [patients.data]);
  const send = useAction((d, text: string) => d.sendMessage(peer.id, text), { invalidate: ["messages"], error: "Message not sent" });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.data?.length]);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    send.mutate(text, { onSuccess: () => setBody("") });
  };

  let lastDay = "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-(--line) px-5 py-3">
        <IconButton label="Back to conversations" size="sm" className="lg:hidden" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
        <Avatar name={peer.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-bone">{peer.name}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-graphite-400">{peer.title ?? ROLE_LABEL[peer.role]}</p>
        </div>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-5" aria-live="polite">
        {!messages.data && <SkeletonRows rows={4} />}
        {messages.data?.length === 0 && <p className="py-10 text-center text-small text-graphite-400">Start the conversation with {peer.name.split(" ")[0]}.</p>}
        <AnimatePresence initial={false}>
          {messages.data?.map((m) => {
            const mine = m.senderId === viewer.id;
            const day = formatDate(m.createdAt, "long");
            const divider = day !== lastDay ? day : null;
            lastDay = day;
            return (
              <motion.div key={m.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.standardFast, ease: BEZIER.outExpo }}>
                {divider && <p className="text-label py-3 text-center text-graphite-500">{divider}</p>}
                <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[78%] rounded-2xl px-4 py-2.5", mine ? "rounded-br-md bg-bone text-graphite-950" : "rounded-bl-md border border-(--line) bg-graphite-800 text-graphite-100")}>
                    {m.patientId && names.get(m.patientId) && (
                      <p className={cn("mb-1 font-mono text-[10px] uppercase tracking-[0.1em]", mine ? "text-graphite-600" : "text-signal")}>Re: {names.get(m.patientId)}</p>
                    )}
                    <p className="whitespace-pre-line text-small leading-relaxed">{m.body}</p>
                    <p className={cn("mt-1 text-right font-mono text-[10px]", mine ? "text-graphite-600" : "text-graphite-500")}>{formatTime(m.createdAt)}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 border-t border-(--line) p-3"
      >
        <label htmlFor="message-body" className="sr-only">
          Message {peer.name}
        </label>
        <textarea
          id="message-body"
          rows={1}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Message ${peer.name.split(" ")[0]}`}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-(--line) bg-graphite-900 px-4 py-2.5 text-small text-bone placeholder:text-graphite-400 focus:border-signal/50 focus:outline-none"
        />
        <IconButton label="Send message" type="submit" disabled={!body.trim() || send.isPending} className="size-11 bg-signal text-graphite-950 hover:bg-signal-soft hover:text-graphite-950">
          <Send />
        </IconButton>
      </form>
    </div>
  );
}
