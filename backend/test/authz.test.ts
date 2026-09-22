import { describe, expect, it } from "vitest";
import {
  canAccessPatient,
  canAcknowledge,
  canSync,
  requireAdmin,
  requireActor,
  type Actor,
} from "../src/domain/authz.js";

const patient: Actor = { id: "44444444-4444-4444-8444-444444444444", role: "patient", fullName: "Amina Rahman" };
const nurse: Actor = { id: "33333333-3333-4333-8333-333333333333", role: "nurse", fullName: "Marcus Adeyemi" };
const admin: Actor = { id: "11111111-1111-4111-8111-111111111111", role: "admin", fullName: "Priya Nair" };

function status(access: { ok: true } | { ok: false; status: number }): number {
  return access.ok ? 200 : access.status;
}

describe("authorization", () => {
  it("requires a signed-in actor", () => {
    expect(requireActor(null).ok).toBe(false);
  });

  it("lets only the owning patient upload readings", () => {
    expect(canSync(patient, patient.id).ok).toBe(true);
    expect(status(canSync(patient, nurse.id))).toBe(404);
    expect(status(canSync(nurse, patient.id))).toBe(404);
    expect(status(canSync(admin, patient.id))).toBe(404);
  });

  it("limits clinicians to assigned patients", () => {
    expect(canAccessPatient(nurse, patient.id, true).ok).toBe(true);
    expect(status(canAccessPatient(nurse, patient.id, false))).toBe(403);
    expect(canAccessPatient(patient, patient.id, false).ok).toBe(true);
    expect(status(canAccessPatient(patient, nurse.id, false))).toBe(403);
    expect(canAccessPatient(admin, patient.id, false).ok).toBe(true);
  });

  it("lets an assigned nurse acknowledge and keeps patients out", () => {
    expect(status(canAcknowledge(patient, true))).toBe(403);
    expect(canAcknowledge(nurse, true).ok).toBe(true);
    expect(status(canAcknowledge(nurse, false))).toBe(403);
    expect(canAcknowledge(admin, false).ok).toBe(true);
  });

  it("reserves administration for admins", () => {
    expect(requireAdmin(admin).ok).toBe(true);
    expect(status(requireAdmin(nurse))).toBe(403);
  });
});
