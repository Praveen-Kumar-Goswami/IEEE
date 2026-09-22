-- Helpers, signup trigger, idempotent ingest, and row level security.
-- Apply after 20260922190000_smart_dressing_schema.sql.

create or replace function private.is_privileged_actor()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin');
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function private.is_active_patient()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'patient'
  );
$$;

create or replace function private.has_assignment(p_patient_id uuid, p_clinician_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinician_patient_assignments a
    join public.profiles clinician on clinician.id = a.clinician_id
    where a.patient_id = p_patient_id
      and a.clinician_id = p_clinician_id
      and a.active
      and clinician.role in ('doctor', 'nurse')
      and clinician.role::text = a.assignment_role::text
  );
$$;

create or replace function private.can_access_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or (p_patient_id = auth.uid() and private.is_active_patient())
    or private.has_assignment(p_patient_id, auth.uid());
$$;

create or replace function private.sync_profile_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new.role::text)
  where id = new.id;
  return new;
end;
$$;

comment on function private.sync_profile_claims is
  'Copies role into app_metadata. Signup user_metadata is never a source for role.';

create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile id is immutable' using errcode = '42501';
  end if;
  if private.is_privileged_actor() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed by the current user' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_patient_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id and p.role = 'patient'
  ) then
    raise exception 'patient profiles require the patient role';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.patient_id and p.role = 'patient'
  ) then
    raise exception 'assignments require a patient';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.clinician_id
      and p.role::text = new.assignment_role::text
      and p.role in ('doctor', 'nurse')
  ) then
    raise exception 'assignment role must match an active doctor or nurse profile';
  end if;
  if not private.is_privileged_actor() and not private.is_admin() then
    raise exception 'only an administrator can assign a clinician' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_device_patient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.patient_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.patient_id and p.role = 'patient'
  ) then
    raise exception 'devices can only be assigned to a patient';
  end if;
  if tg_op = 'UPDATE'
     and new.patient_id is distinct from old.patient_id
     and not private.is_privileged_actor()
     and not private.is_admin()
  then
    raise exception 'only an administrator can assign a device' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.patient_id and p.role = 'patient'
  ) then
    raise exception 'monitoring sessions require a patient';
  end if;
  if not exists (
    select 1 from public.devices d
    where d.id = new.device_id and d.patient_id = new.patient_id
  ) then
    raise exception 'session device is not assigned to the patient';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_reading()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.monitoring_sessions%rowtype;
begin
  select * into session_row from public.monitoring_sessions where id = new.session_id;
  if not found then
    raise exception 'monitoring session not found';
  end if;
  if new.device_id is distinct from session_row.device_id then
    raise exception 'reading device does not match the monitoring session';
  end if;
  if new.captured_at < session_row.started_at - interval '5 minutes' then
    raise exception 'captured_at is before the monitoring session';
  end if;
  if session_row.ended_at is not null
     and new.captured_at > session_row.ended_at + interval '5 minutes' then
    raise exception 'captured_at is after the monitoring session ended';
  end if;
  if new.captured_at > now() + interval '5 minutes' then
    raise exception 'captured_at is too far in the future';
  end if;
  if new.source is distinct from 'ble_mobile_sync' then
    raise exception 'source must be ble_mobile_sync';
  end if;
  update public.devices set last_seen_at = now() where id = new.device_id;
  return new;
end;
$$;

create or replace function private.enforce_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.author_id and p.role in ('doctor', 'nurse', 'admin')
  ) then
    raise exception 'notes require a doctor, nurse, or admin author';
  end if;
  if new.note_text ~* 'infection detected' or new.note_text ~* 'diagnosed' then
    raise exception 'notes cannot claim a diagnosis';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'audit logs cannot be modified' using errcode = '42501';
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
  phone_value text;
begin
  display_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  if display_name = '' or char_length(display_name) > 120 then
    display_name := 'Patient';
  end if;
  phone_value := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  if phone_value is not null and phone_value !~ '^[0-9+(). -]{7,20}$' then
    phone_value := null;
  end if;

  insert into public.profiles (id, full_name, role, phone)
  values (new.id, display_name, 'patient', phone_value);

  insert into public.patient_profiles (profile_id)
  values (new.id);

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'patient')
  where id = new.id;

  return new;
end;
$$;

comment on function private.handle_new_user is
  'Public signup always becomes a patient. A role value in user metadata is ignored.';

create or replace function public.set_profile_role(
  p_actor_id uuid,
  p_profile_id uuid,
  p_role public.app_role
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_actor_id = p_profile_id then
    raise exception 'administrators cannot change their own role' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles actor
    where actor.id = p_actor_id and actor.role = 'admin'
  ) then
    raise exception 'only an administrator can change roles' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_profile_id;
  if not found then
    raise exception 'profile not found';
  end if;
  if p_role = 'patient' then
    insert into public.patient_profiles (profile_id) values (p_profile_id)
    on conflict (profile_id) do nothing;
  else
    delete from public.patient_profiles where profile_id = p_profile_id;
  end if;
end;
$$;

comment on function public.set_profile_role is
  'Administrator-only role change. Callers cannot change their own role.';

create or replace function public.sync_sensor_readings(p_readings jsonb)
returns table(client_reading_id uuid, outcome text, reason text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  new_id uuid;
begin
  if jsonb_typeof(p_readings) <> 'array' then
    raise exception 'p_readings must be a json array';
  end if;
  if jsonb_array_length(p_readings) > 100 then
    raise exception 'batch exceeds 100 readings';
  end if;

  for item in select value from jsonb_array_elements(p_readings)
  loop
    new_id := null;
    begin
      insert into public.sensor_readings (
        session_id,
        device_id,
        sequence_number,
        captured_at,
        localized_temperature_c,
        ambient_temperature_c,
        humidity_percent,
        relative_moisture_value,
        battery_percent,
        device_status,
        source,
        sync_status,
        client_reading_id
      ) values (
        (item ->> 'session_id')::uuid,
        (item ->> 'device_id')::uuid,
        nullif(item ->> 'sequence_number', '')::integer,
        (item ->> 'captured_at')::timestamptz,
        nullif(item ->> 'localized_temperature_c', '')::numeric,
        nullif(item ->> 'ambient_temperature_c', '')::numeric,
        nullif(item ->> 'humidity_percent', '')::numeric,
        nullif(item ->> 'relative_moisture_value', '')::integer,
        nullif(item ->> 'battery_percent', '')::numeric,
        (item ->> 'device_status')::public.device_link_status,
        'ble_mobile_sync',
        'synced',
        (item ->> 'client_reading_id')::uuid
      )
      on conflict (device_id, client_reading_id) do nothing
      returning id into new_id;

      client_reading_id := (item ->> 'client_reading_id')::uuid;
      if new_id is null then
        outcome := 'skipped';
        reason := null;
      else
        outcome := 'uploaded';
        reason := null;
      end if;
      return next;
    exception
      when check_violation or foreign_key_violation or raise_exception or invalid_text_representation then
        client_reading_id := nullif(item ->> 'client_reading_id', '')::uuid;
        outcome := 'failed';
        reason := sqlerrm;
        return next;
    end;
  end loop;
end;
$$;

comment on function public.sync_sensor_readings is
  'Idempotent batch insert for the Lambda service role. Duplicate client ids are skipped.';

revoke all on function public.sync_sensor_readings(jsonb) from public, anon, authenticated;
revoke all on function public.set_profile_role(uuid, uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.sync_sensor_readings(jsonb) to service_role;
grant execute on function public.set_profile_role(uuid, uuid, public.app_role) to service_role;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger profiles_protect_role
before update on public.profiles
for each row execute function private.protect_profile_role();

create trigger profiles_sync_claims
after insert or update of role on public.profiles
for each row execute function private.sync_profile_claims();

create trigger patient_profiles_set_updated_at
before update on public.patient_profiles
for each row execute function private.set_updated_at();

create trigger patient_profiles_enforce
before insert or update on public.patient_profiles
for each row execute function private.enforce_patient_profile();

create trigger devices_set_updated_at
before update on public.devices
for each row execute function private.set_updated_at();

create trigger devices_enforce_patient
before insert or update of patient_id on public.devices
for each row execute function private.enforce_device_patient();

create trigger assignments_enforce
before insert or update on public.clinician_patient_assignments
for each row execute function private.enforce_assignment();

create trigger sessions_set_updated_at
before update on public.monitoring_sessions
for each row execute function private.set_updated_at();

create trigger sessions_enforce
before insert or update of patient_id, device_id, started_at on public.monitoring_sessions
for each row execute function private.enforce_session();

create trigger readings_enforce
before insert on public.sensor_readings
for each row execute function private.enforce_reading();

create trigger alert_rules_set_updated_at
before update on public.alert_rules
for each row execute function private.set_updated_at();

create trigger notes_set_updated_at
before update on public.clinical_notes
for each row execute function private.set_updated_at();

create trigger notes_enforce
before insert or update of note_text, author_id on public.clinical_notes
for each row execute function private.enforce_note();

create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function private.prevent_audit_mutation();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.clinician_patient_assignments enable row level security;
alter table public.devices enable row level security;
alter table public.monitoring_sessions enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alert_rules enable row level security;
alter table public.indicator_alerts enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.device_events enable row level security;
alter table public.audit_logs enable row level security;

alter table public.profiles force row level security;
alter table public.patient_profiles force row level security;
alter table public.clinician_patient_assignments force row level security;
alter table public.devices force row level security;
alter table public.monitoring_sessions force row level security;
alter table public.sensor_readings force row level security;
alter table public.alert_rules force row level security;
alter table public.indicator_alerts force row level security;
alter table public.clinical_notes force row level security;
alter table public.device_events force row level security;
alter table public.audit_logs force row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
  or (select private.has_assignment(id, auth.uid()))
  or exists (
    select 1 from public.clinician_patient_assignments a
    where a.patient_id = (select auth.uid())
      and a.clinician_id = profiles.id
      and a.active
  )
);

create policy profiles_update on public.profiles
for update to authenticated
using (id = (select auth.uid()) or (select private.is_admin()))
with check (id = (select auth.uid()) or (select private.is_admin()));

create policy patient_profiles_select on public.patient_profiles
for select to authenticated
using ((select private.can_access_patient(profile_id)));

create policy patient_profiles_update on public.patient_profiles
for update to authenticated
using (profile_id = (select auth.uid()) or (select private.is_admin()))
with check (profile_id = (select auth.uid()) or (select private.is_admin()));

create policy assignments_select on public.clinician_patient_assignments
for select to authenticated
using (
  (select private.is_admin())
  or patient_id = (select auth.uid())
  or clinician_id = (select auth.uid())
);

create policy devices_select on public.devices
for select to authenticated
using (
  (select private.is_admin())
  or (patient_id = (select auth.uid()) and (select private.is_active_patient()))
  or (patient_id is not null and (select private.has_assignment(patient_id, auth.uid())))
);

create policy sessions_select on public.monitoring_sessions
for select to authenticated
using ((select private.can_access_patient(patient_id)));

create policy sessions_insert on public.monitoring_sessions
for insert to authenticated
with check (
  patient_id = (select auth.uid()) and (select private.is_active_patient())
);

create policy sessions_update on public.monitoring_sessions
for update to authenticated
using ((select private.can_access_patient(patient_id)))
with check ((select private.can_access_patient(patient_id)));

create policy readings_select on public.sensor_readings
for select to authenticated
using (
  exists (
    select 1 from public.monitoring_sessions s
    where s.id = sensor_readings.session_id
      and (select private.can_access_patient(s.patient_id))
  )
);

create policy readings_insert on public.sensor_readings
for insert to authenticated
with check (
  exists (
    select 1 from public.monitoring_sessions s
    where s.id = sensor_readings.session_id
      and s.patient_id = (select auth.uid())
      and s.device_id = sensor_readings.device_id
      and (select private.is_active_patient())
  )
);

create policy alert_rules_select on public.alert_rules
for select to authenticated
using ((select private.is_admin()));

create policy alerts_select on public.indicator_alerts
for select to authenticated
using ((select private.can_access_patient(patient_id)));

create policy alerts_update on public.indicator_alerts
for update to authenticated
using (
  (select private.is_admin())
  or (select private.has_assignment(patient_id, auth.uid()))
)
with check (
  (select private.is_admin())
  or (select private.has_assignment(patient_id, auth.uid()))
);

create policy notes_select on public.clinical_notes
for select to authenticated
using (
  (select private.is_admin())
  or (select private.has_assignment(patient_id, auth.uid()))
);

create policy notes_insert on public.clinical_notes
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    (select private.is_admin())
    or (select private.has_assignment(patient_id, auth.uid()))
  )
);

create policy device_events_select on public.device_events
for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.devices d
    where d.id = device_events.device_id
      and (
        (d.patient_id = (select auth.uid()) and (select private.is_active_patient()))
        or (d.patient_id is not null and (select private.has_assignment(d.patient_id, auth.uid())))
      )
  )
);

create policy audit_logs_select on public.audit_logs
for select to authenticated
using ((select private.is_admin()));

revoke all on all tables in schema public from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, update (date_of_birth, emergency_contact) on public.patient_profiles to authenticated;
grant select on public.clinician_patient_assignments to authenticated;
grant select on public.devices to authenticated;
grant select, insert on public.monitoring_sessions to authenticated;
grant update (ended_at, status, notes) on public.monitoring_sessions to authenticated;
grant select, insert on public.sensor_readings to authenticated;
grant select on public.alert_rules to authenticated;
grant select on public.indicator_alerts to authenticated;
grant update (status, acknowledged_by, acknowledged_at, resolved_at) on public.indicator_alerts to authenticated;
grant select, insert on public.clinical_notes to authenticated;
grant select on public.device_events to authenticated;
grant select on public.audit_logs to authenticated;
grant all on all tables in schema public to service_role;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_patient() to authenticated;
grant execute on function private.has_assignment(uuid, uuid) to authenticated;
grant execute on function private.can_access_patient(uuid) to authenticated;
grant execute on function private.set_updated_at() to authenticated, supabase_auth_admin;
grant execute on function private.protect_profile_role() to authenticated;
grant execute on function private.sync_profile_claims() to authenticated;
grant execute on function private.enforce_patient_profile() to authenticated;
grant execute on function private.enforce_session() to authenticated;
grant execute on function private.enforce_reading() to authenticated;
grant execute on function private.enforce_note() to authenticated;
grant execute on function private.handle_new_user() to supabase_auth_admin;
grant execute on all functions in schema private to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.indicator_alerts;
    alter publication supabase_realtime add table public.sensor_readings;
    alter publication supabase_realtime add table public.devices;
  end if;
end $$;

insert into public.alert_rules (
  id,
  scope,
  temperature_delta_threshold,
  humidity_threshold,
  moisture_threshold,
  enabled
) values (
  'a1111111-1111-4111-8111-111111111111',
  'global',
  1.0,
  80,
  350,
  true
);
