"use client";

import { useSyncExternalStore } from "react";

export type DeviceTier = "high" | "medium" | "low" | "none";

export interface TierConfig {
  tier: DeviceTier;
  dpr: [number, number];
  particles: number;
  bloom: boolean;
  transmission: boolean;
  shadows: boolean;
}

const CONFIG: Record<DeviceTier, Omit<TierConfig, "tier">> = {
  high: { dpr: [1, 1.75], particles: 1, bloom: true, transmission: true, shadows: true },
  medium: { dpr: [1, 1.5], particles: 0.6, bloom: true, transmission: false, shadows: true },
  low: { dpr: [1, 1.25], particles: 0.25, bloom: false, transmission: false, shadows: false },
  none: { dpr: [1, 1], particles: 0, bloom: false, transmission: false, shadows: false },
};

let cached: DeviceTier | null = null;

function detect(): DeviceTier {
  if (cached) return cached;
  let tier: DeviceTier = "high";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) {
      cached = "none";
      return cached;
    }
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = "none";
    return cached;
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = window.innerWidth < 768;
  if (coarse || small) tier = "low";
  else if (cores <= 4 || memory <= 4) tier = "medium";
  cached = tier;
  return tier;
}

const noop = () => () => {};

/** Picks particle counts, DPR and post effects. "none" means no WebGL: render the SVG fallback. */
export function useDeviceTier(): TierConfig {
  const tier = useSyncExternalStore(noop, detect, () => "medium" as DeviceTier);
  return { tier, ...CONFIG[tier] };
}
