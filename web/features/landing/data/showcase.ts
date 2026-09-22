import type { ReadingSample } from "@/types/domain";
import { GLOBAL_THRESHOLDS } from "@/lib/domain/rules";
import { MINUTE, SECOND, sampleAt, type SignalProfile } from "@/services/data/demo/signal";

/**
 * The landing monitor replays the demo signal model at 30x: one real second is
 * 30 seconds of dressing time. Each 40-minute cycle contains one scripted localized
 * temperature rise, so visitors see an indicator open and settle, as in testing.
 */
export const SHOWCASE = {
  speed: 30,
  sampleEveryMs: 30 * SECOND,
  windowMs: 30 * MINUTE,
  cycleMs: 40 * MINUTE,
  riseStartMs: 18 * MINUTE,
  riseRampMs: 4 * MINUTE,
  riseEndMs: 31 * MINUTE,
  riseDelta: 1.45,
  patient: "Patient 12 · Simulated dressing, left forearm",
  device: "ESP32-001",
} as const;

const BASE: Omit<SignalProfile, "overlays"> = {
  key: 12,
  baseTemp: 36.62,
  baseAmbient: 27.4,
  baseHumidity: 63.5,
  baseMoisture: 286,
  noiseScale: 0.8,
  admittedAt: 0,
  sessionStart: 0,
  batteryDrainPerHour: 0.5,
  offline: [],
};

const EPOCH = Date.UTC(2026, 8, 22, 6, 0, 0);

function profileFor(t: number): SignalProfile {
  const cycleStart = t - (((t - EPOCH) % SHOWCASE.cycleMs) + SHOWCASE.cycleMs) % SHOWCASE.cycleMs;
  const overlays = [-1, 0].map((k) => {
    const start = cycleStart + k * SHOWCASE.cycleMs;
    return [
      { metric: "temp" as const, startMs: start + SHOWCASE.riseStartMs, rampMs: SHOWCASE.riseRampMs, delta: SHOWCASE.riseDelta, endMs: start + SHOWCASE.riseEndMs },
      { metric: "moisture" as const, startMs: start + SHOWCASE.riseStartMs + 2 * MINUTE, rampMs: 6 * MINUTE, delta: 38, endMs: start + SHOWCASE.riseEndMs },
    ];
  });
  return { ...BASE, admittedAt: EPOCH, sessionStart: EPOCH, overlays: overlays.flat() };
}

/** Dressing time for a wall-clock instant. */
export const showcaseTime = (wallMs: number) => EPOCH + (wallMs - EPOCH) * SHOWCASE.speed;

export function showcaseSample(t: number): ReadingSample {
  return sampleAt(profileFor(t), t)!;
}

export const SHOWCASE_BASELINE = BASE.baseTemp;
export const SHOWCASE_THRESHOLD = BASE.baseTemp + GLOBAL_THRESHOLDS.temperatureDelta;

export interface ShowcaseEvent {
  t: number;
  kind: "opened" | "notified" | "acknowledged" | "settled";
  label: string;
}

/** The scripted indicator lifecycle of the cycle containing t, limited to what has happened by t. */
export function showcaseEvents(t: number): ShowcaseEvent[] {
  const cycleStart = t - ((((t - EPOCH) % SHOWCASE.cycleMs) + SHOWCASE.cycleMs) % SHOWCASE.cycleMs);
  let opened: number | null = null;
  let settled: number | null = null;
  for (let at = cycleStart + SHOWCASE.riseStartMs; at <= cycleStart + SHOWCASE.cycleMs; at += SHOWCASE.sampleEveryMs) {
    const temp = showcaseSample(at).localizedTemperatureC ?? 0;
    if (opened == null && temp >= SHOWCASE_THRESHOLD) opened = at;
    if (opened != null && at > opened && temp < SHOWCASE_THRESHOLD - 0.15) {
      settled = at;
      break;
    }
  }
  if (opened == null) return [];
  const events: ShowcaseEvent[] = [
    { t: opened, kind: "opened", label: "Indicator opened · localized temperature" },
    { t: opened + 20 * SECOND, kind: "notified", label: "Assigned nurse notified" },
    { t: opened + 2 * MINUTE + 10 * SECOND, kind: "acknowledged", label: "Acknowledged · bedside check started" },
  ];
  if (settled != null) events.push({ t: settled, kind: "settled", label: "Reading returned within threshold" });
  return events.filter((e) => e.t <= t);
}

/** Samples across the visible window ending at t. */
export function showcaseWindow(t: number, points = SHOWCASE.windowMs / SHOWCASE.sampleEveryMs) {
  const end = t - (t % SHOWCASE.sampleEveryMs);
  return Array.from({ length: points }, (_, i) => {
    const at = end - (points - 1 - i) * SHOWCASE.sampleEveryMs;
    return { t: at, sample: showcaseSample(at) };
  });
}
