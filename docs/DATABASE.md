# Database

Apply these files, in order, on a **new** Supabase project. Do not apply them to `ASHA_DATABASE` (`fjrgoshacluiawqocarl`). That project already has unrelated maternal-health tables, including its own `public.profiles`.

1. `supabase/migrations/20260922190000_smart_dressing_schema.sql`
2. `supabase/migrations/20260922190001_functions_rls.sql`
3. `supabase/migrations/20260922190002_demo_seed.sql`

Tables: `profiles`, `patient_profiles`, `clinician_patient_assignments`, `devices`, `monitoring_sessions`, `sensor_readings`, `alert_rules`, `indicator_alerts`, `clinical_notes`, `device_events`, `audit_logs`.

Row level security is enabled and forced on every table. `anon` has no grants. Patients read their own profile, device, sessions, readings, and indicator alerts. They do not read clinical notes, alert rules, or audit logs. Doctors and nurses read patients on an active assignment. Nurses and doctors can acknowledge alerts and insert notes for those patients. They cannot change roles. Admins read audit logs. Role changes go through `set_profile_role`, which rejects self-change. `sync_sensor_readings` is executable only by `service_role`.

`sensor_readings` is unique on `(device_id, client_reading_id)`. Indexes cover `session_id` plus `captured_at`, `device_id` plus `captured_at`, `captured_at`, and `monitoring_sessions (patient_id, started_at)` for patient-linked queries.

The global demonstration rule is a 1.0 C localized-temperature change from the session baseline, humidity at or above 80 percent, and relative moisture at or above 350 ADC counts.

Demo emails, with random passwords until `npm run seed:demo`:

- admin.smart-dressing@example.com
- doctor.smart-dressing@example.com
- nurse.smart-dressing@example.com
- patient.smart-dressing@example.com

Device serial `ESP32-001` is paired to the demo patient. The seed includes an active simulated-forearm session, three readings, one open temperature indicator, and one acknowledged moisture indicator.

`auth.identities.email` is generated on current Supabase projects, so the seed does not insert it. Signup metadata that asks for admin still creates a patient.

Manual teardown is `supabase/rollbacks/down.sql`.
