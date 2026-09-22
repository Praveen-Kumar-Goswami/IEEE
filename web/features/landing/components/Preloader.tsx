"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/motion/gsap";
import { LogoMark } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";
import { useIntroStore } from "@/stores/intro";
import { selectReduced, useMotionStore } from "@/stores/motion";

const SEEN_KEY = "tend-intro-seen";
const MOTES = 14;

/**
 * Black, a thin light trace, the mark drawn, 00 → 100, motes, then the mark separates
 * and a vertical mask lifts to reveal the hero. About 2.6 s on a first visit, 1.1 s after.
 * Any key, click or the skip button finishes it at 5x speed.
 */
export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const [gone, setGone] = useState(false);
  const setLoaderDone = useIntroStore((s) => s.setLoaderDone);

  useGSAP(
    () => {
      const reduced = selectReduced(useMotionStore.getState()) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const repeat = sessionStorage.getItem(SEEN_KEY) === "1";
      const finish = () => {
        sessionStorage.setItem(SEEN_KEY, "1");
        document.documentElement.classList.remove("is-loading");
        setLoaderDone();
        setGone(true);
      };
      if (reduced) {
        finish();
        return;
      }
      document.documentElement.classList.add("is-loading");
      const q = gsap.utils.selector(root);
      const count = { v: 0 };
      const speed = repeat ? 0.42 : 1;

      const t = gsap.timeline({ defaults: { ease: "expo.inOut" }, onComplete: finish });
      t.set(q("[data-logo-frame], [data-logo-trace]"), { drawSVG: "0%" })
        .set(q("[data-logo-node]"), { scale: 0, transformOrigin: "50% 50%" })
        .fromTo(q(".trace"), { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.9 * speed, ease: "expo.out" })
        .to(q("[data-logo-frame]"), { drawSVG: "100%", duration: 1.0 * speed, ease: "power2.inOut" }, 0.25 * speed)
        .to(q("[data-logo-trace]"), { drawSVG: "100%", duration: 0.8 * speed, ease: "power2.inOut" }, 0.55 * speed)
        .to(q("[data-logo-node]"), { scale: 1, duration: 0.5 * speed, ease: "back.out(3)" }, 1.15 * speed)
        .fromTo(q(".wordmark span"), { yPercent: 110 }, { yPercent: 0, duration: 0.8 * speed, stagger: 0.04, ease: "expo.out" }, 0.9 * speed)
        .fromTo(q(".mote"), { opacity: 0, scale: 0 }, { opacity: (i) => 0.25 + (i % 4) * 0.12, scale: 1, duration: 1.2 * speed, stagger: 0.05, ease: "power2.out" }, 0.4 * speed)
        .to(count, { v: 100, duration: 1.6 * speed, ease: "power2.inOut", onUpdate: () => counter.current && (counter.current.textContent = String(Math.round(count.v)).padStart(2, "0")) }, 0)
        .addLabel("separate", 1.75 * speed)
        .to(q(".mark-top"), { yPercent: -60, opacity: 0, duration: 0.7 * speed, ease: "expo.in" }, "separate")
        .to(q(".mark-bottom"), { yPercent: 60, opacity: 0, duration: 0.7 * speed, ease: "expo.in" }, "separate")
        .to(q(".trace"), { scaleX: 1.6, opacity: 0, duration: 0.6 * speed, ease: "power2.in" }, "separate")
        .to(q(".meta"), { opacity: 0, duration: 0.3 * speed }, "separate")
        .to(root.current, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.95 * speed, ease: "expo.inOut" }, `separate+=${0.35 * speed}`);
      tl.current = t;

      const skip = () => t.timeScale(5);
      window.addEventListener("keydown", skip, { once: true });
      window.addEventListener("pointerdown", skip, { once: true });
      return () => {
        window.removeEventListener("keydown", skip);
        window.removeEventListener("pointerdown", skip);
        document.documentElement.classList.remove("is-loading");
      };
    },
    { scope: root },
  );

  useEffect(() => {
    if (gone) window.dispatchEvent(new Event("resize"));
  }, [gone]);

  if (gone) return null;

  return (
    <div
      ref={root}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${BRAND.name}`}
      className="fixed inset-0 z-(--z-loader) flex items-center justify-center overflow-hidden bg-void"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
    >
      {Array.from({ length: MOTES }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="mote absolute size-[3px] rounded-full bg-bone opacity-0"
          style={{ left: `${12 + ((i * 37) % 76)}%`, top: `${14 + ((i * 53) % 72)}%`, filter: i % 3 === 0 ? "blur(1px)" : undefined }}
        />
      ))}
      <span aria-hidden className="trace absolute left-[8%] right-[8%] top-1/2 h-px origin-center bg-linear-to-r from-transparent via-signal/70 to-transparent opacity-0 shadow-[0_0_24px_rgb(116_216_192/0.6)]" />

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative size-20 text-bone">
          <div className="mark-top absolute inset-0 overflow-hidden [clip-path:inset(0_0_50%_0)]">
            <LogoMark className="size-20" strokeWidth={1.1} />
          </div>
          <div className="mark-bottom absolute inset-0 overflow-hidden [clip-path:inset(50%_0_0_0)]">
            <LogoMark className="size-20" strokeWidth={1.1} />
          </div>
        </div>
        <p className="wordmark meta flex overflow-hidden text-[1.75rem] font-medium lowercase leading-none tracking-[-0.05em] text-bone" aria-hidden>
          {BRAND.name.split("").map((c, i) => (
            <span key={i} className="inline-block">
              {c}
            </span>
          ))}
        </p>
      </div>

      <div className="meta absolute bottom-8 left-(--margin) right-(--margin) flex items-end justify-between">
        <p className="text-label text-graphite-300">{BRAND.product}</p>
        <p className="font-mono text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-none tracking-[-0.04em] text-bone">
          <span ref={counter} className="tabular">
            00
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => tl.current?.timeScale(5)}
        className="meta text-label absolute right-(--margin) top-8 text-graphite-300 transition-colors hover:text-bone"
      >
        Skip intro
      </button>
    </div>
  );
}
