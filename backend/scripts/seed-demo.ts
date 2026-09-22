import { createClient } from "@supabase/supabase-js";
import { loadDotEnv } from "../src/config.js";

const users = [
  { role: "admin", id: "11111111-1111-4111-8111-111111111111", env: "DEMO_ADMIN_PASSWORD" },
  { role: "doctor", id: "22222222-2222-4222-8222-222222222222", env: "DEMO_DOCTOR_PASSWORD" },
  { role: "nurse", id: "33333333-3333-4333-8333-333333333333", env: "DEMO_NURSE_PASSWORD" },
  { role: "patient", id: "44444444-4444-4444-8444-444444444444", env: "DEMO_PATIENT_PASSWORD" },
] as const;

loadDotEnv();
const url = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
for (const user of users) {
  const password = process.env[user.env]?.trim() ?? "";
  if (password.length < 8) {
    console.error(`${user.env} must be at least 8 characters.`);
    process.exit(1);
  }
}
const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
for (const user of users) {
  const password = process.env[user.env]?.trim() ?? "";
  const { error } = await client.auth.admin.updateUserById(user.id, { password });
  if (error) {
    console.error(`Could not update the ${user.role} demo user.`);
    process.exit(1);
  }
  console.log(`Updated the ${user.role} demo user.`);
}
