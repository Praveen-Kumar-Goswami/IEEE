"use client";

import { useRef } from "react";
import { cn } from "@/utils/cn";
import { gsap, useGSAP } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { StatusDot } from "@/components/ui/badge";
import { SectionLabel, Words } from "../components/SectionLabel";

const INDICATORS = [
  { text: "LOCAL 37.9 °C", x: "8%", y: "16%" },
  { text: "HUM 81.2 %RH", x: "78%", y: "12%" },
  { text: "ADC 388", x: "86%", y: "44%" },
  { text: "SYNC PENDING 06:12", x: "6%", y: "78%" },
  { text: "ESP32-004 · LAST SEEN 02:14", x: "62%", y: "84%" },
  { text: "Δ +1.6 °C FROM BASELINE", x: "30%", y: "8%" },
  { text: "BATTERY 18 %", x: "44%", y: "90%" },
  { text: "BLE −78 dBm", x: "90%", y: "70%" },
];

export function Problem() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(root);
      const first = q("[data-first] [data-word]");
      const second = q("[data-second] [data-word]");
      gsap.set(first, { opacity: 0.1 });
      gsap.set(second, { opacity: 0, y: 24, filter: "blur(8px)" });
      gsap.set(q("[data-after]"), { opacity: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.6 },
      });
      tl.to(first, { opacity: 1, stagger: 0.12, duration: 0.4 })
        .to(q("[data-before]"), { opacity: 1, duration: 0.3 }, "<0.4")
        .addLabel("dark", "+=0.3")
        .to(q("[data-dim]"), { opacity: 0.92, duration: 1 }, "dark")
        .to(q("[data-indicator]"), { opacity: 0, y: -12, filter: "blur(6px)", stagger: { each: 0.08, from: "random" }, duration: 0.4 }, "dark")
        .to(q("[data-grid]"), { opacity: 0, duration: 0.8 }, "dark")
        .to(first, { opacity: 0, y: -18, filter: "blur(10px)", stagger: 0.05, duration: 0.3 }, "dark+=0.8")
        .to(q("[data-before]"), { opacity: 0, duration: 0.3 }, "<")
        .addLabel("reveal", "+=0.1")
        .to(second, { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.1, duration: 0.5, ease: "power2.out" }, "reveal")
        .to(q("[data-after]"), { opacity: 1, duration: 0.4 }, "reveal+=0.6")
        .to(q("[data-dim]"), { opacity: 0.55, duration: 0.8 }, "reveal+=0.4")
        .to({}, { duration: 0.4 });
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section id="problem" ref={root} aria-labelledby="problem-title" className={cn("relative", reduced ? "py-(--section-space)" : "h-[340vh]")}>
      <div className={cn("overflow-hidden", !reduced && "sticky top-0 flex h-svh items-center")}>
        <div data-dim aria-hidden className="absolute inset-0 bg-void opacity-0" />
        <div data-grid aria-hidden className="absolute inset-0 opacity-100 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:12.5vw_12.5vw] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        {!reduced &&
          INDICATORS.map((ind) => (
            <span key={ind.text} data-indicator aria-hidden className="absolute hidden font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-300 sm:block" style={{ left: ind.x, top: ind.y }}>
              <span className="mr-2 inline-block size-1 rounded-full bg-watch align-middle" />
              {ind.text}
            </span>
          ))}

        <div className="container-page relative">
          <SectionLabel index="02" className="mb-10">
            The problem
          </SectionLabel>
          <div className="grid">
            <h2 id="problem-title" data-first className="col-start-1 row-start-1 max-w-[15ch] text-display-m font-light text-bone">
              <Words text="Healthcare data should not arrive after the problem happens." />
            </h2>
            <p data-second className={cn("col-start-1 max-w-[16ch] text-display-m font-light text-bone", reduced ? "row-start-2 mt-12" : "row-start-1")}>
              <Words text="It should arrive" /> <Words text="while it is happening." wordClassName="text-editorial text-ivory" />
            </p>
          </div>

          <div className="relative mt-14 h-6 font-mono text-[11px] uppercase tracking-[0.14em]">
            <p data-before className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-graphite-300", !reduced && "absolute inset-0 opacity-0")}>
              <span>Captured 02:14</span>
              <span aria-hidden className="h-px w-10 bg-watch/60" />
              <span className="text-watch">Reviewed 08:40 · 6 h 26 min later</span>
            </p>
            <p data-after className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-graphite-200", !reduced ? "absolute inset-0" : "mt-4")}>
              <StatusDot tone="signal" pulse />
              <span>Captured 02:14:07</span>
              <span aria-hidden className="h-px w-10 bg-signal/60" />
              <span className="text-signal">On a clinician&apos;s screen 02:14:09 · 2 s</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
