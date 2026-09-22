"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { SectionLabel } from "../components/SectionLabel";
import { MonitorPanel } from "../components/MonitorPanel";
import { SHOWCASE } from "../data/showcase";

export function LiveMonitoring() {
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const reveal = useRef<SVGRectElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(root);
      gsap.fromTo(
        panel.current,
        { clipPath: "inset(14% 18% 14% 18% round 28px)", scale: 0.94, opacity: 0.35 },
        {
          clipPath: "inset(0% 0% 0% 0% round 18px)",
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: panel.current, start: "top bottom", end: "top 30%", scrub: 0.6 },
        },
      );
      gsap.from(q("[data-live-head] > *"), {
        opacity: 0,
        y: 28,
        duration: 1.1,
        stagger: 0.08,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
      });
      if (reveal.current) {
        gsap.fromTo(
          reveal.current,
          { attr: { width: 0 } },
          { attr: { width: 1000 }, duration: 1.8, ease: "power3.inOut", scrollTrigger: { trigger: panel.current, start: "top 55%", once: true } },
        );
      }
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section id="platform" ref={root} aria-labelledby="live-title" className="relative pb-(--section-space) pt-[calc(var(--section-space)*0.6)]">
      <div className="container-page">
        <div data-live-head className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionLabel index="04">Live monitoring</SectionLabel>
            <h2 id="live-title" className="mt-6 max-w-[16ch] text-display-m font-light text-bone">
              Every reading, <span className="text-editorial text-ivory">the moment it lands.</span>
            </h2>
          </div>
          <p className="max-w-[28rem] text-body text-graphite-300 lg:col-span-4 lg:col-start-9">
            A replay of a simulated session at {SHOWCASE.speed}× speed. A scripted temperature rise opens an indicator, the nurse acknowledges it and the reading settles. Nothing here is random.
          </p>
        </div>
        <div ref={panel} className="mt-14 will-change-[clip-path,transform] lg:mt-20">
          <MonitorPanel ref={reveal} reduced={reduced} />
        </div>
      </div>
    </section>
  );
}
