"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/motion/gsap";
import { LABEL_VARIANTS, useCursorStore, type CursorVariant } from "@/stores/cursor";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { usePointerFine } from "@/hooks/use-media";

const RING = 34;
const MAGNET_PULL = 0.28;

interface Shape {
  ring: number;
  ringOpacity: number;
  dot: number;
  dotOpacity: number;
  disc: number;
}

const SHAPES: Record<CursorVariant, Shape> = {
  default: { ring: RING, ringOpacity: 0.5, dot: 5, dotOpacity: 1, disc: 0 },
  link: { ring: 46, ringOpacity: 0.7, dot: 0, dotOpacity: 0, disc: 0 },
  button: { ring: 18, ringOpacity: 0.9, dot: 3, dotOpacity: 1, disc: 0 },
  text: { ring: 0, ringOpacity: 0, dot: 3, dotOpacity: 0.9, disc: 0 },
  hidden: { ring: 0, ringOpacity: 0, dot: 0, dotOpacity: 0, disc: 0 },
  scene: { ring: 26, ringOpacity: 0.55, dot: 2, dotOpacity: 1, disc: 0 },
  view: { ring: 0, ringOpacity: 0, dot: 0, dotOpacity: 0, disc: 92 },
  open: { ring: 0, ringOpacity: 0, dot: 0, dotOpacity: 0, disc: 92 },
  drag: { ring: 0, ringOpacity: 0, dot: 0, dotOpacity: 0, disc: 92 },
  explore: { ring: 0, ringOpacity: 0, dot: 0, dotOpacity: 0, disc: 104 },
  play: { ring: 0, ringOpacity: 0, dot: 0, dotOpacity: 0, disc: 84 },
  next: { ring: 0, ringOpacity: 0, dot: 0, dotOpacity: 0, disc: 84 },
};

function variantFor(target: Element | null): { variant: CursorVariant; label: string | null; image: string | null; magnet: HTMLElement | null } {
  const tagged = target?.closest<HTMLElement>("[data-cursor]");
  const magnet = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
  if (tagged) {
    const variant = tagged.dataset.cursor as CursorVariant;
    return { variant, label: tagged.dataset.cursorLabel ?? (LABEL_VARIANTS.includes(variant) ? variant : null), image: tagged.dataset.cursorImage ?? null, magnet };
  }
  const interactive = target?.closest("a, button, [role='button'], [role='tab'], [role='menuitem'], [role='option'], label, select, summary");
  if (interactive) return { variant: magnet ? "button" : "link", label: null, image: null, magnet };
  if (target?.closest("input, textarea, [contenteditable='true']")) return { variant: "text", label: null, image: null, magnet: null };
  return { variant: "default", label: null, image: null, magnet: null };
}

/**
 * Desktop cursor: precision dot, spring ring, contextual label disc and an ambient spotlight.
 * Disabled for coarse pointers; the native cursor stays for text inputs.
 */
export function Cursor({ spotlight = false }: { spotlight?: boolean }) {
  const fine = usePointerFine();
  const reduced = useReducedMotion();
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const setEnabled = useCursorStore((s) => s.setEnabled);
  const setCursor = useCursorStore((s) => s.set);

  useEffect(() => {
    if (!fine) return;
    const dot = dotRef.current!;
    const ring = ringRef.current!;
    const disc = discRef.current!;
    const glow = glowRef.current;
    document.documentElement.classList.add("has-custom-cursor");
    setEnabled(true);

    const lag = reduced ? 0.001 : 1;
    const dotX = gsap.quickTo(dot, "x", { duration: 0.08 * lag, ease: "power3.out" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08 * lag, ease: "power3.out" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.42 * lag, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.42 * lag, ease: "power3.out" });
    const discX = gsap.quickTo(disc, "x", { duration: 0.5 * lag, ease: "power3.out" });
    const discY = gsap.quickTo(disc, "y", { duration: 0.5 * lag, ease: "power3.out" });
    const glowX = glow ? gsap.quickTo(glow, "x", { duration: 1.4 * lag, ease: "power2.out" }) : null;
    const glowY = glow ? gsap.quickTo(glow, "y", { duration: 1.4 * lag, ease: "power2.out" }) : null;

    let current: CursorVariant = "default";
    let magnet: HTMLElement | null = null;
    let visible = false;

    const apply = (variant: CursorVariant, label: string | null, image: string | null) => {
      const shape = SHAPES[variant] ?? SHAPES.default;
      const d = reduced ? 0 : 0.24;
      gsap.to(ring, { width: shape.ring, height: shape.ring, opacity: visible ? shape.ringOpacity : 0, duration: d, ease: "power3.out", overwrite: "auto" });
      gsap.to(dot, {
        width: variant === "text" ? 2 : shape.dot,
        height: variant === "text" ? 18 : shape.dot,
        opacity: visible ? shape.dotOpacity : 0,
        duration: d * 0.7,
        ease: "power3.out",
        overwrite: "auto",
      });
      gsap.to(disc, { scale: shape.disc ? 1 : 0, width: shape.disc || 92, height: shape.disc || 92, opacity: shape.disc && visible ? 1 : 0, duration: reduced ? 0 : 0.42, ease: "expo.out", overwrite: "auto" });
      ring.dataset.variant = variant;
      if (labelRef.current) labelRef.current.textContent = label ?? "";
      if (imageRef.current) {
        imageRef.current.style.display = image ? "block" : "none";
        if (image) imageRef.current.src = image;
      }
      if (glow) gsap.to(glow, { opacity: shape.disc ? 0.9 : variant === "scene" ? 0.4 : 0.6, duration: 0.8 });
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      if (!visible) {
        visible = true;
        gsap.set([dot, ring, disc], { x: e.clientX, y: e.clientY });
        apply(current, useCursorStore.getState().label, useCursorStore.getState().image);
      }
      dotX(e.clientX);
      dotY(e.clientY);
      discX(e.clientX);
      discY(e.clientY);
      glowX?.(e.clientX);
      glowY?.(e.clientY);
      if (magnet && current === "button") {
        const r = magnet.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        ringX(e.clientX + (cx - e.clientX) * MAGNET_PULL);
        ringY(e.clientY + (cy - e.clientY) * MAGNET_PULL);
      } else {
        ringX(e.clientX);
        ringY(e.clientY);
      }
    };

    const onOver = (e: PointerEvent) => {
      const next = variantFor(e.target as Element);
      magnet = next.magnet;
      if (next.variant === current && next.label === useCursorStore.getState().label) return;
      current = next.variant;
      setCursor(next.variant, next.label, next.image);
      apply(next.variant, next.label, next.image);
    };

    const onDown = () => gsap.to([ring, disc], { scale: (i) => (i === 0 ? 0.82 : SHAPES[current].disc ? 0.92 : 0), duration: 0.16, ease: "power3.out" });
    const onUp = () => gsap.to([ring, disc], { scale: (i) => (i === 0 ? 1 : SHAPES[current].disc ? 1 : 0), duration: 0.4, ease: "elastic.out(1, 0.6)" });
    const onLeave = () => {
      visible = false;
      gsap.to([dot, ring, disc], { opacity: 0, duration: 0.2 });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.classList.remove("has-custom-cursor");
      setEnabled(false);
    };
  }, [fine, reduced, setEnabled, setCursor]);

  if (!fine) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-(--z-cursor)">
      {spotlight && (
        <div
          ref={glowRef}
          className="absolute left-0 top-0 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
          style={{ background: "radial-gradient(circle, rgb(116 216 192 / 0.05), rgb(237 234 228 / 0.02) 35%, transparent 65%)" }}
        />
      )}
      <div
        ref={ringRef}
        className="group absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bone opacity-0 mix-blend-difference data-[variant=scene]:border-signal data-[variant=scene]:mix-blend-normal"
        style={{ width: RING, height: RING }}
      >
        <span className="absolute left-1/2 top-[-5px] h-[4px] w-px -translate-x-1/2 bg-signal opacity-0 group-data-[variant=scene]:opacity-100" />
        <span className="absolute bottom-[-5px] left-1/2 h-[4px] w-px -translate-x-1/2 bg-signal opacity-0 group-data-[variant=scene]:opacity-100" />
        <span className="absolute left-[-5px] top-1/2 h-px w-[4px] -translate-y-1/2 bg-signal opacity-0 group-data-[variant=scene]:opacity-100" />
        <span className="absolute right-[-5px] top-1/2 h-px w-[4px] -translate-y-1/2 bg-signal opacity-0 group-data-[variant=scene]:opacity-100" />
      </div>
      <div ref={dotRef} className="absolute left-0 top-0 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bone opacity-0 mix-blend-difference" />
      <div
        ref={discRef}
        className="absolute left-0 top-0 flex size-[92px] -translate-x-1/2 -translate-y-1/2 scale-0 items-center justify-center overflow-hidden rounded-full bg-bone text-graphite-950 opacity-0 shadow-e3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative preview, src set imperatively */}
        <img ref={imageRef} alt="" className="absolute inset-0 hidden size-full object-cover opacity-90" />
        <span ref={labelRef} className="relative font-mono text-[10px] font-medium uppercase tracking-[0.18em]" />
      </div>
    </div>
  );
}
