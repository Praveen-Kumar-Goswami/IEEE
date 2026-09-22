"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import { useToastStore, type Toast, type ToastTone } from "@/stores/toast";
import { BEZIER, DURATION } from "@/lib/motion/tokens";

const TONE: Record<ToastTone, { icon: typeof Info; className: string }> = {
  neutral: { icon: Info, className: "text-graphite-200" },
  info: { icon: Info, className: "text-info" },
  success: { icon: CheckCircle2, className: "text-signal" },
  error: { icon: XCircle, className: "text-critical" },
  watch: { icon: AlertTriangle, className: "text-watch" },
  attention: { icon: AlertTriangle, className: "text-attention" },
};

function ToastItem({ toast, index }: { toast: Toast; index: number }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = TONE[toast.tone].icon;

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(6px)" }}
      animate={{ opacity: index > 2 ? 0.6 : 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 40, transition: { duration: DURATION.microSlow, ease: BEZIER.inQuart } }}
      transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }}
      role={toast.tone === "error" || toast.tone === "attention" ? "alert" : "status"}
      className="pointer-events-auto relative flex w-full gap-3 overflow-hidden rounded-md border border-(--line-strong) bg-graphite-850/95 p-4 pr-10 shadow-e3 backdrop-blur-md"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[toast.tone].className)} aria-hidden />
      <div className="min-w-0">
        <p className="text-small font-medium text-bone">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-small text-graphite-300">{toast.body}</p>}
        {toast.action && (
          <Link href={toast.action.href} onClick={() => dismiss(toast.id)} className="mt-2 inline-block text-small text-signal underline-offset-4 hover:underline">
            {toast.action.label}
          </Link>
        )}
      </div>
      <button onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="absolute right-2.5 top-2.5 rounded-full p-1 text-graphite-400 transition-colors hover:text-bone">
        <X className="size-3.5" />
      </button>
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-bone/20"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: toast.durationMs / 1000, ease: "linear" }}
      />
    </motion.li>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-(--z-toast) w-[min(24rem,calc(100vw-2rem))]">
      <ol className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t, i) => (
            <ToastItem key={t.id} toast={t} index={toasts.length - 1 - i} />
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
