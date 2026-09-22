export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const mapRange = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
  outMin + ((clamp(value, inMin, inMax) - inMin) / (inMax - inMin || 1)) * (outMax - outMin);

/** Frame-rate independent damping toward a target. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Deterministic 32-bit hash of a string. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 seeded PRNG. Same seed, same sequence. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in [-1, 1] for a key and a continuous coordinate. */
export function valueNoise(key: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const r = (n: number) => {
    const s = Math.sin((n + key * 0.618) * 127.1 + key * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  return lerp(r(i), r(i + 1), u);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function round(value: number, digits = 0) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
