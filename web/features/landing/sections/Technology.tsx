"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SceneGate } from "../components/SceneGate";
import { StackFallback } from "../components/fallbacks";
import { SectionLabel } from "../components/SectionLabel";
import type { TechSceneState } from "../three/TechScene";

const TechCanvas = dynamic(() => import("../three/TechScene"), { ssr: false });

/** Ordered top of stack first, so the list reads from the screen down to the skin. */
const LAYERS = [
  {
    name: "Clinical interface",
    summary: "Role-scoped workspaces that subscribe to changes instead of polling.",
    items: ["Next.js workspaces for doctor, nurse and admin", "Realtime subscriptions per assigned patient", "Every action written to the audit log"],
    spec: "Web · Realtime",
  },
  {
    name: "Analytics",
    summary: "Rules that turn readings into indicators a clinician can review.",
    items: ["Baseline delta for localized temperature", "Absolute thresholds for humidity and moisture", "Review priority derived from open indicators"],
    spec: "Rules · Priority",
  },
  {
    name: "Cloud",
    summary: "A stateless API validates every batch before anything is stored.",
    items: ["API on AWS Lambda with schema validation", "Supabase Auth issues role-bearing JWTs", "Realtime broadcasts inserts to subscribers"],
    spec: "Lambda · Auth",
  },
  {
    name: "Data",
    summary: "One Postgres schema, keyed by UUID, guarded by row-level security.",
    items: ["sensor_readings per monitoring session", "UTC timestamps on every row", "RLS policies scoped to patient assignments"],
    spec: "Postgres · RLS",
  },
  {
    name: "Connectivity",
    summary: "The phone is the gateway, so the dressing never needs Wi-Fi.",
    items: ["BLE GATT from dressing to phone", "Offline buffer with batched HTTPS sync", "Idempotent retries keyed by reading ID"],
    spec: "BLE · HTTPS",
  },
  {
    name: "Hardware",
    summary: "An ESP32 dressing that measures at the wound site, not the room.",
    items: ["DS18B20 localized temperature", "BME280 ambient temperature and humidity", "Electrode pair for relative moisture"],
    spec: "ESP32 · 5 s",
  },
] as const;

export function Technology() {
  const root = useRef<HTMLElement>(null);
  const state = useRef<TechSceneState>({ assembly: 0, selected: -1 });
  const [open, setOpen] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const baseId = useId();

  const toggle = (i: number) => {
    const next = open === i ? null : i;
    setOpen(next);
    state.current.selected = next == null ? -1 : LAYERS.length - 1 - next;
  };

  useGSAP(
    () => {
      if (reduced) {
        state.current.assembly = 1;
        return;
      }
      const q = gsap.utils.selector(root);
      ScrollTrigger.create({
        trigger: root.current,
        start: "top 85%",
        end: "top 15%",
        scrub: true,
        onUpdate: (self) => {
          state.current.assembly = self.progress;
        },
      });
      gsap.from(q("[data-tech-head] > *"), {
        opacity: 0,
        y: 28,
        duration: 1.1,
        stagger: 0.08,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
      });
      gsap.from(q("[data-layer]"), {
        opacity: 0,
        x: -24,
        duration: 0.9,
        stagger: 0.06,
        ease: "expo.out",
        scrollTrigger: { trigger: q("[data-layer-list]")[0], start: "top 80%", once: true },
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section id="technology" ref={root} aria-labelledby="tech-title" className="relative py-(--section-space)">
      <div className="container-page">
        <div data-tech-head className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionLabel index="07">Technology</SectionLabel>
            <h2 id="tech-title" className="mt-6 max-w-[14ch] text-display-m font-light text-bone">
              Six layers, <span className="text-editorial text-ivory">each replaceable.</span>
            </h2>
          </div>
          <p className="max-w-[28rem] text-body text-graphite-300 lg:col-span-4 lg:col-start-9">
            Each layer only talks to its neighbours through a documented contract. Open one to see what it is built from.
          </p>
        </div>

        <div className="mt-16 grid gap-10 lg:mt-24 lg:grid-cols-12 lg:gap-6">
          <div className="lg:sticky lg:top-[calc(var(--nav-height)+2rem)] lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:h-[min(72svh,720px)]">
            <SceneGate className="h-[44svh] w-full lg:h-full" fallback={<StackFallback />} cursor="drag" cursorLabel="Drag">
              {(p) => <TechCanvas state={state} {...p} />}
            </SceneGate>
          </div>

          <ul data-layer-list className="border-t border-(--line) lg:col-span-5 lg:row-start-1">
            {LAYERS.map((layer, i) => {
              const expanded = open === i;
              const panelId = `${baseId}-layer-${i}`;
              return (
                <li key={layer.name} data-layer className="border-b border-(--line)">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => toggle(i)}
                      data-cursor="open"
                      data-cursor-label={expanded ? "Close" : "Open"}
                      className="group/layer flex w-full items-center gap-5 py-5 text-left lg:py-6"
                    >
                      <span className={cn("tabular w-6 font-mono text-[11px] tracking-[0.14em] transition-colors", expanded ? "text-signal" : "text-graphite-500")}>
                        {String(LAYERS.length - i).padStart(2, "0")}
                      </span>
                      <span className={cn("flex-1 text-h2 font-light transition-colors duration-(--dur-micro-slow)", expanded ? "text-bone" : "text-graphite-200 group-hover/layer:text-bone")}>
                        {layer.name}
                      </span>
                      <span className="text-label hidden text-graphite-500 sm:inline">{layer.spec}</span>
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border transition-[transform,border-color,background-color] duration-(--dur-standard-fast) ease-(--ease-out-expo)",
                          expanded ? "rotate-45 border-signal/40 bg-signal/10 text-signal" : "border-(--line-strong) text-graphite-300 group-hover/layer:border-graphite-400",
                        )}
                      >
                        <Plus aria-hidden className="size-3.5" />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-label={layer.name}
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-(--dur-standard) ease-(--ease-out-quart)",
                      expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                    inert={!expanded}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-7 pl-11">
                        <p className="max-w-[34rem] text-body text-graphite-200">{layer.summary}</p>
                        <ul className="mt-5 space-y-2.5">
                          {layer.items.map((item) => (
                            <li key={item} className="flex items-start gap-3 text-small text-graphite-300">
                              <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal/70" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
