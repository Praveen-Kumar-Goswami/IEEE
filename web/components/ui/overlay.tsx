"use client";

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { useFocusTrap, useScrollLock } from "@/hooks/use-focus-trap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { IconButton } from "./button";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 bg-void/70 backdrop-blur-[6px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.standardFast, ease: BEZIER.outQuart }}
      onClick={onClose}
    />
  );
}

/** Centered dialog that scales in from 0.96 with a short blur. */
export function Modal({ open, onClose, title, description, children, footer, className, size = "md" }: OverlayProps & { size?: "sm" | "md" | "lg" }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useFocusTrap(ref, open, onClose);
  useScrollLock(open);
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-(--z-modal) flex items-end justify-center p-0 sm:items-center sm:p-6">
            <Scrim onClose={onClose} />
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className={cn(
                "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-(--line-strong) bg-graphite-900 shadow-e3 sm:rounded-xl",
                size === "sm" && "sm:max-w-md",
                size === "md" && "sm:max-w-xl",
                size === "lg" && "sm:max-w-3xl",
                className,
              )}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6, filter: "blur(4px)" }}
              transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }}
            >
              <div className="flex items-start justify-between gap-6 border-b border-(--line) px-6 pb-5 pt-6">
                <div>
                  <h2 id="modal-title" className="text-h3 font-medium text-bone">
                    {title}
                  </h2>
                  {description && <p className="mt-1 text-small text-graphite-300">{description}</p>}
                </div>
                <IconButton label="Close" size="sm" onClick={onClose}>
                  <X />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
              {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-(--line) px-6 py-4">{footer}</div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Right-hand panel for detail views. Slides with the standard expo curve. */
export function Drawer({ open, onClose, title, description, children, footer, className }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useFocusTrap(ref, open, onClose);
  useScrollLock(open);
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-(--z-drawer)">
            <Scrim onClose={onClose} />
            <motion.aside
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawer-title"
              className={cn("absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-(--line-strong) bg-graphite-900 shadow-e3", className)}
              initial={reduced ? { opacity: 0 } : { x: "100%" }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }}
            >
              <div className="flex items-start justify-between gap-6 border-b border-(--line) px-6 pb-5 pt-6">
                <div className="min-w-0">
                  <h2 id="drawer-title" className="text-h3 font-medium text-bone">
                    {title}
                  </h2>
                  {description && <div className="mt-1 text-small text-graphite-300">{description}</div>}
                </div>
                <IconButton label="Close" size="sm" onClick={onClose}>
                  <X />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
              {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-(--line) px-6 py-4">{footer}</div>}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
