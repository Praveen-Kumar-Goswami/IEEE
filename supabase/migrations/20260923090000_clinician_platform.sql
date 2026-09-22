-- Clinician web platform: staff context, care workflow, inbox, reports, approvals.
-- Apply after 20260922190002_demo_seed.sql on the dedicated smart-dressing project.
-- Indicators remain monitoring signals for review. Free text is checked for diagnosis wording.

create type public.staff_status as enum ('active', 'suspended');
create type public.care_task_type as enum (
  'dressing_check',
  'measurement',
  'device_check',
  'indicator_review',
  'patient_education',
  'other'
);
create type public.care_task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.care_task_status as enum ('pending', 'in_progress', 'completed', 'delayed', 'cancelled');
create type public.dressing_condition as enum ('intact', 'damp', 'saturated', 'lifted', 'replaced');
create type public.appointment_kind as enum (
  'indicator_review',
  'dressing_change',
  'follow_up',
  'device_fitting'
);
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'missed');
create type public.notification_kind as enum (
  'indicator_alert',
  'alert_escalation',
  'task',
  'message',
  'device',
  'approval',
  'system'
);
create type public.report_type as enum (
  'patient_summary',
  'session_summary',
  'indicator_log',
  'device_health',
  'audit_export',
  'facility_activity'
);
create type public.report_format as enum ('csv', 'pdf');
create type public.report_status as enum ('queued', 'ready', 'failed');
create type public.access_request_status as enum ('pending', 'approved', 'rejected');

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  unit_type text not null default 'ward',
  timezone text not null default 'UTC',
  bed_capacity integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilities_name_ck check (char_length(btrim(name)) between 2 and 120),
  constraint facilities_code_ck check (code ~ '^[A-Za-z0-9-]{2,20}$'),
  constraint facilities_unit_ck check (unit_type in ('ward', 'day_unit', 'outpatient', 'simulation_lab')),
  constraint facilities_beds_ck check (bed_capacity is null or bed_capacity between 0 and 2000)
);

comment on table public.facilities is 'Wards and units that group patients and staff.';

create unique index facilities_code_key on public.facilities (lower(code));

create table public.staff_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  facility_id uuid references public.facilities (id) on delete set null,
  title text,
  department text,
  license_number text,
  status public.staff_status not null default 'active',
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_profiles_title_ck check (title is null or char_length(title) <= 80),
  constraint staff_profiles_department_ck check (department is null or char_length(department) <= 80),
  constraint staff_profiles_license_ck check (license_number is null or char_length(license_number) <= 40)
);

comment on table public.staff_profiles is
  'Doctor, nurse, and admin context. Identity stays in auth.users and role stays in profiles.';

create index staff_profiles_facility_idx on public.staff_profiles (facility_id);

alter table public.patient_profiles
  add column facility_id uuid references public.facilities (id) on delete set null,
  add column room_label text,
  add constraint patient_profiles_room_ck check (room_label is null or char_length(room_label) <= 40);

create index patient_profiles_facility_idx on public.patient_profiles (facility_id);

create table public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  alert_id uuid references public.indicator_alerts (id) on delete set null,
  task_type public.care_task_type not null,
  title text not null,
  details text,
  priority public.care_task_priority not null default 'normal',
  status public.care_task_status not null default 'pending',
  due_at timestamptz not null,
  delayed_until timestamptz,
  delay_reason text,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_tasks_title_ck check (char_length(btrim(title)) between 3 and 160),
  constraint care_tasks_details_ck check (details is null or char_length(details) <= 1000),
  constraint care_tasks_delay_reason_ck check (delay_reason is null or char_length(delay_reason) <= 300),
  constraint care_tasks_completed_ck check ((status = 'completed') = (completed_at is not null)),
  constraint care_tasks_delayed_ck check (status <> 'delayed' or delayed_until is not null)
);

comment on table public.care_tasks is 'Scheduled nursing and review tasks for an assigned patient.';

create index care_tasks_assignee_due_idx on public.care_tasks (assigned_to, due_at);
create index care_tasks_patient_due_idx on public.care_tasks (patient_id, due_at);
create index care_tasks_status_due_idx on public.care_tasks (status, due_at);
create index care_tasks_alert_idx on public.care_tasks (alert_id);
create index care_tasks_created_by_idx on public.care_tasks (created_by);
create index care_tasks_completed_by_idx on public.care_tasks (completed_by);

create table public.patient_checkins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  session_id uuid references public.monitoring_sessions (id) on delete set null,
  task_id uuid references public.care_tasks (id) on delete set null,
  body_temperature_c numeric(4, 1),
  pain_score smallint,
  dressing_condition public.dressing_condition,
  device_secure boolean,
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint patient_checkins_temp_ck check (body_temperature_c is null or body_temperature_c between 30 and 45),
  constraint patient_checkins_pain_ck check (pain_score is null or pain_score between 0 and 10),
  constraint patient_checkins_notes_ck check (
    notes is null
    or (char_length(notes) <= 1000 and notes !~* 'infection detected' and notes !~* 'diagnosed')
  ),
  constraint patient_checkins_payload_ck check (
    num_nonnulls(body_temperature_c, pain_score, dressing_condition, device_secure) >= 1
  )
);

comment on table public.patient_checkins is
  'Manual bedside measurements entered by staff. Separate from BLE sensor_readings.';

create index patient_checkins_patient_idx on public.patient_checkins (patient_id, recorded_at desc);
create index patient_checkins_recorded_by_idx on public.patient_checkins (recorded_by);
create index patient_checkins_session_idx on public.patient_checkins (session_id);
create index patient_checkins_task_idx on public.patient_checkins (task_id);

create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  instructions text not null,
  dressing_change_interval_hours integer,
  review_interval_hours integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_plans_title_ck check (char_length(btrim(title)) between 3 and 120),
  constraint care_plans_instructions_ck check (
    char_length(btrim(instructions)) between 1 and 2000
    and instructions !~* 'infection detected'
    and instructions !~* 'diagnosed'
  ),
  constraint care_plans_dressing_interval_ck check (
    dressing_change_interval_hours is null or dressing_change_interval_hours between 1 and 336
  ),
  constraint care_plans_review_interval_ck check (
    review_interval_hours is null or review_interval_hours between 1 and 336
  )
);

comment on table public.care_plans is 'Dressing and review plan written by an assigned doctor.';

create index care_plans_patient_idx on public.care_plans (patient_id, created_at desc);
create index care_plans_author_idx on public.care_plans (author_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  clinician_id uuid not null references public.profiles (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null,
  kind public.appointment_kind not null,
  status public.appointment_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_ck check (ends_at > starts_at),
  constraint appointments_location_ck check (location is null or char_length(location) <= 80),
  constraint appointments_notes_ck check (notes is null or char_length(notes) <= 500)
);

create index appointments_clinician_start_idx on public.appointments (clinician_id, starts_at);
create index appointments_patient_start_idx on public.appointments (patient_id, starts_at);
create index appointments_created_by_idx on public.appointments (created_by);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text,
  patient_id uuid references public.profiles (id) on delete cascade,
  entity_type text,
  entity_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_ck check (char_length(btrim(title)) between 1 and 160),
  constraint notifications_body_ck check (body is null or char_length(body) <= 500),
  constraint notifications_entity_ck check (entity_type is null or char_length(entity_type) between 3 and 80)
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_patient_idx on public.notifications (patient_id);
create index notifications_created_by_idx on public.notifications (created_by);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete restrict,
  recipient_id uuid not null references public.profiles (id) on delete restrict,
  patient_id uuid references public.profiles (id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_body_ck check (char_length(btrim(body)) between 1 and 2000),
  constraint messages_not_self_ck check (sender_id <> recipient_id)
);

comment on table public.messages is 'Direct messages between staff. Patients do not use this table.';

create index messages_recipient_idx on public.messages (recipient_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
create index messages_patient_idx on public.messages (patient_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  patient_id uuid references public.profiles (id) on delete set null,
  report_type public.report_type not null,
  format public.report_format not null,
  status public.report_status not null default 'queued',
  period_start timestamptz not null,
  period_end timestamptz not null,
  storage_path text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_period_ck check (period_end > period_start),
  constraint reports_storage_ck check (storage_path is null or char_length(storage_path) <= 300),
  constraint reports_ready_ck check (status <> 'ready' or storage_path is not null)
);

comment on table public.reports is
  'Export requests. A worker renders the file into Storage and sets storage_path.';

create index reports_created_by_idx on public.reports (created_by, created_at desc);
create index reports_patient_idx on public.reports (patient_id);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  requested_role public.app_role not null,
  facility_id uuid references public.facilities (id) on delete set null,
  department text,
  license_number text,
  justification text,
  status public.access_request_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint access_requests_role_ck check (requested_role in ('doctor', 'nurse', 'admin')),
  constraint access_requests_review_ck check ((status = 'pending') = (reviewed_at is null)),
  constraint access_requests_text_ck check (
    (justification is null or char_length(justification) <= 1000)
    and (review_note is null or char_length(review_note) <= 500)
    and (department is null or char_length(department) <= 80)
    and (license_number is null or char_length(license_number) <= 40)
  )
);

comment on table public.access_requests is
  'Staff access requests. Approval changes the role through set_profile_role on the server.';

create unique index access_requests_one_pending_idx
  on public.access_requests (requester_id)
  where status = 'pending';
create index access_requests_status_idx on public.access_requests (status, created_at desc);
create index access_requests_facility_idx on public.access_requests (facility_id);
create index access_requests_reviewed_by_idx on public.access_requests (reviewed_by);

-- Helpers

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')
  );
$$;

create or replace function private.enforce_staff_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id and p.role in ('doctor', 'nurse', 'admin')
  ) then
    raise exception 'staff profiles require a doctor, nurse, or admin role';
  end if;
  return new;
end;
$$;

create or replace function private.protect_patient_placement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.facility_id is distinct from old.facility_id or new.room_label is distinct from old.room_label)
     and not private.is_privileged_actor()
     and not private.is_admin()
  then
    raise exception 'only an administrator can change patient placement' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := to_jsonb(new);
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    (row_data ->> 'id')::uuid,
    jsonb_strip_nulls(jsonb_build_object(
      'status', row_data ->> 'status',
      'patient_id', row_data ->> 'patient_id'
    ))
  );
  return new;
end;
$$;

comment on function private.write_audit is
  'Appends an audit row for workflow changes. Metadata is limited to status and patient id.';

create or replace function private.notify_team_on_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, kind, title, body, patient_id, entity_type, entity_id)
  select
    a.clinician_id,
    'indicator_alert',
    'Monitoring indicator: ' || replace(new.alert_type::text, '_', ' '),
    new.message,
    new.patient_id,
    'indicator_alerts',
    new.id
  from public.clinician_patient_assignments a
  where a.patient_id = new.patient_id and a.active;
  return new;
end;
$$;

create or replace function private.complete_task_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.task_id is not null then
    update public.care_tasks
    set status = 'completed', completed_at = new.recorded_at, completed_by = new.recorded_by
    where id = new.task_id and patient_id = new.patient_id and status <> 'completed';
  end if;
  return new;
end;
$$;

create or replace function public.reading_buckets(
  p_patient_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket_seconds integer
)
returns table (
  bucket_start timestamptz,
  localized_temperature_c numeric,
  ambient_temperature_c numeric,
  humidity_percent numeric,
  relative_moisture_value numeric,
  sample_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    to_timestamp(floor(extract(epoch from r.captured_at) / p_bucket_seconds) * p_bucket_seconds),
    round(avg(r.localized_temperature_c), 2),
    round(avg(r.ambient_temperature_c), 2),
    round(avg(r.humidity_percent), 2),
    round(avg(r.relative_moisture_value), 0),
    count(*)
  from public.sensor_readings r
  join public.monitoring_sessions s on s.id = r.session_id
  where s.patient_id = p_patient_id
    and r.captured_at >= p_from
    and r.captured_at < p_to
    and p_bucket_seconds between 10 and 86400
  group by 1
  order by 1;
$$;

comment on function public.reading_buckets is
  'Downsampled indicator series for charts. Runs as the caller, so row level security applies.';

create or replace function public.platform_daily_activity(p_days integer)
returns table (
  day date,
  readings bigint,
  reporting_devices bigint,
  checkins bigint,
  sessions_started bigint,
  alerts bigint,
  active_staff bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(current_date - (least(greatest(p_days, 1), 90) - 1), current_date, interval '1 day')::date as day
  )
  select
    d.day,
    (select count(*) from public.sensor_readings r where r.captured_at >= d.day and r.captured_at < d.day + 1),
    (select count(distinct r.device_id) from public.sensor_readings r where r.captured_at >= d.day and r.captured_at < d.day + 1),
    (select count(*) from public.patient_checkins c where c.recorded_at >= d.day and c.recorded_at < d.day + 1),
    (select count(*) from public.monitoring_sessions s where s.started_at >= d.day and s.started_at < d.day + 1),
    (select count(*) from public.indicator_alerts a where a.created_at >= d.day and a.created_at < d.day + 1),
    (select count(distinct l.actor_id) from public.audit_logs l where l.created_at >= d.day and l.created_at < d.day + 1)
  from days d
  order by d.day;
$$;

comment on function public.platform_daily_activity is
  'Daily platform counts for admin analytics. Runs as the caller; non-admins only count rows they can read.';

create view public.patient_monitoring_overview
with (security_invoker = true)
as
select
  p.id as patient_id,
  p.full_name,
  pp.date_of_birth,
  pp.monitoring_status,
  pp.room_label,
  pp.facility_id,
  f.name as facility_name,
  d.id as device_id,
  d.serial_number as device_serial,
  d.pairing_status,
  d.last_seen_at,
  d.firmware_version,
  s.id as session_id,
  s.simulated_wound_label,
  s.started_at as session_started_at,
  r.captured_at as last_reading_at,
  r.localized_temperature_c,
  r.ambient_temperature_c,
  r.humidity_percent,
  r.relative_moisture_value,
  r.battery_percent,
  r.device_status as last_device_status,
  coalesce(al.open_count, 0) as open_alert_count,
  coalesce(al.open_attention_count, 0) as open_attention_count,
  coalesce(al.acknowledged_count, 0) as acknowledged_alert_count,
  doc.clinician_id as doctor_id,
  doc.full_name as doctor_name,
  nur.clinician_id as nurse_id,
  nur.full_name as nurse_name
from public.profiles p
join public.patient_profiles pp on pp.profile_id = p.id
left join public.facilities f on f.id = pp.facility_id
left join lateral (
  select dv.* from public.devices dv
  where dv.patient_id = p.id
  order by dv.last_seen_at desc nulls last
  limit 1
) d on true
left join lateral (
  select ms.* from public.monitoring_sessions ms
  where ms.patient_id = p.id and ms.status in ('active', 'paused')
  order by ms.started_at desc
  limit 1
) s on true
left join lateral (
  select sr.* from public.sensor_readings sr
  where sr.session_id = s.id
  order by sr.captured_at desc
  limit 1
) r on true
left join lateral (
  select
    count(*) filter (where ia.status = 'open') as open_count,
    count(*) filter (where ia.status = 'open' and ia.severity = 'attention') as open_attention_count,
    count(*) filter (where ia.status = 'acknowledged') as acknowledged_count
  from public.indicator_alerts ia
  where ia.patient_id = p.id
) al on true
left join lateral (
  select ca.clinician_id, cp.full_name
  from public.clinician_patient_assignments ca
  join public.profiles cp on cp.id = ca.clinician_id
  where ca.patient_id = p.id and ca.active and ca.assignment_role = 'doctor'
  order by ca.created_at
  limit 1
) doc on true
left join lateral (
  select ca.clinician_id, cp.full_name
  from public.clinician_patient_assignments ca
  join public.profiles cp on cp.id = ca.clinician_id
  where ca.patient_id = p.id and ca.active and ca.assignment_role = 'nurse'
  order by ca.created_at
  limit 1
) nur on true
where p.role = 'patient';

comment on view public.patient_monitoring_overview is
  'One row per visible patient with the latest indicator sample and open indicator counts.';

-- Triggers

create trigger facilities_set_updated_at
before update on public.facilities
for each row execute function private.set_updated_at();

create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function private.set_updated_at();

create trigger staff_profiles_enforce
before insert or update of profile_id on public.staff_profiles
for each row execute function private.enforce_staff_profile();

create trigger patient_profiles_protect_placement
before update of facility_id, room_label on public.patient_profiles
for each row execute function private.protect_patient_placement();

create trigger care_tasks_set_updated_at
before update on public.care_tasks
for each row execute function private.set_updated_at();

create trigger care_plans_set_updated_at
before update on public.care_plans
for each row execute function private.set_updated_at();

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function private.set_updated_at();

create trigger care_tasks_audit
after insert or update of status on public.care_tasks
for each row execute function private.write_audit();

create trigger patient_checkins_audit
after insert on public.patient_checkins
for each row execute function private.write_audit();

create trigger care_plans_audit
after insert or update on public.care_plans
for each row execute function private.write_audit();

create trigger appointments_audit
after insert or update of status on public.appointments
for each row execute function private.write_audit();

create trigger access_requests_audit
after insert or update of status on public.access_requests
for each row execute function private.write_audit();

create trigger indicator_alerts_notify_team
after insert on public.indicator_alerts
for each row execute function private.notify_team_on_alert();

create trigger patient_checkins_complete_task
after insert on public.patient_checkins
for each row execute function private.complete_task_on_checkin();

-- Row level security

alter table public.facilities enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.care_tasks enable row level security;
alter table public.patient_checkins enable row level security;
alter table public.care_plans enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.access_requests enable row level security;

alter table public.facilities force row level security;
alter table public.staff_profiles force row level security;
alter table public.care_tasks force row level security;
alter table public.patient_checkins force row level security;
alter table public.care_plans force row level security;
alter table public.appointments force row level security;
alter table public.notifications force row level security;
alter table public.messages force row level security;
alter table public.reports force row level security;
alter table public.access_requests force row level security;

-- Staff can see each other so a care team can show names and message colleagues.
create policy profiles_select_staff_directory on public.profiles
for select to authenticated
using ((select private.is_staff()) and role in ('doctor', 'nurse', 'admin'));

create policy assignments_select_care_team on public.clinician_patient_assignments
for select to authenticated
using ((select private.has_assignment(patient_id, auth.uid())));

create policy facilities_select on public.facilities
for select to authenticated
using ((select private.is_staff()));

create policy facilities_admin_write on public.facilities
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy staff_profiles_select on public.staff_profiles
for select to authenticated
using ((select private.is_staff()));

create policy staff_profiles_admin_write on public.staff_profiles
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy care_tasks_select on public.care_tasks
for select to authenticated
using (
  (select private.is_admin())
  or assigned_to = (select auth.uid())
  or (select private.has_assignment(patient_id, auth.uid()))
);

create policy care_tasks_insert on public.care_tasks
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and ((select private.is_admin()) or (select private.has_assignment(patient_id, auth.uid())))
);

create policy care_tasks_update on public.care_tasks
for update to authenticated
using (
  (select private.is_admin())
  or assigned_to = (select auth.uid())
  or (select private.has_assignment(patient_id, auth.uid()))
)
with check (
  (select private.is_admin())
  or assigned_to = (select auth.uid())
  or (select private.has_assignment(patient_id, auth.uid()))
);

create policy patient_checkins_select on public.patient_checkins
for select to authenticated
using ((select private.is_admin()) or (select private.has_assignment(patient_id, auth.uid())));

create policy patient_checkins_insert on public.patient_checkins
for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and (select private.has_assignment(patient_id, auth.uid()))
);

create policy care_plans_select on public.care_plans
for select to authenticated
using ((select private.is_admin()) or (select private.has_assignment(patient_id, auth.uid())));

create policy care_plans_insert on public.care_plans
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.clinician_patient_assignments a
    where a.patient_id = care_plans.patient_id
      and a.clinician_id = (select auth.uid())
      and a.active
      and a.assignment_role = 'doctor'
  )
);

create policy care_plans_update on public.care_plans
for update to authenticated
using (author_id = (select auth.uid()) or (select private.is_admin()))
with check (author_id = (select auth.uid()) or (select private.is_admin()));

create policy appointments_select on public.appointments
for select to authenticated
using (
  (select private.is_admin())
  or clinician_id = (select auth.uid())
  or (select private.has_assignment(patient_id, auth.uid()))
);

create policy appointments_insert on public.appointments
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and ((select private.is_admin()) or (select private.has_assignment(patient_id, auth.uid())))
);

create policy appointments_update on public.appointments
for update to authenticated
using (
  (select private.is_admin())
  or clinician_id = (select auth.uid())
  or (select private.has_assignment(patient_id, auth.uid()))
)
with check (
  (select private.is_admin())
  or clinician_id = (select auth.uid())
  or (select private.has_assignment(patient_id, auth.uid()))
);

create policy notifications_select on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()));

create policy notifications_update on public.notifications
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

-- A clinician can notify another member of the same patient's care team (escalation).
create policy notifications_insert on public.notifications
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select private.is_admin())
    or (
      patient_id is not null
      and (select private.has_assignment(patient_id, auth.uid()))
      and private.has_assignment(patient_id, recipient_id)
    )
  )
);

create policy messages_select on public.messages
for select to authenticated
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy messages_insert on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and (select private.is_staff())
  and exists (
    select 1 from public.profiles r
    where r.id = messages.recipient_id and r.role in ('doctor', 'nurse', 'admin')
  )
);

create policy messages_update on public.messages
for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create policy reports_select on public.reports
for select to authenticated
using (created_by = (select auth.uid()) or (select private.is_admin()));

create policy reports_insert on public.reports
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'queued'
  and (
    (select private.is_admin())
    or (patient_id is not null and (select private.has_assignment(patient_id, auth.uid())))
  )
);

create policy access_requests_select on public.access_requests
for select to authenticated
using (requester_id = (select auth.uid()) or (select private.is_admin()));

create policy access_requests_insert on public.access_requests
for insert to authenticated
with check (requester_id = (select auth.uid()) and status = 'pending');

create policy access_requests_update on public.access_requests
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()) and requester_id <> (select auth.uid()));

-- Grants

grant select on public.facilities to authenticated;
grant insert, update (name, code, unit_type, timezone, bed_capacity) on public.facilities to authenticated;
grant select on public.staff_profiles to authenticated;
grant insert, update (facility_id, title, department, license_number, status, last_active_at)
  on public.staff_profiles to authenticated;
grant update (facility_id, room_label) on public.patient_profiles to authenticated;
grant select, insert on public.care_tasks to authenticated;
grant update (assigned_to, priority, status, delayed_until, delay_reason, completed_at, completed_by)
  on public.care_tasks to authenticated;
grant select, insert on public.patient_checkins to authenticated;
grant select, insert on public.care_plans to authenticated;
grant update (title, instructions, dressing_change_interval_hours, review_interval_hours, active)
  on public.care_plans to authenticated;
grant select, insert on public.appointments to authenticated;
grant update (status, starts_at, ends_at, location, notes) on public.appointments to authenticated;
grant select, insert on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert on public.access_requests to authenticated;
grant update (status, reviewed_by, reviewed_at, review_note) on public.access_requests to authenticated;
grant select on public.patient_monitoring_overview to authenticated;
grant all on
  public.facilities,
  public.staff_profiles,
  public.care_tasks,
  public.patient_checkins,
  public.care_plans,
  public.appointments,
  public.notifications,
  public.messages,
  public.reports,
  public.access_requests
to service_role;
grant select on public.patient_monitoring_overview to service_role;

revoke all on function public.reading_buckets(uuid, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.reading_buckets(uuid, timestamptz, timestamptz, integer) to authenticated, service_role;
revoke all on function public.platform_daily_activity(integer) from public, anon;
grant execute on function public.platform_daily_activity(integer) to authenticated, service_role;

grant execute on function private.is_staff() to authenticated;
grant execute on function private.enforce_staff_profile() to authenticated;
grant execute on function private.protect_patient_placement() to authenticated;
grant execute on function private.write_audit() to authenticated;
grant execute on function private.notify_team_on_alert() to authenticated;
grant execute on function private.complete_task_on_checkin() to authenticated;
grant execute on all functions in schema private to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.patient_profiles;
    alter publication supabase_realtime add table public.care_tasks;
    alter publication supabase_realtime add table public.notifications;
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.access_requests;
  end if;
end $$;
