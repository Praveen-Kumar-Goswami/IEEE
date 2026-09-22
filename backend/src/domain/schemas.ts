import { z } from "zod";
import type { FieldIssue } from "../errors.js";
import { LIMITS } from "./limits.js";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const linkStatus = z.enum(["normal", "connected", "watch", "attention", "offline", "syncing"]);

export const readingSchema = z
  .object({
    client_reading_id: uuid,
    sequence: z.number().int().min(LIMITS.sequenceMin).max(LIMITS.sequenceMax).nullable().optional(),
    captured_at: timestamp,
    localized_temperature_c: z.number().finite().min(LIMITS.localizedTempMin).max(LIMITS.localizedTempMax).nullable().optional(),
    ambient_temperature_c: z.number().finite().min(LIMITS.ambientTempMin).max(LIMITS.ambientTempMax).nullable().optional(),
    humidity_percent: z.number().finite().min(LIMITS.humidityMin).max(LIMITS.humidityMax).nullable().optional(),
    relative_moisture_value: z.number().int().min(LIMITS.moistureMin).max(LIMITS.moistureMax).nullable().optional(),
    battery_percent: z.number().finite().min(LIMITS.batteryMin).max(LIMITS.batteryMax).nullable().optional(),
    device_status: linkStatus,
  })
  .strict();

export type ReadingInput = z.infer<typeof readingSchema>;

export const syncEnvelopeSchema = z
  .object({
    device_id: uuid.optional(),
    device_serial: z.string().regex(/^[A-Za-z0-9-]{4,40}$/).optional(),
    session_id: uuid,
    readings: z.array(z.unknown()).min(1).max(LIMITS.batchMax),
  })
  .strict()
  .refine((value) => Boolean(value.device_id || value.device_serial), {
    message: "Provide device_id or device_serial.",
    path: ["device_id"],
  });

export const createSessionSchema = z
  .object({
    id: uuid,
    device_id: uuid.optional(),
    device_serial: z.string().regex(/^[A-Za-z0-9-]{4,40}$/).optional(),
    started_at: timestamp,
    simulated_wound_label: z.string().trim().min(1).max(120).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.device_id || value.device_serial), {
    message: "Provide device_id or device_serial.",
    path: ["device_id"],
  });

export const endSessionSchema = z
  .object({
    ended_at: timestamp.optional(),
  })
  .strict();

export const acknowledgeSchema = z
  .object({})
  .strict();

export const noteSchema = z
  .object({
    patient_id: uuid,
    session_id: uuid.nullable().optional(),
    alert_id: uuid.nullable().optional(),
    note_text: z.string().trim().min(1).max(1000),
  })
  .strict();

export const assignDeviceSchema = z
  .object({
    device_id: uuid,
    patient_id: uuid,
  })
  .strict();

export const assignmentSchema = z
  .object({
    clinician_id: uuid,
    patient_id: uuid,
    assignment_role: z.enum(["doctor", "nurse"]),
  })
  .strict();

export const roleSchema = z
  .object({
    profile_id: uuid,
    role: z.enum(["patient", "doctor", "nurse", "admin"]),
  })
  .strict();

const personName = z.string().trim().min(2).max(120);
const phoneNumber = z.string().trim().regex(/^[0-9+(). -]{7,20}$/, "Enter a phone number.");
const emailAddress = z.string().trim().email().max(200);
const passwordValue = z.string().min(8).max(72);

export const registerSchema = z
  .object({
    full_name: personName,
    phone: phoneNumber,
    email: emailAddress,
    password: passwordValue,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailAddress,
    password: passwordValue,
  })
  .strict();

export const alertRuleSchema = z
  .object({
    scope: z.enum(["global", "device", "patient"]),
    patient_id: uuid.nullable().optional(),
    device_id: uuid.nullable().optional(),
    temperature_delta_threshold: z.number().finite().min(0.1).max(20).nullable().optional(),
    humidity_threshold: z.number().finite().min(0).max(100).nullable().optional(),
    moisture_threshold: z.number().int().min(0).max(4095).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope === "global" && (value.patient_id || value.device_id)) {
      ctx.addIssue({ code: "custom", path: ["scope"], message: "A global rule has no patient or device." });
    }
    if (value.scope === "patient" && !value.patient_id) {
      ctx.addIssue({ code: "custom", path: ["patient_id"], message: "A patient rule requires a patient." });
    }
    if (value.scope === "device" && !value.device_id) {
      ctx.addIssue({ code: "custom", path: ["device_id"], message: "A device rule requires a device." });
    }
    if (
      value.temperature_delta_threshold == null &&
      value.humidity_threshold == null &&
      value.moisture_threshold == null
    ) {
      ctx.addIssue({ code: "custom", path: ["scope"], message: "A rule needs at least one threshold." });
    }
  });

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; details: FieldIssue[] };

export function parseWith<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    message: "The request body is invalid.",
    details: parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    })),
  };
}

export function readLooseClientId(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("client_reading_id" in value)) return null;
  const id = (value as { client_reading_id: unknown }).client_reading_id;
  return typeof id === "string" ? id : null;
}
