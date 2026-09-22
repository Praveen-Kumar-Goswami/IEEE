import { describe, expect, it } from "vitest";
import { parseWith, syncEnvelopeSchema } from "../src/domain/schemas.js";
import { classifyReadings, type SessionSnapshot } from "../src/domain/sync.js";

const now = new Date("2026-09-22T16:00:00.000Z");
const session: SessionSnapshot = {
  id: "77777777-7777-4777-8777-777777777777",
  patientId: "44444444-4444-4444-8444-444444444444",
  deviceId: "55555555-5555-4555-8555-555555555555",
  status: "active",
  startedAt: "2026-09-22T12:00:00.000Z",
  endedAt: null,
};

function reading(overrides: Record<string, unknown> = {}) {
  return {
    client_reading_id: "b1111111-1111-4111-8111-111111111201",
    sequence: 120,
    captured_at: "2026-09-22T15:00:00.000Z",
    localized_temperature_c: 36.8,
    ambient_temperature_c: 28.2,
    humidity_percent: 65.4,
    relative_moisture_value: 412,
    device_status: "connected",
    ...overrides,
  };
}

describe("payload validation", () => {
  it("rejects an empty or oversized sync envelope", () => {
    expect(parseWith(syncEnvelopeSchema, { session_id: session.id, readings: [] }).ok).toBe(false);
    expect(parseWith(syncEnvelopeSchema, { session_id: session.id, device_serial: "ESP32-001", readings: [] }).ok).toBe(false);
    const tooMany = parseWith(syncEnvelopeSchema, {
      session_id: session.id,
      device_serial: "ESP32-001",
      readings: Array.from({ length: 101 }, () => ({})),
    });
    expect(tooMany.ok).toBe(false);
  });

  it("accepts an in-range BLE sample and rejects a moisture count above the ADC range", () => {
    const classified = classifyReadings(
      [reading(), reading({ client_reading_id: "b1111111-1111-4111-8111-111111111202", relative_moisture_value: 5000 })],
      session,
      now,
    );
    expect(classified[0]?.kind).toBe("ready");
    expect(classified[1]).toMatchObject({ kind: "failed", reason: "invalid reading" });
  });

  it("treats a repeated client id in one batch as skipped", () => {
    const classified = classifyReadings([reading(), reading()], session, now);
    expect(classified.map((item) => item.kind)).toEqual(["ready", "skipped"]);
  });

  it("rejects samples outside the session and offline window", () => {
    const early = classifyReadings([reading({ captured_at: "2026-09-22T11:00:00.000Z" })], session, now);
    expect(early[0]).toMatchObject({ reason: "captured_at is before the monitoring session" });
    const future = classifyReadings([reading({ captured_at: "2026-09-22T16:10:00.000Z" })], session, now);
    expect(future[0]).toMatchObject({ reason: "captured_at is too far in the future" });
  });
});
