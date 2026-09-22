/**
 * Three motion tiers. Values are seconds (GSAP and Motion both take seconds).
 * Micro: feedback. Standard: component state. Cinematic: storytelling.
 */
export const DURATION = {
  microFast: 0.12,
  micro: 0.18,
  microSlow: 0.24,
  standardFast: 0.32,
  standard: 0.48,
  standardSlow: 0.68,
  cineFast: 0.9,
  cine: 1.3,
  cineSlow: 1.7,
} as const;

/** GSAP ease names matched to the CSS curves. */
export const EASE = {
  out: "power4.out",
  outExpo: "expo.out",
  inOut: "power3.inOut",
  cine: "expo.inOut",
  in: "power3.in",
  none: "none",
} as const;

/** Cubic-bezier arrays for Motion (framer). */
export const BEZIER = {
  outQuart: [0.25, 1, 0.5, 1],
  outExpo: [0.16, 1, 0.3, 1],
  inOutCine: [0.65, 0, 0.35, 1],
  inQuart: [0.5, 0, 0.75, 0],
} as const satisfies Record<string, [number, number, number, number]>;

export const SPRING = {
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.8 },
  soft: { type: "spring", stiffness: 260, damping: 30, mass: 1 },
  toggle: { type: "spring", stiffness: 700, damping: 34 },
} as const;

export const STAGGER = {
  chars: 0.022,
  words: 0.06,
  items: 0.08,
} as const;
