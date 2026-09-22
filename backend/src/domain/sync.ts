import { LIMITS } from "./limits.js";
import { readLooseClientId, readingSchema } from "./schemas.js";

export type SessionSnapshot = {
  id: string;
  patientId: string;
  deviceId: string;
  status: "active" | "paused" | "completed";
  startedAt: string;
  endedAt: string | null;
};

export type NormalizedReading = {
  clientReadingId: string;
  sequenceNumber: number | null;
  capturedAt: string;
  localizedTemperatureC: number | null;
  ambientTemperatureC: number | null;
  humidityPercent: number | null;
  relativeMoistureValue: number | null;
  batteryPercent: number | null;
  deviceStatus: "normal" | "connected" | "watch" | "attention" | "offline" | "syncing";
};

export type ClassifiedReading =
  | { kind: "ready"; reading: NormalizedReading }
  | { kind: "failed"; id: string | null; reason: string }
  | { kind: "skipped"; id: string; reason: string };

export type StoredOutcome = {
  id: string | null;
  outcome: "uploaded" | "skipped" | "failed";
  reason: string | null;
  serverId?: string;
};

function timeProblem(capturedAt: string, session: SessionSnapshot, now: Date): string | null {
  const captured = Date.parse(capturedAt);
  const started = Date.parse(session.startedAt);
  if (Number.isNaN(captured) || Number.isNaN(started)) return "captured_at is invalid.";
  if (captured < started - LIMITS.sessionSkewMs) return "captured_at is before the monitoring session";
  if (session.endedAt) {
    const ended = Date.parse(session.endedAt);
    if (!Number.isNaN(ended) && captured > ended + LIMITS.sessionSkewMs) {
      return "captured_at is after the monitoring session ended";
    }
  }
  if (captured > now.getTime() + LIMITS.futureSkewMs) return "captured_at is too far in the future";
  if (captured < now.getTime() - LIMITS.offlineWindowMs) return "captured_at is outside the offline upload window";
  return null;
}

export function classifyReadings(items: unknown[], session: SessionSnapshot, now: Date): ClassifiedReading[] {
  const seen = new Set<string>();
  const results: ClassifiedReading[] = [];
  for (const item of items) {
    const parsed = readingSchema.safeParse(item);
    if (!parsed.success) {
      results.push({ kind: "failed", id: readLooseClientId(item), reason: "invalid reading" });
      continue;
    }
    const id = parsed.data.client_reading_id;
    if (seen.has(id)) {
      results.push({ kind: "skipped", id, reason: "duplicate client_reading_id in this batch" });
      continue;
    }
    const reading: NormalizedReading = {
      clientReadingId: id,
      sequenceNumber: parsed.data.sequence ?? null,
      capturedAt: parsed.data.captured_at,
      localizedTemperatureC: parsed.data.localized_temperature_c ?? null,
      ambientTemperatureC: parsed.data.ambient_temperature_c ?? null,
      humidityPercent: parsed.data.humidity_percent ?? null,
      relativeMoistureValue: parsed.data.relative_moisture_value ?? null,
      batteryPercent: parsed.data.battery_percent ?? null,
      deviceStatus: parsed.data.device_status,
    };
    const present = [
      reading.localizedTemperatureC,
      reading.ambientTemperatureC,
      reading.humidityPercent,
      reading.relativeMoistureValue,
    ].filter((value) => value != null).length;
    if (present === 0) {
      seen.add(id);
      results.push({ kind: "failed", id, reason: "A reading needs at least one measurement." });
      continue;
    }
    const problem = timeProblem(reading.capturedAt, session, now);
    if (problem) {
      seen.add(id);
      results.push({ kind: "failed", id, reason: problem });
      continue;
    }
    seen.add(id);
    results.push({ kind: "ready", reading });
  }
  return results;
}

export function mergeOutcomes(classified: ClassifiedReading[], stored: StoredOutcome[]): StoredOutcome[] {
  const byId = new Map(stored.map((row) => [row.id, row]));
  return classified.map((item) => {
    if (item.kind === "ready") {
      return byId.get(item.reading.clientReadingId) ?? {
        id: item.reading.clientReadingId,
        outcome: "failed" as const,
        reason: "reading was not stored",
      };
    }
    if (item.kind === "skipped") return { id: item.id, outcome: "skipped" as const, reason: item.reason };
    return { id: item.id, outcome: "failed" as const, reason: item.reason };
  });
}
