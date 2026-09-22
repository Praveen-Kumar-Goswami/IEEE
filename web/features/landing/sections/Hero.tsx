"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/motion/gsap";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { StatusDot } from "@/components/ui/badge";
import { useIntroStore } from "@/stores/intro";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useNow } from "@/hooks/use-now";
import { clamp, valueNoise } from "@/utils/math";
import { BRAND } from "@/lib/brand";
import { SceneGate } from "../components/SceneGate";
import { DressingFallback } from "../components/fallbacks";
import { SHOWCASE, showcaseSample, showcaseTime } from "../data/showcase";
import type { HeroSceneState } from "../three/DressingScene";

const DressingCanvas = dynamic(() => import("../three/DressingScene"), { ssr: false });

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: document.documentElement.classList.contains("reduced-motion") ? "auto" : "smooth" });
}

export function Hero() {
  const section = useRef<HTMLElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);
  const scene = useRef<HeroSceneState>({ scroll: 0, px: 0, py: 0 });
  const intro = useRef<gsap.core.Timeline | null>(null);
  const ready = useIntroStore((s) => s.loaderDone);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(section);
      const split = SplitText.create(headline.current!, { type: "lines,chars", mask: "lines", linesClass: "hero-line" });
      const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
      tl.from(split.chars, { yPercent: 115, duration: 1.3, stagger: 0.024 })
        .from(q("[data-hero-fade]"), { opacity: 0, y: 18, duration: 1.1, stagger: 0.08 }, 0.55)
        .from(q("[data-hero-corner]"), { opacity: 0, scale: 0.9, duration: 1.2, stagger: 0.06 }, 0.8);
      intro.current = tl;
      if (useIntroStore.getState().loaderDone) tl.play();

      ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => {
          scene.current.scroll = self.progress;
        },
      });
      gsap.to(q("[data-hero-copy]"), { yPercent: -18, opacity: 0.15, ease: "none", scrollTrigger: { trigger: section.current, start: "top top", end: "bottom top", scrub: true } });
      return () => split.revert();
    },
    { scope: section, dependencies: [reduced] },
  );

  useEffect(() => {
    if (ready) intro.current?.play();
  }, [ready]);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      scene.current.px = (e.clientX / window.innerWidth) * 2 - 1;
      scene.current.py = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      scene.current.px = clamp(e.gamma / 30, -1, 1);
      scene.current.py = clamp((e.beta - 45) / 30, -1, 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, [reduced]);

  return (
    <section ref={section} aria-labelledby="hero-title" className="relative isolate flex min-h-svh flex-col overflow-hidden pt-(--nav-height)">
      <SceneGate
        className="order-2 h-[52svh] w-full lg:absolute lg:inset-y-0 lg:left-[30%] lg:right-0 lg:-z-10 lg:h-auto lg:w-auto"
        fallback={<DressingFallback />}
        cursorLabel="drag"
      >
        {({ tier, active, reduced: r, onReady }) => <DressingCanvas state={scene} tier={tier} active={active} reduced={r} onReady={onReady} />}
      </SceneGate>
      <TelemetryCorners />

      <div data-hero-copy className="container-page pointer-events-none relative order-1 flex flex-col justify-center pt-10 lg:flex-1 lg:pb-24">
        <p data-hero-fade className="text-label mb-8 flex items-center gap-3 text-graphite-200">
          <StatusDot tone="signal" pulse />
          {BRAND.product} · Clinical workspace
        </p>
        <h1 id="hero-title" ref={headline} className="max-w-[12ch] text-display-l font-normal text-bone [&_.hero-line-mask]:-mb-[0.16em] [&_.hero-line-mask]:pb-[0.16em]">
          Healthcare.
          <br />
          Reimagined in
          <br />
          <span className="text-editorial text-ivory">real time.</span>
        </h1>
        <div className="mt-10 max-w-[30rem] space-y-9 lg:mt-12">
          <p data-hero-fade className="text-body-l text-graphite-200">
            {BRAND.name} streams wound-site indicators from a sensor dressing to the care team, so a change in temperature, humidity or moisture reaches a clinician while it is happening.
          </p>
          <div data-hero-fade className="pointer-events-auto flex flex-wrap items-center gap-3">
            <MagneticButton size="lg" onClick={() => scrollToId("platform")}>
              Explore Platform
              <ArrowDown className="size-4" />
            </MagneticButton>
            <MagneticButton size="lg" variant="outline" href="/login" transitionTypes={["nav-enter"]}>
              View Live Demo
              <ArrowRight className="size-4" />
            </MagneticButton>
          </div>
        </div>
      </div>

      <HeroFooter />
    </section>
  );
}

function Corner({ label, value, className, align = "left" }: { label: string; value: string; className: string; align?: "left" | "right" }) {
  return (
    <div data-hero-corner className={`pointer-events-none absolute hidden font-mono text-[10px] uppercase tracking-[0.16em] lg:block ${className}`}>
      <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span aria-hidden className="size-2 border-l border-t border-graphite-400" style={align === "right" ? { transform: "scaleX(-1)" } : undefined} />
        <span className="text-graphite-300">{label}</span>
      </div>
      <p className={`tabular mt-1.5 text-bone ${align === "right" ? "text-right" : "pl-4"}`}>{value}</p>
    </div>
  );
}

/** Viewfinder labels around the model. Values are derived, not random. */
function TelemetryCorners() {
  const now = useNow(1000);
  let session = "--:--:--";
  let rssi = "--";
  let latency = "-.-";
  if (now != null) {
    const elapsed = Math.floor((showcaseTime(now) % (6 * 3_600_000)) / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    session = `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`;
    rssi = String(Math.round(-61 + valueNoise(3, now / 4000) * 3));
    latency = (1.6 + valueNoise(9, now / 3000) * 0.35).toFixed(1);
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-[17%] left-[50%] right-(--margin) hidden lg:block">
      <Corner className="left-0 top-0" label="Live monitoring" value={`Session ${session}`} />
      <Corner className="right-0 top-0" label="Connected" value={`BLE ${rssi} dBm`} align="right" />
      <Corner className="bottom-0 left-0" label="Secure" value="TLS 1.3 · RLS" />
      <Corner className="bottom-0 right-0" label="Real time" value={`Sync ${latency} s`} align="right" />
    </div>
  );
}

function HeroFooter() {
  const now = useNow(1000);
  const s = now == null ? null : showcaseSample(showcaseTime(now));
  return (
    <div data-hero-fade className="container-page relative order-3 flex items-end justify-between gap-6 pb-6 text-graphite-300">
      <button onClick={() => scrollToId("problem")} className="text-label group flex items-center gap-3 transition-colors hover:text-bone" data-cursor="button">
        <span className="relative flex h-9 w-5 justify-center rounded-full border border-(--line-strong)">
          <span className="mt-2 h-1.5 w-px bg-bone motion-safe:animate-[scroll-cue_2.2s_var(--ease-in-out-cine)_infinite]" />
        </span>
        Scroll
      </button>
      <dl className="hidden items-center gap-8 font-mono text-[10.5px] uppercase tracking-[0.14em] md:flex">
        <div className="flex items-center gap-2">
          <dt className="text-graphite-400">{SHOWCASE.device}</dt>
          <dd className="flex items-center gap-2 text-graphite-200">
            <StatusDot tone="signal" /> Synced
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-graphite-400">Local</dt>
          <dd className="tabular text-bone">{s?.localizedTemperatureC?.toFixed(1) ?? "--"} °C</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-graphite-400">Humidity</dt>
          <dd className="tabular text-bone">{s?.humidityPercent?.toFixed(1) ?? "--"} %</dd>
        </div>
        <div className="hidden items-center gap-2 xl:flex">
          <dt className="text-graphite-400">Moisture</dt>
          <dd className="tabular text-bone">{s?.relativeMoistureValue ?? "--"} ADC</dd>
        </div>
      </dl>
      <p className="max-w-[16rem] text-right text-[11px] leading-snug text-graphite-400">Monitoring indicators for clinical review. Not a diagnostic device.</p>
    </div>
  );
}
