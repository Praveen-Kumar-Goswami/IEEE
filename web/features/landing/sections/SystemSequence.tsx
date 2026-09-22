"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SceneGate } from "../components/SceneGate";
import { StationsFallback } from "../components/fallbacks";
import { SectionLabel } from "../components/SectionLabel";
import type { SystemSceneState } from "../three/SystemScene";

const SystemCanvas = dynamic(() => import("../three/SystemScene"), { ssr: false });

const STEPS = [
  {
    title: "Data is collected",
    body: "The dressing samples localized temperature, humidity and relative moisture every five seconds, and sends each reading to the patient's phone over Bluetooth.",
    meta: "DS18B20 · BME280 · Electrodes",
  },
  {
    title: "Data is processed",
    body: "The phone buffers readings while offline and syncs them in batches. The API validates every reading, rejects duplicates and stores it against the monitoring session.",
    meta: "Offline buffer · Batch sync · Validation",
  },
  {
    title: "A change is identified",
    body: "Each reading is compared with the session baseline and the configured thresholds. Crossing one opens a monitoring indicator for review. It is never a diagnosis.",
    meta: "Baseline delta · Thresholds · Rules",
  },
  {
    title: "The clinical team is alerted",
    body: "The assigned nurse and doctor see the indicator in real time, together with the reading, the rule that fired and the trend that led to it.",
    meta: "Realtime · Role-scoped · Escalation",
  },
  {
    title: "Action is recorded",
    body: "Acknowledgements, bedside checks and notes are written to the patient timeline and to an append-only audit log.",
    meta: "Timeline · Notes · Audit log",
  },
] as const;

export function SystemSequence() {
  const root = useRef<HTMLElement>(null);
  const state = useRef<SystemSceneState>({ progress: 0 });
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) {
        state.current.progress = 1;
        return;
      }
      const q = gsap.utils.selector(root);
      const st = ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          state.current.progress = self.progress;
          const next = Math.round(self.progress * (STEPS.length - 1));
          setStep((prev) => (prev === next ? prev : next));
        },
      });
      gsap.fromTo(
        q("[data-rail-fill]"),
        { scaleY: 0 },
        { scaleY: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.4 } },
      );
      gsap.fromTo(
        q("[data-system-head]"),
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 70%", once: true } },
      );
      gsap.to(q("[data-system-veil]"), {
        opacity: 1,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "bottom bottom+=35%", end: "bottom bottom", scrub: true },
      });
      return () => st.kill();
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section
      id="how-it-works"
      ref={root}
      aria-labelledby="system-title"
      className={cn("relative", reduced ? "py-(--section-space)" : "h-[440vh] lg:h-[520vh]")}
    >
      <div className={cn("overflow-hidden", !reduced && "sticky top-0 h-svh")}>
        {reduced ? (
          <div className="container-page aspect-[2/1] max-h-[40svh] w-full opacity-70">
            <StationsFallback />
          </div>
        ) : (
          <SceneGate className="absolute inset-0" fallback={<StationsFallback />} cursorLabel="Scroll">
            {(p) => <SystemCanvas state={state} {...p} />}
          </SceneGate>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,var(--color-graphite-950)_0%,color-mix(in_oklab,var(--color-graphite-950)_60%,transparent)_30%,transparent_55%)] lg:block" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(0deg,var(--color-graphite-950)_20%,transparent)] lg:hidden" />
        <div data-system-veil aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,color-mix(in_oklab,var(--color-signal)_10%,transparent),transparent_60%)] opacity-0" />

        <div
          className={cn(
            "container-page pointer-events-none relative flex flex-col justify-between gap-10",
            !reduced && "h-full pb-10 pt-[calc(var(--nav-height)+2rem)] lg:pb-14",
          )}
        >
          <header data-system-head>
            <SectionLabel index="03">How it works</SectionLabel>
            <h2 id="system-title" className="mt-6 max-w-[14ch] text-h1 font-light text-bone">
              From dressing to decision, <span className="text-editorial text-ivory">in five steps.</span>
            </h2>
          </header>

          <div className="flex items-end gap-6 lg:grid lg:grid-cols-12">
            <div aria-hidden className={cn("relative w-px self-stretch bg-graphite-700 lg:col-span-1 lg:justify-self-start", reduced && "hidden")}>
              <div data-rail-fill className="absolute inset-0 origin-top bg-signal" />
            </div>
            <ol className="flex-1 space-y-1 lg:col-span-5 lg:-ml-[calc(var(--gutter)*1.5)]">
              {STEPS.map((s, i) => {
                const active = reduced || i === step;
                return (
                  <li
                    key={s.title}
                    aria-current={!reduced && i === step ? "step" : undefined}
                    className={cn("transition-[color,opacity] duration-(--dur-standard) ease-(--ease-out-quart)", !active && "max-lg:sr-only")}
                  >
                    <div className="flex items-baseline gap-4 py-1.5">
                      <span className={cn("tabular font-mono text-[11px] tracking-[0.14em]", active ? "text-signal" : "text-graphite-500")}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className={cn("text-h3 font-normal transition-colors duration-(--dur-standard)", active ? "text-bone" : "text-graphite-500")}>{s.title}</h3>
                    </div>
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-(--dur-standard) ease-(--ease-out-quart)",
                        active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-[34rem] pb-4 pl-[calc(11px*2+1rem)] text-body text-graphite-200">{s.body}</p>
                        <p className="text-label pb-3 pl-[calc(11px*2+1rem)] text-graphite-400">{s.meta}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {!reduced && (
              <p aria-hidden className="text-label tabular hidden text-right text-graphite-400 lg:col-span-2 lg:col-start-11 lg:block">
                Step {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
