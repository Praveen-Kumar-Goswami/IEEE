import type { ReadingSample } from "@/types/domain";
import { clamp, round, valueNoise } from "@/utils/math";

export const SECOND = 1_000;
export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export type Metric = "temp" | "humidity" | "moisture";

/** A predefined change introduced during testing, as in the problem statement. */
export interface Overlay {
  metric: Metric;
  startMs: number;
  rampMs: number;
  delta: number;
  endMs?: number;
}

export interface SignalProfile {
  key: number;
  baseTemp: number;
  baseAmbient: number;
  baseHumidity: number;
  baseMoisture: number;
  noiseScale: number;
  admittedAt: number;
  sessionStart: number;
  batteryDrainPerHour: number;
  overlays: Overlay[];
  offline: { from: number; to: number | null }[];
}

const smoothstep = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

function overlayFactor(o: Overlay, t: number) {
  const rise = smoothstep((t - o.startMs) / o.rampMs);
  if (o.endMs == null || t < o.endMs) return rise;
  return rise * (1 - smoothstep((t - o.endMs) / o.rampMs));
}

export function isOffline(p: SignalProfile, t: number) {
  return p.offline.some((w) => t >= w.from && (w.to == null || t < w.to));
}

/** Deterministic sample for a simulated dressing at time t, or null when nothing was captured. */
export function sampleAt(p: SignalProfile, t: number): ReadingSample | null {
  if (t < p.admittedAt || isOffline(p, t)) return null;

  const k = p.key;
  const n = p.noiseScale;
  const daily = Math.sin((2 * Math.PI * (t % DAY)) / DAY - 1.2);

  let temp = p.baseTemp + n * (0.14 * valueNoise(k, t / (25 * MINUTE)) + 0.05 * valueNoise(k + 7, t / (2 * MINUTE))) + 0.12 * daily;
  const ambient = p.baseAmbient + 0.5 * valueNoise(k + 13, t / (40 * MINUTE)) + 0.9 * daily;
  let humidity =
    p.baseHumidity + n * (2.4 * valueNoise(k + 19, t / (30 * MINUTE)) + 0.6 * valueNoise(k + 23, t / (3 * MINUTE))) - 1.5 * daily;
  let moisture = p.baseMoisture + n * (16 * valueNoise(k + 29, t / (35 * MINUTE)) + 5 * valueNoise(k + 31, t / (2 * MINUTE)));

  for (const o of p.overlays) {
    const f = overlayFactor(o, t);
    if (f <= 0) continue;
    if (o.metric === "temp") temp += o.delta * f;
    else if (o.metric === "humidity") humidity += o.delta * f;
    else moisture += o.delta * f;
  }

  const sessionStart = Math.max(p.sessionStart, p.admittedAt);
  const hoursOn = Math.max(0, t - sessionStart) / HOUR;
  const battery = clamp(98 - hoursOn * p.batteryDrainPerHour + 0.6 * valueNoise(k + 41, t / HOUR), 3, 100);

  return {
    capturedAt: new Date(t).toISOString(),
    localizedTemperatureC: round(clamp(temp, -55, 125), 2),
    ambientTemperatureC: round(clamp(ambient, -40, 85), 2),
    humidityPercent: round(clamp(humidity, 0, 100), 1),
    relativeMoistureValue: Math.round(clamp(moisture, 0, 4095)),
    batteryPercent: round(battery, 0),
    deviceStatus: "connected",
  };
}

/** Most recent captured sample at or before t, searching back in steps. */
export function latestSample(p: SignalProfile, t: number, stepMs = 30 * SECOND, maxBackMs = 7 * DAY): ReadingSample | null {
  for (let at = t; at >= t - maxBackMs && at >= p.admittedAt; at -= stepMs) {
    const s = sampleAt(p, at);
    if (s) return s;
    if (stepMs < 5 * MINUTE && t - at > HOUR) stepMs = 5 * MINUTE;
  }
  return null;
}

/** Mean localized temperature of the current session before t (backend baseline rule). */
export function sessionBaseline(p: SignalProfile, t: number, stepMs = 5 * MINUTE): number | null {
  let sum = 0;
  let count = 0;
  for (let at = Math.max(p.sessionStart, p.admittedAt); at < t; at += stepMs) {
    const s = sampleAt(p, at);
    if (s?.localizedTemperatureC != null) {
      sum += s.localizedTemperatureC;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}
