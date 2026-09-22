import type { AppointmentKind, Facility, StaffRole, StaffStatus } from "@/types/domain";
import { hashString } from "@/utils/math";
import { DAY, HOUR, MINUTE, SECOND, type Overlay, type SignalProfile } from "./signal";

/** Ids shared with supabase/migrations/20260922190002_demo_seed.sql. */
export const SEED_IDS = {
  admin: "11111111-1111-4111-8111-111111111111",
  doctor: "22222222-2222-4222-8222-222222222222",
  nurse: "33333333-3333-4333-8333-333333333333",
  patient: "44444444-4444-4444-8444-444444444444",
  device: "55555555-5555-4555-8555-555555555555",
  session: "77777777-7777-4777-8777-777777777777",
  rule: "a1111111-1111-4111-8111-111111111111",
  facilityWard: "f1111111-1111-4111-8111-111111111101",
  facilitySim: "f1111111-1111-4111-8111-111111111102",
} as const;

export const NS = {
  staff: 1,
  patient: 2,
  device: 3,
  session: 4,
  alert: 5,
  note: 6,
  task: 7,
  checkin: 8,
  appointment: 9,
  notification: 10,
  message: 11,
  report: 12,
  access: 13,
  audit: 14,
  plan: 15,
  facility: 16,
} as const;

export function demoId(ns: number, n: number) {
  return `d0000000-0000-4000-8000-${(ns * 1_000_000 + n).toString(16).padStart(12, "0")}`;
}

export interface StaffSeed {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: StaffRole;
  title: string;
  department: string;
  facilityId: string;
  status: StaffStatus;
  joinedDaysAgo: number;
}

const WARD = SEED_IDS.facilityWard;
const SIM = SEED_IDS.facilitySim;
const DSU = demoId(NS.facility, 1);

export const FACILITIES: Omit<Facility, "patientCount" | "staffCount" | "deviceCount" | "openAlertCount">[] = [
  { id: WARD, name: "North Wing Surgical Recovery", code: "NW-SR", unitType: "ward", bedCapacity: 24 },
  { id: DSU, name: "Day Surgery Unit", code: "DSU", unitType: "day_unit", bedCapacity: 12 },
  { id: SIM, name: "MEDHA Simulation Lab", code: "SIM-LAB", unitType: "simulation_lab", bedCapacity: 6 },
];

export const STAFF: StaffSeed[] = [
  { id: SEED_IDS.admin, fullName: "Priya Nair", email: "admin.smart-dressing@example.com", phone: "+1 555 0101", role: "admin", title: "Platform administrator", department: "Clinical informatics", facilityId: WARD, status: "active", joinedDaysAgo: 210 },
  { id: demoId(NS.staff, 1), fullName: "Owen Fraser", email: "o.fraser@example.com", phone: "+1 555 0111", role: "admin", title: "Security administrator", department: "Information security", facilityId: WARD, status: "active", joinedDaysAgo: 160 },
  { id: SEED_IDS.doctor, fullName: "Helen Cho", email: "doctor.smart-dressing@example.com", phone: "+1 555 0102", role: "doctor", title: "Consultant surgeon", department: "General surgery", facilityId: WARD, status: "active", joinedDaysAgo: 190 },
  { id: demoId(NS.staff, 2), fullName: "Rafael Ortiz", email: "r.ortiz@example.com", phone: "+1 555 0112", role: "doctor", title: "Plastic surgeon", department: "Plastic surgery", facilityId: WARD, status: "active", joinedDaysAgo: 120 },
  { id: demoId(NS.staff, 3), fullName: "Anjali Mehta", email: "a.mehta@example.com", phone: "+1 555 0113", role: "doctor", title: "Wound care specialist", department: "Tissue viability", facilityId: DSU, status: "active", joinedDaysAgo: 74 },
  { id: SEED_IDS.nurse, fullName: "Marcus Adeyemi", email: "nurse.smart-dressing@example.com", phone: "+1 555 0103", role: "nurse", title: "Charge nurse", department: "Surgical recovery", facilityId: WARD, status: "active", joinedDaysAgo: 185 },
  { id: demoId(NS.staff, 4), fullName: "Lena Fischer", email: "l.fischer@example.com", phone: "+1 555 0114", role: "nurse", title: "Staff nurse", department: "Surgical recovery", facilityId: WARD, status: "active", joinedDaysAgo: 96 },
  { id: demoId(NS.staff, 5), fullName: "Grace Owusu", email: "g.owusu@example.com", phone: "+1 555 0115", role: "nurse", title: "Staff nurse", department: "Day surgery", facilityId: DSU, status: "active", joinedDaysAgo: 58 },
  { id: demoId(NS.staff, 6), fullName: "Yuki Tanaka", email: "y.tanaka@example.com", phone: "+1 555 0116", role: "nurse", title: "Tissue viability nurse", department: "Tissue viability", facilityId: SIM, status: "active", joinedDaysAgo: 41 },
  { id: demoId(NS.staff, 7), fullName: "Tomás Reyes", email: "t.reyes@example.com", phone: "+1 555 0117", role: "nurse", title: "Night nurse", department: "Surgical recovery", facilityId: WARD, status: "active", joinedDaysAgo: 22 },
  { id: demoId(NS.staff, 8), fullName: "Ines Duarte", email: "i.duarte@example.com", phone: "+1 555 0118", role: "nurse", title: "Agency nurse", department: "Surgical recovery", facilityId: WARD, status: "suspended", joinedDaysAgo: 12 },
];

const HELEN = SEED_IDS.doctor;
const RAFAEL = demoId(NS.staff, 2);
const ANJALI = demoId(NS.staff, 3);
const MARCUS = SEED_IDS.nurse;
const LENA = demoId(NS.staff, 4);
const GRACE = demoId(NS.staff, 5);
const YUKI = demoId(NS.staff, 6);

export const STAFF_IDS = { HELEN, RAFAEL, ANJALI, MARCUS, LENA, GRACE, YUKI, PRIYA: SEED_IDS.admin, OWEN: demoId(NS.staff, 1) };

export interface PatientSeed {
  id: string;
  fullName: string;
  dateOfBirth: string;
  facilityId: string;
  roomLabel: string;
  emergencyContact: string;
  device: { id: string; serial: string; name: string; firmware: string };
  sessionId: string;
  woundLabel: string;
  doctorId: string;
  nurseId: string;
  profile: SignalProfile;
}

interface PatientSpec {
  fullName: string;
  dateOfBirth: string;
  facilityId: string;
  roomLabel: string;
  contact: string;
  serial: string;
  firmware?: string;
  woundLabel: string;
  doctorId: string;
  nurseId: string;
  admittedDaysAgo: number;
  sessionHoursAgo: number;
  base: [temp: number, ambient: number, humidity: number, moisture: number];
  noise?: number;
  drain?: number;
  overlays?: (t0: number) => Overlay[];
  offline?: (t0: number) => { from: number; to: number | null }[];
}

const PATIENT_SPECS: PatientSpec[] = [
  {
    fullName: "Amina Rahman", dateOfBirth: "1988-04-12", facilityId: SIM, roomLabel: "Bench 2", contact: "Sam Rahman +1 555 0148",
    serial: "ESP32-001", woundLabel: "Simulated dressing, left forearm", doctorId: HELEN, nurseId: MARCUS,
    admittedDaysAgo: 3, sessionHoursAgo: 2, base: [36.55, 28.1, 61, 190],
    overlays: (t0) => [
      { metric: "temp", startMs: t0 - 80 * MINUTE, rampMs: 45 * MINUTE, delta: 1.3 },
      { metric: "moisture", startMs: t0 - 100 * MINUTE, rampMs: 40 * MINUTE, delta: 225 },
    ],
  },
  {
    fullName: "Daniel Kim", dateOfBirth: "1975-09-30", facilityId: WARD, roomLabel: "Bed 04", contact: "Joon Kim +1 555 0152",
    serial: "ESP32-002", woundLabel: "Simulated dressing, abdominal model", doctorId: HELEN, nurseId: MARCUS,
    admittedDaysAgo: 5, sessionHoursAgo: 20, base: [36.4, 24.2, 57, 172], noise: 0.8,
    // Moisture introduced on the simulated wound shortly after the page opens.
    overlays: (t0) => [{ metric: "moisture", startMs: t0 + 6 * SECOND, rampMs: 30 * SECOND, delta: 265 }],
  },
  {
    fullName: "Sofia Rossi", dateOfBirth: "1992-02-18", facilityId: WARD, roomLabel: "Bed 07", contact: "Luca Rossi +1 555 0161",
    serial: "ESP32-003", woundLabel: "Simulated dressing, right thigh", doctorId: RAFAEL, nurseId: MARCUS,
    admittedDaysAgo: 4, sessionHoursAgo: 30, base: [36.3, 24.6, 55, 205],
  },
  {
    fullName: "Kwame Mensah", dateOfBirth: "1961-11-03", facilityId: WARD, roomLabel: "Bed 09", contact: "Ama Mensah +1 555 0170",
    serial: "ESP32-004", woundLabel: "Simulated dressing, lower abdomen", doctorId: HELEN, nurseId: MARCUS,
    admittedDaysAgo: 6, sessionHoursAgo: 26, base: [36.7, 24.0, 59, 190],
    overlays: (t0) => [{ metric: "moisture", startMs: t0 - 3 * HOUR, rampMs: 150 * MINUTE, delta: 330 }],
  },
  {
    fullName: "Elena Petrova", dateOfBirth: "1983-06-21", facilityId: WARD, roomLabel: "Bed 11", contact: "Ivan Petrov +1 555 0183",
    serial: "ESP32-005", woundLabel: "Simulated dressing, left knee", doctorId: HELEN, nurseId: LENA,
    admittedDaysAgo: 8, sessionHoursAgo: 40, base: [36.2, 23.8, 54, 160],
    offline: (t0) => [{ from: t0 - 25 * MINUTE, to: null }],
  },
  {
    fullName: "Arjun Sharma", dateOfBirth: "1990-01-07", facilityId: WARD, roomLabel: "Bed 12", contact: "Neha Sharma +1 555 0190",
    serial: "ESP32-006", woundLabel: "Simulated dressing, sternum model", doctorId: RAFAEL, nurseId: LENA,
    admittedDaysAgo: 2, sessionHoursAgo: 18, base: [36.5, 25.1, 61, 185],
    overlays: (t0) => [{ metric: "humidity", startMs: t0 - 5 * HOUR, rampMs: HOUR, delta: 22 }],
  },
  {
    fullName: "Hannah Lee", dateOfBirth: "1996-08-14", facilityId: WARD, roomLabel: "Bed 15", contact: "Grace Lee +1 555 0199",
    serial: "ESP32-007", woundLabel: "Simulated dressing, right forearm", doctorId: HELEN, nurseId: LENA,
    admittedDaysAgo: 3, sessionHoursAgo: 10, base: [36.35, 24.4, 56, 168],
    offline: (t0) => [{ from: t0 + 40 * SECOND, to: t0 + 80 * SECOND }],
  },
  {
    fullName: "Mateo García", dateOfBirth: "1979-12-02", facilityId: DSU, roomLabel: "Bay 2", contact: "Lucía García +1 555 0204",
    serial: "ESP32-008", woundLabel: "Simulated dressing, left hand", doctorId: RAFAEL, nurseId: GRACE,
    admittedDaysAgo: 1, sessionHoursAgo: 7, base: [36.45, 23.5, 52, 150], drain: 12,
  },
  {
    fullName: "Fatima Zahra", dateOfBirth: "1986-05-26", facilityId: DSU, roomLabel: "Bay 4", contact: "Omar Zahra +1 555 0211",
    serial: "ESP32-009", woundLabel: "Simulated dressing, right shoulder", doctorId: RAFAEL, nurseId: GRACE,
    admittedDaysAgo: 1, sessionHoursAgo: 6, base: [36.3, 23.7, 53, 176],
  },
  {
    fullName: "Oliver Brown", dateOfBirth: "1958-03-15", facilityId: DSU, roomLabel: "Bay 5", contact: "Ruth Brown +1 555 0226",
    serial: "ESP32-010", firmware: "0.0.9", woundLabel: "Simulated dressing, left shin", doctorId: ANJALI, nurseId: GRACE,
    admittedDaysAgo: 2, sessionHoursAgo: 12, base: [36.25, 23.9, 55, 198],
  },
  {
    fullName: "Mei Chen", dateOfBirth: "1994-10-09", facilityId: SIM, roomLabel: "Bench 1", contact: "Wei Chen +1 555 0231",
    serial: "ESP32-011", woundLabel: "Simulated dressing, calf model", doctorId: ANJALI, nurseId: YUKI,
    admittedDaysAgo: 9, sessionHoursAgo: 48, base: [36.4, 27.6, 58, 182],
    overlays: (t0) => [{ metric: "moisture", startMs: t0 - 9 * HOUR, rampMs: HOUR, delta: 240, endMs: t0 - 6.5 * HOUR }],
  },
  {
    fullName: "Samuel Okafor", dateOfBirth: "1970-07-19", facilityId: SIM, roomLabel: "Bench 3", contact: "Ada Okafor +1 555 0245",
    serial: "ESP32-012", woundLabel: "Simulated dressing, upper arm", doctorId: ANJALI, nurseId: YUKI,
    admittedDaysAgo: 12, sessionHoursAgo: 60, base: [36.5, 27.9, 57, 170],
  },
];

export const SPARE_DEVICES = [
  { id: demoId(NS.device, 13), serial: "ESP32-013", name: "Spare dressing monitor", firmware: "0.1.1" },
  { id: demoId(NS.device, 14), serial: "ESP32-014", name: "Spare dressing monitor", firmware: "0.1.1" },
];

export function buildPatients(t0: number): PatientSeed[] {
  return PATIENT_SPECS.map((spec, index) => {
    const n = index + 1;
    const isSeedPatient = n === 1;
    const admittedAt = t0 - spec.admittedDaysAgo * DAY;
    return {
      id: isSeedPatient ? SEED_IDS.patient : demoId(NS.patient, n),
      fullName: spec.fullName,
      dateOfBirth: spec.dateOfBirth,
      facilityId: spec.facilityId,
      roomLabel: spec.roomLabel,
      emergencyContact: spec.contact,
      device: {
        id: isSeedPatient ? SEED_IDS.device : demoId(NS.device, n),
        serial: spec.serial,
        name: `${spec.woundLabel.replace("Simulated dressing, ", "")} dressing monitor`,
        firmware: spec.firmware ?? (n % 4 === 0 ? "0.1.1" : "0.1.0"),
      },
      sessionId: isSeedPatient ? SEED_IDS.session : demoId(NS.session, n * 10),
      woundLabel: spec.woundLabel,
      doctorId: spec.doctorId,
      nurseId: spec.nurseId,
      profile: {
        key: hashString(spec.serial) % 997,
        baseTemp: spec.base[0],
        baseAmbient: spec.base[1],
        baseHumidity: spec.base[2],
        baseMoisture: spec.base[3],
        noiseScale: spec.noise ?? 1,
        admittedAt,
        sessionStart: t0 - spec.sessionHoursAgo * HOUR,
        batteryDrainPerHour: spec.drain ?? 0.9,
        overlays: spec.overlays?.(t0) ?? [],
        offline: spec.offline?.(t0) ?? [],
      },
    };
  });
}

export const NOTE_TEMPLATES = {
  doctor: [
    "Reviewed the localized temperature trend with the team. Continue monitoring the simulated dressing indicators every 4 hours.",
    "Relative moisture indicator reviewed. Dressing remains in place; bedside check requested at the next round.",
    "Indicators steady across the session. No change to the care plan.",
    "Discussed the humidity reading with nursing. Ambient conditions in the bay are a likely contributor; keep the current plan.",
  ],
  nurse: [
    "Bedside check completed. Dressing intact, device secured and synchronizing.",
    "Phone gateway restarted at the bedside. Readings resumed after pairing.",
    "Patient comfortable. Recorded body temperature and dressing condition in the check-in.",
    "Edge of the dressing slightly lifted; re-secured and noted for the doctor.",
  ],
} as const;

export const APPOINTMENT_KINDS: AppointmentKind[] = ["indicator_review", "dressing_change", "follow_up", "device_fitting"];

export const ACCESS_REQUEST_SEEDS = [
  { name: "Nadia Rahimi", email: "n.rahimi@example.com", role: "doctor" as const, department: "Plastic surgery", license: "GMC-7741025", facilityId: WARD, justification: "Joining the plastic surgery rota on North Wing from Monday; needs access to assigned patients.", hoursAgo: 3 },
  { name: "Kofi Asante", email: "k.asante@example.com", role: "nurse" as const, department: "Surgical recovery", license: "NMC-22B4471", facilityId: WARD, justification: "Rotating onto surgical recovery nights for the next six weeks.", hoursAgo: 9 },
  { name: "Sara Lindqvist", email: "s.lindqvist@example.com", role: "nurse" as const, department: "Day surgery", license: "NMC-19C0932", facilityId: DSU, justification: "Day surgery bank nurse, covering Grace Owusu's leave.", hoursAgo: 20 },
  { name: "Ravi Menon", email: "r.menon@example.com", role: "admin" as const, department: "Clinical informatics", license: null, facilityId: WARD, justification: "Informatics analyst supporting device roll-out and reporting.", hoursAgo: 30 },
  { name: "Chloe Martin", email: "c.martin@example.com", role: "doctor" as const, department: "General surgery", license: "GMC-6620918", facilityId: WARD, justification: "Registrar on the general surgery team.", hoursAgo: 72, reviewed: "approved" as const },
  { name: "Ethan Wright", email: "e.wright@example.com", role: "admin" as const, department: "Estates", license: null, facilityId: WARD, justification: "Would like to see device battery levels.", hoursAgo: 96, reviewed: "rejected" as const },
  { name: "Aisha Bello", email: "a.bello@example.com", role: "nurse" as const, department: "Tissue viability", license: "NMC-21A5580", facilityId: SIM, justification: "Supporting simulation lab sessions.", hoursAgo: 130, reviewed: "approved" as const },
];

export const MESSAGE_THREADS: { a: string; b: string; patientIndex: number | null; lines: { from: "a" | "b"; body: string; minutesAgo: number }[] }[] = [
  {
    a: HELEN, b: MARCUS, patientIndex: 0,
    lines: [
      { from: "b", body: "Amina's localized temperature indicator opened about 40 minutes ago. Dressing looks intact at the bench.", minutesAgo: 38 },
      { from: "a", body: "Thanks. I'll review the trend now. Can you record a bedside check before the next round?", minutesAgo: 34 },
      { from: "b", body: "Will do. Moisture indicator from earlier is acknowledged; I've noted the reading.", minutesAgo: 29 },
    ],
  },
  {
    a: HELEN, b: MARCUS, patientIndex: 3,
    lines: [{ from: "b", body: "Kwame's relative moisture has been climbing since this morning and is now above the threshold. Could you take a look?", minutesAgo: 47 }],
  },
  {
    a: HELEN, b: RAFAEL, patientIndex: null,
    lines: [
      { from: "b", body: "I can cover your review list after 4pm if clinic runs over.", minutesAgo: 190 },
      { from: "a", body: "That would help, thank you. Kwame Mensah is the one to keep an eye on.", minutesAgo: 175 },
    ],
  },
  {
    a: MARCUS, b: LENA, patientIndex: 4,
    lines: [
      { from: "b", body: "Elena's device stopped syncing. Phone shows Bluetooth off — heading over now.", minutesAgo: 20 },
      { from: "a", body: "Thanks Lena. Log it in the check-in once it's back.", minutesAgo: 18 },
    ],
  },
  {
    a: SEED_IDS.admin, b: HELEN, patientIndex: null,
    lines: [{ from: "a", body: "Firmware 0.1.1 is rolling out to the North Wing devices tonight. No action needed on your side.", minutesAgo: 320 }],
  },
  {
    a: SEED_IDS.admin, b: MARCUS, patientIndex: null,
    lines: [{ from: "a", body: "Two spare monitors (ESP32-013 and 014) are in the ward cupboard if a device needs swapping.", minutesAgo: 540 }],
  },
];
