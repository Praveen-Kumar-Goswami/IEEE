"use client";

import { useEffect } from "react";
import { selectReduced, useMotionStore } from "@/stores/motion";
import { gsap } from "@/lib/motion/gsap";

/** Mirrors the effective motion preference onto <html> and into GSAP's global timeline. */
export function MotionPreference() {
  const setSystemReduced = useMotionStore((s) => s.setSystemReduced);
  const reduced = useMotionStore(selectReduced);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduced(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [setSystemReduced]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduced-motion", reduced);
    gsap.globalTimeline.timeScale(reduced ? 20 : 1);
  }, [reduced]);

  return null;
}
