-- Demo rows for the clinician web platform. Uses the accounts from 20260922190002_demo_seed.sql.

insert into public.facilities (id, name, code, unit_type, timezone, bed_capacity)
values
  ('f1111111-1111-4111-8111-111111111101', 'North Wing Surgical Recovery', 'NW-SR', 'ward', 'UTC', 24),
  ('f1111111-1111-4111-8111-111111111102', 'MEDHA Simulation Lab', 'SIM-LAB', 'simulation_lab', 'UTC', 6);

insert into public.staff_profiles (profile_id, facility_id, title, department, status)
values
  ('11111111-1111-4111-8111-111111111111', 'f1111111-1111-4111-8111-111111111101', 'Platform administrator', 'Clinical informatics', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'f1111111-1111-4111-8111-111111111101', 'Consultant surgeon', 'General surgery', 'active'),
  ('33333333-3333-4333-8333-333333333333', 'f1111111-1111-4111-8111-111111111101', 'Charge nurse', 'Surgical recovery', 'active');

update public.patient_profiles
set facility_id = 'f1111111-1111-4111-8111-111111111102', room_label = 'Bench 2'
where profile_id = '44444444-4444-4444-8444-444444444444';

insert into public.care_plans (
  id, patient_id, author_id, title, instructions, dressing_change_interval_hours, review_interval_hours
) values (
  'e1111111-1111-4111-8111-111111111101',
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  'Simulated forearm dressing monitoring',
  'Keep the simulated dressing in place. Review localized temperature and relative moisture indicators every 4 hours and record a bedside check.',
  48,
  4
);

insert into public.care_tasks (
  id, patient_id, assigned_to, created_by, alert_id, task_type, title, priority, status, due_at
) values
  ('e2222222-2222-4222-8222-222222222201', '44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'c1111111-1111-4111-8111-111111111101', 'indicator_review', 'Review localized temperature indicator', 'high', 'pending', now() + interval '20 minutes'),
  ('e2222222-2222-4222-8222-222222222202', '44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', null, 'measurement', 'Bedside check: temperature and dressing condition', 'normal', 'pending', now() + interval '2 hours'),
  ('e2222222-2222-4222-8222-222222222203', '44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', null, 'device_check', 'Confirm ESP32-001 is secured and synchronizing', 'low', 'pending', now() + interval '4 hours');

insert into public.appointments (
  id, patient_id, clinician_id, created_by, kind, starts_at, ends_at, location
) values (
  'e3333333-3333-4333-8333-333333333301',
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222222',
  'indicator_review',
  date_trunc('hour', now()) + interval '3 hours',
  date_trunc('hour', now()) + interval '3 hours 30 minutes',
  'Simulation Lab, Bench 2'
);

insert into public.notifications (recipient_id, kind, title, body, patient_id, entity_type, entity_id)
values
  ('22222222-2222-4222-8222-222222222222', 'indicator_alert', 'Monitoring indicator: elevated temperature', 'Localized temperature trend changed from baseline. Review is recommended.', '44444444-4444-4444-8444-444444444444', 'indicator_alerts', 'c1111111-1111-4111-8111-111111111101'),
  ('33333333-3333-4333-8333-333333333333', 'indicator_alert', 'Monitoring indicator: elevated temperature', 'Localized temperature trend changed from baseline. Review is recommended.', '44444444-4444-4444-8444-444444444444', 'indicator_alerts', 'c1111111-1111-4111-8111-111111111101');
