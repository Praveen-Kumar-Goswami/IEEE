"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const GRAIN_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
  );

interface AtmosphereProps {
  variant?: "landing" | "workspace" | "auth";
}

/**
 * Film grain, two slow light fields and, on the landing page, a sparse dust layer.
 * Fixed behind content with pointer-events disabled.
 */
export function Atmosphere({ variant = "landing" }: AtmosphereProps) {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {variant !== "workspace" && (
        <>
          <div
            className="absolute -left-[20vw] -top-[30vh] size-[80vw] rounded-full opacity-60 blur-3xl motion-safe:animate-[drift_38s_var(--ease-in-out-cine)_infinite]"
            style={{ background: "radial-gradient(circle, rgb(116 216 192 / 0.05), transparent 60%)" }}
          />
          <div
            className="absolute -bottom-[40vh] -right-[25vw] size-[90vw] rounded-full opacity-50 blur-3xl motion-safe:animate-[drift_52s_var(--ease-in-out-cine)_infinite_reverse]"
            style={{ background: "radial-gradient(circle, rgb(201 139 91 / 0.035), transparent 60%)" }}
          />
        </>
      )}
      {variant === "workspace" && (
        <div className="absolute inset-x-0 top-0 h-[50vh]" style={{ background: "radial-gradient(ellipse 60% 100% at 20% 0%, rgb(116 216 192 / 0.03), transparent 70%)" }} />
      )}
      {variant === "landing" && !reduced && <Dust />}
      <div
        className={cn(
          "absolute -inset-[10%] z-(--z-grain) mix-blend-overlay",
          variant === "workspace" ? "opacity-[0.035]" : "opacity-[0.07]",
          !reduced && "animate-[grain-shift_1.2s_steps(6)_infinite]",
        )}
        style={{ backgroundImage: `url("${GRAIN_SVG}")` }}
      />
    </div>
  );
}

const DUST_COUNT = 38;

/** A 2D canvas of slow motes. Pauses with the tab and when the page is scrolled far away. */
function Dust() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const count = window.innerWidth < 768 ? Math.round(DUST_COUNT / 3) : DUST_COUNT;
    const motes = Array.from({ length: count }, (_, i) => ({
      x: ((i * 7919) % 1000) / 1000,
      y: ((i * 104729) % 1000) / 1000,
      r: 0.4 + ((i * 31) % 10) / 10,
      speed: 0.004 + ((i * 17) % 10) / 2600,
      phase: i,
    }));
    let raf = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.speed * dt;
        if (m.y < -0.02) m.y = 1.02;
        const x = (m.x + Math.sin(now / 9000 + m.phase) * 0.012) * w;
        const alpha = 0.18 + Math.sin(now / 2400 + m.phase) * 0.1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(237, 234, 228, ${alpha})`;
        ctx.arc(x, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(draw);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 size-full opacity-70" />;
}
