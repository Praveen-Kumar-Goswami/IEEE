"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/utils/cn";
import { SPRING } from "@/lib/motion/tokens";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  idBase?: string;
}

/** Underline tabs with a sliding indicator. Arrow keys move between tabs (WAI-ARIA tabs pattern). */
export function Tabs<T extends string>({ items, value, onChange, label, className, idBase }: TabsProps<T>) {
  const fallback = useId();
  const base = idBase ?? fallback;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const next = e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next == null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  return (
    <div role="tablist" aria-label={label} className={cn("no-scrollbar relative flex gap-1 overflow-x-auto border-b border-(--line)", className)}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${base}-tab-${item.value}`}
            aria-controls={`${base}-panel-${item.value}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative flex h-11 shrink-0 items-center gap-2 px-3.5 text-small transition-colors duration-(--dur-micro)",
              selected ? "text-bone" : "text-graphite-300 hover:text-graphite-100",
            )}
          >
            {item.label}
            {item.count != null && (
              <span className={cn("tabular rounded-full px-1.5 font-mono text-[10px]", selected ? "bg-bone/10 text-bone" : "bg-graphite-800 text-graphite-300")}>{item.count}</span>
            )}
            {selected && <motion.span layoutId={`${base}-indicator`} transition={SPRING.snappy} className="absolute inset-x-2 -bottom-px h-px bg-bone" />}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ value, active, idBase, children, className }: { value: string; active: string; idBase: string; children: ReactNode; className?: string }) {
  if (value !== active) return null;
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} tabIndex={0} className={cn("focus-visible:outline-offset-4", className)}>
      {children}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Pill segmented control (time ranges, view modes). Radio-group semantics. */
export function Segmented<T extends string>({ options, value, onChange, label, size = "sm", className }: SegmentedProps<T>) {
  const id = useId();
  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(options[(i + 1) % options.length].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(options[(i - 1 + options.length) % options.length].value);
    }
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={cn("relative inline-flex rounded-full border border-(--line) bg-graphite-900 p-0.5", className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 rounded-full font-mono uppercase tracking-[0.08em] transition-colors duration-(--dur-micro)",
              size === "sm" ? "h-7 px-3 text-[10.5px]" : "h-9 px-4 text-[11px]",
              selected ? "text-graphite-950" : "text-graphite-300 hover:text-bone",
            )}
          >
            {selected && <motion.span layoutId={`${id}-seg`} transition={SPRING.snappy} className="absolute inset-0 -z-10 rounded-full bg-bone" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
