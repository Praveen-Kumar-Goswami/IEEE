"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/utils/cn";
import { BEZIER, DURATION } from "@/lib/motion/tokens";

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

interface DropdownProps {
  trigger: (props: { open: boolean; toggle: () => void; id: string; "aria-expanded": boolean; "aria-haspopup": "menu"; "aria-controls": string }) => ReactNode;
  items?: MenuItem[];
  children?: ReactNode;
  align?: "start" | "end";
  width?: string;
  label: string;
}

/**
 * Menu that grows from its trigger's corner. With `items` it is a WAI-ARIA menu
 * (arrow keys, Home/End, Escape); with `children` it is a popover panel.
 */
export function Dropdown({ trigger, items, children, align = "end", width = "w-56", label }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => (items ? list.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus() : list.current?.focus()));
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, items]);

  const onKey = (e: KeyboardEvent) => {
    if (!items) return;
    const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(active);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = enabled[(pos + 1) % enabled.length];
    if (e.key === "ArrowUp") next = enabled[(pos - 1 + enabled.length) % enabled.length];
    if (e.key === "Home") next = enabled[0];
    if (e.key === "End") next = enabled[enabled.length - 1];
    if (e.key === "Tab") setOpen(false);
    if (next == null) return;
    e.preventDefault();
    setActive(next);
    list.current?.querySelectorAll<HTMLElement>("[role=menuitem]")[next]?.focus();
  };

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), id: `${id}-trigger`, "aria-expanded": open, "aria-haspopup": "menu", "aria-controls": `${id}-menu` })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={list}
            id={`${id}-menu`}
            role={items ? "menu" : "dialog"}
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onKey}
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: DURATION.microSlow, ease: BEZIER.outQuart }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            className={cn(
              "absolute top-[calc(100%+8px)] z-(--z-drawer) overflow-hidden rounded-md border border-(--line-strong) bg-graphite-850/95 shadow-e3 backdrop-blur-md focus:outline-none",
              align === "end" ? "right-0" : "left-0",
              width,
            )}
          >
            {items ? (
              <div className="p-1">
                {items.map((item, i) => (
                  <button
                    key={item.id}
                    role="menuitem"
                    tabIndex={i === active ? 0 : -1}
                    disabled={item.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => {
                      item.onSelect();
                      setOpen(false);
                    }}
                    className={cn(
                      "flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-small transition-colors duration-(--dur-micro-fast) focus:outline-none disabled:opacity-40 [&_svg]:size-4",
                      item.tone === "danger" ? "text-critical focus:bg-critical/10" : "text-graphite-100 focus:bg-white/[0.06] focus:text-bone",
                    )}
                  >
                    {item.icon && <span className="text-graphite-300">{item.icon}</span>}
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              children
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
