import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { MemoryDatabase } from "../src/data/memory-database.js";
import type { Actor } from "../src/domain/authz.js";
import type { HttpRequest } from "../src/http.js";
import { silentLogger } from "../src/logger.js";

const now = new Date("2026-09-22T15:10:00.000Z");
const patientId = "44444444-4444-4444-8444-444444444444";
const nurseId = "33333333-3333-4333-8333-333333333333";
const adminId = "11111111-1111-4111-8111-111111111111";
const deviceId = "55555555-5555-4555-8555-555555555555";
const sessionId = "77777777-7777-4777-8777-777777777777";

function actor(partial: Partial<Actor> & Pick<Actor, "id" | "role">): Actor {
  return { fullName: "Demo", ...partial };
}

function build() {
  const db = new MemoryDatabase();
  db.profiles.set(patientId, { ...actor({ id: patientId, role: "patient", fullName: "Amina Rahman" }), monitoringStatus: "normal" });
  db.profiles.set(nurseId, { ...actor({ id: nurseId, role: "nurse", fullName: "Marcus Adeyemi" }), monitoringStatus: "normal" });
  db.profiles.set(adminId, { ...actor({ id: adminId, role: "admin", fullName: "Priya Nair" }), monitoringStatus: "normal" });
  db.devices.push({
    id: deviceId,
    serialNumber: "ESP32-001",
    deviceName: "Forearm dressing monitor",
    patientId,
    firmwareVersion: "0.1.0",
    pairingStatus: "paired",
    lastSeenAt: null,
  });
  db.sessions.set(sessionId, {
    id: sessionId,
    patientId,
    deviceId,
    startedAt: "2026-09-22T12:00:00.000Z",
    endedAt: null,
    status: "active",
    simulatedWoundLabel: "Simulated dressing, left forearm",
    notes: null,
  });
  db.rules.push({
    id: "a1111111-1111-4111-8111-111111111111",
    scope: "global",
    patientId: null,
    deviceId: null,
    temperatureDeltaThreshold: 1,
    humidityThreshold: 80,
    moistureThreshold: 350,
    enabled: true,
  });
  const tokens = new Map<string, Actor>([
    ["patient-token", actor({ id: patientId, role: "patient", fullName: "Amina Rahman" })],
    ["nurse-token", actor({ id: nurseId, role: "nurse", fullName: "Marcus Adeyemi" })],
    ["admin-token", actor({ id: adminId, role: "admin", fullName: "Priya Nair" })],
  ]);
  const app = createApp({
    db,
    logger: silentLogger,
    now: () => now,
    corsAllowedOrigins: ["https://staff.example"],
    authenticate: async (token) => tokens.get(token) ?? null,
  });
  return { app, db };
}

async function call(app: ReturnType<typeof createApp>, input: { method: string; path: string; token?: string; body?: unknown; origin?: string }) {
  const request: HttpRequest = {
    method: input.method,
    path: input.path,
    headers: {
      ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
      ...(input.origin ? { origin: input.origin } : {}),
    },
    query: {},
    bodyText: input.body === undefined ? null : JSON.stringify(input.body),
    requestId: "req-test-1234",
  };
  const response = await app(request);
  return { status: response.status, headers: response.headers, body: response.body as Record<string, any> };
}

function reading(id: string, sequence: number, temperature: number, moisture: number) {
  return {
    client_reading_id: id,
    sequence,
    captured_at: "2026-09-22T15:00:00.000Z",
    localized_temperature_c: temperature,
    ambient_temperature_c: 28.2,
    humidity_percent: 65.4,
    relative_moisture_value: moisture,
    device_status: "connected",
  };
}

describe("HTTP API", () => {
  it("serves health without credentials", async () => {
    const { app } = build();
    const health = await call(app, { method: "GET", path: "/health" });
    expect(health.status).toBe(200);
    const missing = await call(app, { method: "GET", path: "/v1/patients/me/summary" });
    expect(missing.status).toBe(401);
    expect(missing.body.error.request_id).toBe("req-test-1234");
  });

  it("uploads a reading once, creates a moisture indicator, and skips the retry", async () => {
    const { app, db } = build();
    const body = {
      device_serial: "ESP32-001",
      session_id: sessionId,
      readings: [
        reading("b1111111-1111-4111-8111-111111111201", 101, 36.6, 180),
        reading("b1111111-1111-4111-8111-111111111202", 120, 36.8, 412),
      ],
    };
    const first = await call(app, { method: "POST", path: "/v1/mobile/sync/readings", token: "patient-token", body });
    expect(first.status).toBe(200);
    expect(first.body.uploaded).toHaveLength(2);
    expect(first.body.alerts_created).toBe(1);
    expect(db.readings[1]?.relativeMoistureValue).toBe(412);
    expect(db.alerts[0]?.message).toMatch(/Relative moisture indicator/);
    expect(db.alerts[0]?.message).not.toMatch(/infection detected/i);

    const retry = await call(app, {
      method: "POST",
      path: "/v1/mobile/sync/readings",
      token: "patient-token",
      body: { ...body, readings: [reading("b1111111-1111-4111-8111-111111111202", 120, 50, 10)] },
    });
    expect(retry.body.skipped).toEqual(["b1111111-1111-4111-8111-111111111202"]);
    expect(retry.body.uploaded).toEqual([]);
    expect(db.readings.find((row) => row.clientReadingId.endsWith("202"))?.localizedTemperatureC).toBe(36.8);
    expect(db.alerts).toHaveLength(1);
  });

  it("hides another session and blocks a nurse from uploading", async () => {
    const { app } = build();
    const nurse = await call(app, {
      method: "POST",
      path: "/v1/mobile/sync/readings",
      token: "nurse-token",
      body: { device_serial: "ESP32-001", session_id: sessionId, readings: [reading("b1111111-1111-4111-8111-111111111203", 1, 36, 10)] },
    });
    expect(nurse.status).toBe(404);
  });

  it("lets an assigned nurse acknowledge and blocks the patient", async () => {
    const { app, db } = build();
    await call(app, {
      method: "POST",
      path: "/v1/mobile/sync/readings",
      token: "patient-token",
      body: { device_serial: "ESP32-001", session_id: sessionId, readings: [reading("b1111111-1111-4111-8111-111111111204", 130, 36.8, 412)] },
    });
    const alertId = db.alerts[0]?.id ?? "";
    const unassigned = await call(app, { method: "POST", path: `/v1/alerts/${alertId}/acknowledge`, token: "nurse-token", body: {} });
    expect(unassigned.status).toBe(403);
    db.assignments.push({ id: "assign-1", clinicianId: nurseId, patientId, assignmentRole: "nurse", active: true });
    const patientAck = await call(app, { method: "POST", path: `/v1/alerts/${alertId}/acknowledge`, token: "patient-token", body: {} });
    expect(patientAck.status).toBe(403);
    const nurseAck = await call(app, {
      method: "POST",
      path: `/v1/alerts/${alertId}/acknowledge`,
      token: "nurse-token",
      body: {},
      origin: "https://staff.example",
    });
    expect(nurseAck.status).toBe(200);
    expect(nurseAck.headers["access-control-allow-origin"]).toBe("https://staff.example");
    const diagnostic = await call(app, {
      method: "POST",
      path: "/v1/notes",
      token: "nurse-token",
      body: { patient_id: patientId, note_text: "This simulated site was diagnosed." },
    });
    expect(diagnostic.status).toBe(400);
  });

  it("allows an admin to assign a device and refuses a patient", async () => {
    const { app, db } = build();
    db.devices.push({
      id: "55555555-5555-4555-8555-555555555556",
      serialNumber: "ESP32-002",
      deviceName: "Spare monitor",
      patientId: null,
      firmwareVersion: "0.1.0",
      pairingStatus: "unpaired",
      lastSeenAt: null,
    });
    const denied = await call(app, {
      method: "POST",
      path: "/v1/admin/devices/assign",
      token: "patient-token",
      body: { device_id: "55555555-5555-4555-8555-555555555556", patient_id: patientId },
    });
    expect(denied.status).toBe(403);
    const assigned = await call(app, {
      method: "POST",
      path: "/v1/admin/devices/assign",
      token: "admin-token",
      body: { device_id: "55555555-5555-4555-8555-555555555556", patient_id: patientId },
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.device.pairing_status).toBe("paired");
  });
});
