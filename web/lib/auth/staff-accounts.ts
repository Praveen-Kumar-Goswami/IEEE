import type { StaffRole } from "@/types/domain";

export type StaffAccount = {
  role: StaffRole;
  fullName: string;
  email: string;
  password: string;
  title: string;
};

/** Live Lambda accounts. Each sign-in opens that role's workspace. */
export const STAFF_ACCOUNTS: StaffAccount[] = [
  { role: "doctor", fullName: "Helen Cho", email: "helen.cho@tend.care", password: "TendDoc#2026", title: "Consultant surgeon" },
  { role: "nurse", fullName: "Marcus Adeyemi", email: "marcus.adeyemi@tend.care", password: "TendNurse#2026", title: "Charge nurse" },
  { role: "admin", fullName: "Priya Nair", email: "priya.nair@tend.care", password: "TendAdmin#2026", title: "Platform administrator" },
];

export function staffAccountForEmail(email: string): StaffAccount | undefined {
  const key = email.trim().toLowerCase();
  return STAFF_ACCOUNTS.find((account) => account.email === key);
}
