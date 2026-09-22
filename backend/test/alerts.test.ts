import { describe, expect, it } from "vitest";
import { evaluateNewAlerts, type AlertRule, type Sample } from "../src/domain/alerts.js";

const patientId = "44444444-4444-4444-8444-444444444444";
const deviceId = "55555555-5555-4555-8555-555555555555";
const sessionId = "77777777-7777-4777-8777-777777777777";
const rule: AlertRule = {
  id: "a1111111-1111-4111-8111-111111111111",
  scope: "global",
  patientId: null,
  deviceId: null,
  temperatureDeltaThreshold: 1,
  humidityThreshold: 80,
  moistureThreshold: 350,
  enabled: true,
};

function sample(partial: Partial<Sample> & Pick<Sample, "id" | "capturedAt">): Sample {
  return {
    clientReadingId: partial.id,
    localizedTemperatureC: 36.6,
    ambientTemperatureC: 28.2,
    humidityPercent: 60,
    relativeMoistureValue: 180,
    deviceStatus: "connected",
    ...partial,
  };
}

const now = new Date("2026-09-22T15:10:00.000Z");

describe("alert generation", () => {
  it("compares localized temperature with the rolling baseline and avoids diagnosis language", () => {
    const drafts = evaluateNewAlerts({
      rules: [rule],
      patientId,
      deviceId,
      sessionId,
      history: [sample({ id: "reading-1", capturedAt: new Date("2026-09-22T14:00:00.000Z"), localizedTemperatureC: 36.6 })],
      accepted: [sample({ id: "reading-2", capturedAt: new Date("2026-09-22T15:00:00.000Z"), localizedTemperatureC: 37.9, relativeMoistureValue: 412 })],
      activeKeys: new Set(),
      now,
      syncDelayMs: 30 * 60 * 1000,
    });
    const types = drafts.map((draft) => draft.alertType).sort();
    expect(types).toEqual(["elevated_temperature", "moisture_change"]);
    for (const draft of drafts) {
      expect(draft.message).toMatch(/monitoring indicator/i);
      expect(draft.message).not.toMatch(/infection detected/i);
      expect(draft.message).not.toMatch(/diagnosed/i);
    }
    expect(drafts.find((draft) => draft.alertType === "elevated_temperature")?.message).toMatch(/baseline/);
    expect(drafts.find((draft) => draft.alertType === "moisture_change")?.severity).toBe("attention");
  });

  it("does not open a second indicator while one is still open", () => {
    const drafts = evaluateNewAlerts({
      rules: [rule],
      patientId,
      deviceId,
      sessionId,
      history: [sample({ id: "reading-1", capturedAt: new Date("2026-09-22T14:00:00.000Z") })],
      accepted: [sample({ id: "reading-2", capturedAt: new Date("2026-09-22T15:00:00.000Z"), localizedTemperatureC: 38 })],
      activeKeys: new Set([`${rule.id}:elevated_temperature`]),
      now,
      syncDelayMs: 30 * 60 * 1000,
    });
    expect(drafts.map((draft) => draft.alertType)).not.toContain("elevated_temperature");
  });

  it("flags a delayed offline upload without calling it an infection", () => {
    const drafts = evaluateNewAlerts({
      rules: [],
      patientId,
      deviceId,
      sessionId,
      history: [],
      accepted: [sample({
        id: "reading-old",
        capturedAt: new Date("2026-09-22T14:00:00.000Z"),
        deviceStatus: "offline",
      })],
      activeKeys: new Set(),
      now,
      syncDelayMs: 30 * 60 * 1000,
    });
    expect(drafts.map((draft) => draft.alertType).sort()).toEqual(["device_offline", "sync_issue"]);
    expect(drafts.find((draft) => draft.alertType === "sync_issue")?.message).toMatch(/has not synchronized recently/);
  });

  it("lets a patient rule replace the global rule", () => {
    const patientRule: AlertRule = { ...rule, id: "patient-rule", scope: "patient", patientId, moistureThreshold: 2000 };
    const drafts = evaluateNewAlerts({
      rules: [rule, patientRule],
      patientId,
      deviceId,
      sessionId,
      history: [],
      accepted: [sample({ id: "reading-2", capturedAt: now, relativeMoistureValue: 412 })],
      activeKeys: new Set(),
      now,
      syncDelayMs: 30 * 60 * 1000,
    });
    expect(drafts).toEqual([]);
  });
});
