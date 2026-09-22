import type { StaffRole, Viewer } from "@/types/domain";
import { SEED_IDS } from "./dataset";

/** The three staff accounts seeded in supabase/migrations/20260922190002_demo_seed.sql. */
export const DEMO_VIEWERS: Record<StaffRole, Viewer> = {
  doctor: {
    id: SEED_IDS.doctor,
    fullName: "Helen Cho",
    email: "doctor.smart-dressing@example.com",
    role: "doctor",
    title: "Consultant surgeon",
    department: "General surgery",
    facilityName: "North Wing Surgical Recovery",
  },
  nurse: {
    id: SEED_IDS.nurse,
    fullName: "Marcus Adeyemi",
    email: "nurse.smart-dressing@example.com",
    role: "nurse",
    title: "Charge nurse",
    department: "Surgical recovery",
    facilityName: "North Wing Surgical Recovery",
  },
  admin: {
    id: SEED_IDS.admin,
    fullName: "Priya Nair",
    email: "admin.smart-dressing@example.com",
    role: "admin",
    title: "Platform administrator",
    department: "Clinical informatics",
    facilityName: "North Wing Surgical Recovery",
  },
};
