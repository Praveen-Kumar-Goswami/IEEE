"use client";

import { cloneElement, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/utils/cn";
import { BEZIER, DURATION } from "@/lib/motion/tokens";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  side?: "top" | "bottom" | "right";
  delayMs?: number;
  className?: string;
}

/** Shows on hover and keyboard focus after a short delay; described-by links it to the trigger. */
export function Tooltip({ content, children, side = "top", delayMs = 280, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delayMs);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };
  const offset = side === "top" ? { y: 4 } : side === "bottom" ? { y: -4 } : { x: -4 };
  return (
    <span className="relative inline-flex" onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide} onKeyDown={(e) => e.key === "Escape" && hide()}>
      {cloneElement(children, { "aria-describedby": open ? id : undefined })}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.96, ...offset }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: DURATION.micro, ease: BEZIER.outQuart }}
            className={cn(
              "pointer-events-none absolute z-(--z-toast) w-max max-w-64 rounded-sm border border-(--line-strong) bg-graphite-800 px-2.5 py-1.5 text-small text-graphite-100 shadow-e2",
              side === "top" && "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
              side === "bottom" && "left-1/2 top-[calc(100%+8px)] -translate-x-1/2",
              side === "right" && "left-[calc(100%+10px)] top-1/2 -translate-y-1/2",
              className,
            )}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
