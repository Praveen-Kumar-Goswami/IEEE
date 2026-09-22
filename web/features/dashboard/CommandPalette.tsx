"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Search, UserRound } from "lucide-react";
import { cn } from "@/utils/cn";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { useFocusTrap, useScrollLock } from "@/hooks/use-focus-trap";
import { useUiStore } from "@/stores/ui";
import { Kbd } from "@/components/ui/misc";
import { PriorityBadge } from "@/components/ui/badge";
import type { ReviewPriority } from "@/types/domain";
import { useWorkspace } from "./context";
import { NAV } from "./nav";

interface Entry {
  id: string;
  group: "Pages" | "Patients";
  label: string;
  hint: string;
  href: string;
  haystack: string;
  icon: React.ComponentType<{ className?: string }>;
  priority?: ReviewPriority;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommand);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable=true]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{open && <Palette onClose={() => setOpen(false)} />}</AnimatePresence>, document.body);
}

function Palette({ onClose }: { onClose: () => void }) {
  const { data, viewer, home } = useWorkspace();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  useFocusTrap(ref, true, onClose);
  useScrollLock(true);

  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients() });

  const entries = useMemo<Entry[]>(() => {
    const pages: Entry[] = NAV[viewer.role].flatMap((g) =>
      g.items.map((item) => ({
        id: item.href,
        group: "Pages" as const,
        label: item.label,
        hint: g.label,
        href: item.href,
        haystack: `${item.label} ${g.label} ${item.keywords ?? ""}`.toLowerCase(),
        icon: item.icon,
      })),
    );
    const people: Entry[] = (patients.data ?? []).map((p) => ({
      id: p.id,
      group: "Patients" as const,
      label: p.fullName,
      hint: [p.roomLabel, p.device?.serial].filter(Boolean).join(" · "),
      href: `${home}/patients/${p.id}`,
      haystack: `${p.fullName} ${p.roomLabel ?? ""} ${p.device?.serial ?? ""} ${p.facilityName ?? ""}`.toLowerCase(),
      icon: UserRound,
      priority: p.priority,
    }));
    const q = query.trim().toLowerCase();
    const all = [...pages, ...people];
    if (!q) return [...pages, ...people.slice(0, 5)];
    return all.filter((e) => q.split(/\s+/).every((word) => e.haystack.includes(word))).slice(0, 12);
  }, [viewer.role, patients.data, query, home]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    onClose();
    router.push(entry.href, { transitionTypes: ["nav-section"] });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + entries.length) % Math.max(1, entries.length);
      setActive(next);
      list.current?.querySelectorAll("[role=option]")[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[active]);
    }
  };

  let lastGroup: string | null = null;

  return (
    <div className="fixed inset-0 z-(--z-command) flex items-start justify-center px-4 pt-[12vh]">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-void/70 backdrop-blur-[6px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.standardFast }}
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Search the workspace"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -4 }}
        transition={{ duration: DURATION.standardFast, ease: BEZIER.outExpo }}
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-(--line-strong) bg-graphite-900/95 shadow-e3 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 border-b border-(--line) px-4">
          <Search aria-hidden className="size-4 text-graphite-400" />
          <input
            data-autofocus
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={entries[active] ? `cmd-${entries[active].id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Search patients, rooms, devices or pages"
            className="h-14 flex-1 bg-transparent text-body text-bone placeholder:text-graphite-400 focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul ref={list} id="command-results" role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
          {entries.length === 0 && <li className="px-3 py-10 text-center text-small text-graphite-300">Nothing matches “{query}”.</li>}
          {entries.map((entry, i) => {
            const header = entry.group !== lastGroup ? entry.group : null;
            lastGroup = entry.group;
            return (
              <li key={entry.id} role="presentation">
                {header && <p className="text-label px-3 pb-1.5 pt-3 text-graphite-400 first:pt-1">{header}</p>}
                <div
                  id={`cmd-${entry.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(entry)}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 transition-colors duration-(--dur-micro-fast)",
                    i === active ? "bg-white/[0.06] text-bone" : "text-graphite-200",
                  )}
                >
                  <entry.icon className="size-4 shrink-0 text-graphite-300" />
                  <span className="truncate text-small">{entry.label}</span>
                  {entry.hint && <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-graphite-400">{entry.hint}</span>}
                  <span className="ml-auto flex items-center gap-3">
                    {entry.priority && <PriorityBadge priority={entry.priority} compact />}
                    {i === active && <CornerDownLeft aria-hidden className="size-3.5 text-graphite-400" />}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-(--line) px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-graphite-400">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
        </div>
      </motion.div>
    </div>
  );
}
