"use client";

import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { gsap, SplitText, useGSAP } from "@/lib/motion/gsap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { SectionLabel } from "../components/SectionLabel";

export function FinalCta() {
  const root = useRef<HTMLElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(root);
      const split = SplitText.create(headline.current!, { type: "lines,words", mask: "lines", linesClass: "cta-line" });
      gsap.from(split.words, {
        yPercent: 110,
        duration: 1.4,
        stagger: 0.06,
        ease: "expo.out",
        scrollTrigger: { trigger: headline.current, start: "top 80%", once: true },
      });
      gsap.from(q("[data-cta-fade]"), {
        opacity: 0,
        y: 24,
        duration: 1.2,
        stagger: 0.1,
        ease: "expo.out",
        scrollTrigger: { trigger: headline.current, start: "top 70%", once: true },
      });
      gsap.fromTo(
        q("[data-cta-light]"),
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top 80%", end: "bottom bottom", scrub: true } },
      );
      return () => split.revert();
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section ref={root} aria-labelledby="cta-title" className="relative isolate overflow-hidden pb-[calc(var(--section-space)*0.8)] pt-(--section-space)">
      <div
        data-cta-light
        aria-hidden
        className="pointer-events-none absolute inset-x-[-20%] bottom-[-45%] -z-10 aspect-[2/1] rounded-[50%] bg-[radial-gradient(closest-side,rgb(245_242_236/0.16),rgb(116_216_192/0.07)_45%,transparent)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-px bg-[linear-gradient(90deg,transparent,var(--line-strong),transparent)]" />
      <div className="container-page">
        <SectionLabel index="10" className="mb-10">
          Begin
        </SectionLabel>
        <h2
          id="cta-title"
          ref={headline}
          className="max-w-[14ch] text-display-xl font-normal uppercase text-bone [&_.cta-line-mask]:-mb-[0.12em] [&_.cta-line-mask]:pb-[0.12em]"
        >
          Care should never <span className="text-editorial normal-case text-ivory">wait</span> for data.
        </h2>
        <div className="mt-14 flex flex-col gap-10 lg:mt-20 lg:flex-row lg:items-end lg:justify-between">
          <p data-cta-fade className="max-w-[26rem] text-body-l text-graphite-200">
            Open the clinical workspace as a doctor, nurse or administrator. The demo runs on a simulated unit, so explore freely.
          </p>
          <div data-cta-fade>
            <MagneticButton href="/login" size="xl" strength={0.4} transitionTypes={["nav-enter"]} cursorLabel="Enter">
              Enter Platform
              <ArrowRight aria-hidden className="size-[1em] transition-transform duration-(--dur-micro-slow) ease-(--ease-out-quart) group-hover/mag:translate-x-1" />
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  );
}
