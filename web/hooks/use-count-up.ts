"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Animates from the previous value to `target`. The first run starts from zero so KPIs
 * count up on arrival; later changes (realtime) roll from the old value.
 */
export function useCountUp(target: number, { durationMs = 1300, decimals = 0, enabled = true } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(enabled && !reduced ? 0 : target);
  const from = useRef(enabled && !reduced ? 0 : target);

  useEffect(() => {
    if (!enabled) return;
    if (reduced) {
      from.current = target;
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = origin + (target - origin) * easeOutExpo(t);
      setValue(Number(next.toFixed(decimals)));
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, durationMs, decimals, enabled, reduced]);

  return value;
}
