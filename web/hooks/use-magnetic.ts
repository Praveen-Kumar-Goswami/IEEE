"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "@/lib/motion/gsap";
import { useReducedMotion } from "./use-reduced-motion";

interface MagneticOptions {
  /** Fraction of the pointer offset the element follows. */
  strength?: number;
  /** Inner content moves further, giving a sense of depth. */
  innerStrength?: number;
  /** Extra hit area around the element, in px. */
  radius?: number;
}

/**
 * Pulls an element toward the pointer while it is within `radius`. Uses gsap.quickTo so
 * every frame is a transform write, never a layout read after the initial rect.
 */
export function useMagnetic<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { strength = 0.32, innerStrength = 0.18, radius = 28 }: MagneticOptions = {},
  innerRef?: RefObject<HTMLElement | null>,
) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
    const inner = innerRef?.current;
    const ix = inner ? gsap.quickTo(inner, "x", { duration: 0.6, ease: "power3.out" }) : null;
    const iy = inner ? gsap.quickTo(inner, "y", { duration: 0.6, ease: "power3.out" }) : null;
    let rect = el.getBoundingClientRect();
    let active = false;

    const measure = () => {
      gsap.set(el, { x: 0, y: 0 });
      rect = el.getBoundingClientRect();
    };

    const onMove = (e: PointerEvent) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const within = Math.abs(dx) < rect.width / 2 + radius && Math.abs(dy) < rect.height / 2 + radius;
      if (within) {
        active = true;
        x(dx * strength);
        y(dy * strength);
        ix?.(dx * innerStrength);
        iy?.(dy * innerStrength);
      } else if (active) {
        active = false;
        x(0);
        y(0);
        ix?.(0);
        iy?.(0);
      }
    };

    const onEnter = () => measure();
    el.addEventListener("pointerenter", onEnter);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      gsap.set([el, inner].filter(Boolean), { x: 0, y: 0 });
    };
  }, [ref, innerRef, strength, innerStrength, radius, reduced]);
}
