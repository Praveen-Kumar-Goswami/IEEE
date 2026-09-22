"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { useInView } from "@/hooks/use-in-view";
import { useDeviceTier, type TierConfig } from "@/hooks/use-device-tier";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SceneGateProps {
  className?: string;
  /** Renders the canvas. `active` is false while offscreen so the frame loop can stop. */
  children: (props: { tier: TierConfig; active: boolean; reduced: boolean; onReady: () => void }) => ReactNode;
  /** Composition shown before the canvas is ready, and permanently without WebGL. */
  fallback: ReactNode;
  cursor?: "scene" | "drag" | "explore";
  cursorLabel?: string;
}

/**
 * Mounts a 3D scene when it nears the viewport, pauses it when it leaves, and
 * crossfades from the SVG fallback once the first frame is drawn.
 */
export function SceneGate({ className, children, fallback, cursor = "scene", cursorLabel }: SceneGateProps) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { margin: "400px", once: true });
  const visible = useInView(ref, { margin: "80px" });
  const tier = useDeviceTier();
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const webgl = tier.tier !== "none";

  return (
    <div ref={ref} className={cn("relative", className)} data-cursor={cursor} data-cursor-label={cursorLabel}>
      <div className={cn("absolute inset-0 transition-opacity duration-(--dur-cine) ease-(--ease-in-out-cine)", ready && webgl ? "opacity-0" : "opacity-100")}>{fallback}</div>
      {webgl && near && (
        <div className={cn("absolute inset-0 transition-opacity duration-(--dur-cine) ease-(--ease-in-out-cine)", ready ? "opacity-100" : "opacity-0")}>
          {children({ tier, active: visible, reduced, onReady: () => setReady(true) })}
        </div>
      )}
    </div>
  );
}
