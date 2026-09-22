-- Demo accounts for a simulated-wound monitoring demonstration.
-- Passwords are random. Set usable ones with: npm run seed:demo
-- Signup metadata asks for admin and is ignored; roles are set afterwards.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.smart-dressing@example.com', extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Priya Nair","role":"admin","phone":"+1 555 0101"}'::jsonb, now(), now(), false, false),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor.smart-dressing@example.com', extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Helen Cho","role":"admin","phone":"+1 555 0102"}'::jsonb, now(), now(), false, false),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nurse.smart-dressing@example.com', extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Marcus Adeyemi","role":"admin","phone":"+1 555 0103"}'::jsonb, now(), now(), false, false),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient.smart-dressing@example.com', extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Amina Rahman","role":"admin","phone":"+1 555 0104"}'::jsonb, now(), now(), false, false);

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select u.id, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', u.id::text, now(), now(), now()
from auth.users u
where u.email in (
  'admin.smart-dressing@example.com',
  'doctor.smart-dressing@example.com',
  'nurse.smart-dressing@example.com',
  'patient.smart-dressing@example.com'
);

update public.profiles set role = 'admin' where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set role = 'doctor' where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set role = 'nurse' where id = '33333333-3333-4333-8333-333333333333';

delete from public.patient_profiles
where profile_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

update public.patient_profiles
set
  emergency_contact = 'Sam Rahman +1 555 0148',
  monitoring_status = 'watch'
where profile_id = '44444444-4444-4444-8444-444444444444';

insert into public.devices (
  id, serial_number, device_name, patient_id, firmware_version, pairing_status, last_seen_at
) values (
  '55555555-5555-4555-8555-555555555555',
  'ESP32-001',
  'Forearm dressing monitor',
  '44444444-4444-4444-8444-444444444444',
  '0.1.0',
  'paired',
  now()
);

insert into public.clinician_patient_assignments (
  id, clinician_id, patient_id, assignment_role, active
) values
  ('88888888-8888-4888-8888-888888888881', '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'doctor', true),
  ('88888888-8888-4888-8888-888888888882', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', 'nurse', true);

insert into public.monitoring_sessions (
  id, patient_id, device_id, started_at, status, simulated_wound_label, notes
) values (
  '77777777-7777-4777-8777-777777777777',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  now() - interval '2 hours',
  'active',
  'Simulated dressing, left forearm',
  'Safe simulated wound model. Early-warning demonstration only.'
);

insert into public.sensor_readings (
  session_id, device_id, sequence_number, captured_at,
  localized_temperature_c, ambient_temperature_c, humidity_percent,
  relative_moisture_value, battery_percent, device_status, source, sync_status, client_reading_id
)
select
  '77777777-7777-4777-8777-777777777777',
  '55555555-5555-4555-8555-555555555555',
  reading.sequence_number,
  (now() - interval '2 hours') + reading.offset_minutes,
  reading.localized_temperature_c,
  reading.ambient_temperature_c,
  reading.humidity_percent,
  reading.relative_moisture_value,
  90,
  'connected',
  'ble_mobile_sync',
  'synced',
  reading.client_reading_id
from (values
  ('b1111111-1111-4111-8111-111111111101'::uuid, 101, interval '10 minutes', 36.60::numeric, 28.10::numeric, 60.0::numeric, 180),
  ('b1111111-1111-4111-8111-111111111102'::uuid, 110, interval '40 minutes', 36.80::numeric, 28.20::numeric, 62.0::numeric, 210),
  ('b1111111-1111-4111-8111-111111111103'::uuid, 120, interval '70 minutes', 37.90::numeric, 28.40::numeric, 65.4::numeric, 412)
) as reading (
  client_reading_id, sequence_number, offset_minutes,
  localized_temperature_c, ambient_temperature_c, humidity_percent, relative_moisture_value
);

insert into public.indicator_alerts (
  id, patient_id, device_id, session_id, reading_id, alert_rule_id,
  alert_type, severity, status, message, dedupe_key
)
select
  'c1111111-1111-4111-8111-111111111101',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777',
  reading.id,
  'a1111111-1111-4111-8111-111111111111',
  'elevated_temperature',
  'watch',
  'open',
  'Localized temperature trend changed from baseline. Review is recommended. This is a monitoring indicator requiring clinical review, not a diagnosis.',
  'a1111111-1111-4111-8111-111111111111:elevated_temperature'
from public.sensor_readings reading
where reading.client_reading_id = 'b1111111-1111-4111-8111-111111111103';

insert into public.indicator_alerts (
  id, patient_id, device_id, session_id, reading_id, alert_rule_id,
  alert_type, severity, status, message, dedupe_key,
  acknowledged_by, acknowledged_at
)
select
  'c1111111-1111-4111-8111-111111111102',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777',
  reading.id,
  'a1111111-1111-4111-8111-111111111111',
  'moisture_change',
  'attention',
  'acknowledged',
  'Relative moisture indicator is above the configured monitoring threshold. This is a monitoring indicator requiring clinical review, not a diagnosis.',
  'a1111111-1111-4111-8111-111111111111:moisture_change',
  '33333333-3333-4333-8333-333333333333',
  now() - interval '30 minutes'
from public.sensor_readings reading
where reading.client_reading_id = 'b1111111-1111-4111-8111-111111111103';

insert into public.clinical_notes (
  id, patient_id, author_id, session_id, alert_id, note_text
) values (
  'd1111111-1111-4111-8111-111111111101',
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  '77777777-7777-4777-8777-777777777777',
  'c1111111-1111-4111-8111-111111111102',
  'Simulated moisture change reviewed. Continued monitoring of the dressing indicators is recommended.'
);

insert into public.device_events (device_id, event_type, event_payload)
values (
  '55555555-5555-4555-8555-555555555555',
  'demo.seeded',
  '{"serial_number":"ESP32-001","note":"simulated dressing demonstration"}'::jsonb
);
