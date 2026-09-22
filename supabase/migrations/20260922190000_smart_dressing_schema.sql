-- Simulated-wound monitoring schema for IEEE MEDHA 2026.
-- Readings are selected environmental indicators. They are not a diagnosis
-- of surgical-site infection and must not be used to make a clinical decision.
--
-- Sensors on the ESP32 DevKit V1 (ESP32-WROOM-32) breadboard:
--   DS18B20  -> localized_temperature_c
--   BME280   -> ambient_temperature_c, humidity_percent
--   copper tape voltage divider -> relative_moisture_value (ADC counts, not exudate)

create schema if not exists private;

comment on schema private is
  'Trigger and row-level-security helpers. Not exposed by the Data API.';

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role, supabase_auth_admin, authenticated;

alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from anon, authenticated;

create type public.app_role as enum ('patient', 'doctor', 'nurse', 'admin');
create type public.monitoring_status as enum ('normal', 'watch', 'attention', 'offline');
create type public.assignment_role as enum ('doctor', 'nurse');
create type public.pairing_status as enum ('unpaired', 'paired', 'disconnected');
create type public.session_status as enum ('active', 'paused', 'completed');
create type public.reading_source as enum ('ble_mobile_sync');
create type public.sync_status as enum ('pending', 'synced', 'failed');
create type public.device_link_status as enum (
  'normal',
  'connected',
  'watch',
  'attention',
  'offline',
  'syncing'
);
create type public.alert_scope as enum ('global', 'device', 'patient');
create type public.indicator_alert_type as enum (
  'elevated_temperature',
  'humidity_change',
  'moisture_change',
  'device_offline',
  'sync_issue'
);
create type public.indicator_severity as enum ('info', 'watch', 'attention');
create type public.indicator_alert_status as enum ('open', 'acknowledged', 'resolved');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'patient',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_ck check (char_length(btrim(full_name)) between 1 and 120),
  constraint profiles_phone_ck check (phone is null or phone ~ '^[0-9+(). -]{7,20}$')
);

comment on table public.profiles is
  'One profile per auth user. Public signup is always a patient. Role is not taken from user metadata.';
comment on column public.profiles.role is
  'Authorization role stored for app_metadata sync. Signup metadata cannot set this.';

create table public.patient_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  date_of_birth date,
  emergency_contact text,
  monitoring_status public.monitoring_status not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_profiles_dob_ck check (
    date_of_birth is null
    or (date_of_birth >= date '1900-01-01' and date_of_birth <= current_date)
  ),
  constraint patient_profiles_contact_ck check (
    emergency_contact is null or char_length(emergency_contact) between 3 and 160
  )
);

comment on table public.patient_profiles is
  'Non-diagnostic patient context for a simulated dressing monitor.';
comment on column public.patient_profiles.monitoring_status is
  'Simple status for the patient app: normal, watch, attention, or offline. Not an infection label.';

create table public.clinician_patient_assignments (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.profiles (id) on delete restrict,
  patient_id uuid not null references public.profiles (id) on delete restrict,
  assignment_role public.assignment_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clinician_patient_not_self_ck check (clinician_id <> patient_id)
);

comment on table public.clinician_patient_assignments is
  'Doctors and nurses see only patients with an active row here.';

create unique index clinician_patient_one_active_pair_idx
  on public.clinician_patient_assignments (clinician_id, patient_id)
  where active;

create index clinician_patient_patient_idx
  on public.clinician_patient_assignments (patient_id)
  where active;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null,
  device_name text not null,
  patient_id uuid references public.profiles (id) on delete set null,
  firmware_version text,
  pairing_status public.pairing_status not null default 'unpaired',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_serial_ck check (serial_number ~ '^[A-Za-z0-9-]{4,40}$'),
  constraint devices_name_ck check (char_length(btrim(device_name)) between 2 and 80),
  constraint devices_firmware_ck check (
    firmware_version is null or char_length(firmware_version) <= 40
  )
);

comment on table public.devices is
  'ESP32-WROOM-32 smart-dressing prototype. serial_number matches the BLE deviceId, for example ESP32-001.';

create unique index devices_serial_key on public.devices (lower(serial_number));
create index devices_patient_idx on public.devices (patient_id);

create table public.monitoring_sessions (
  id uuid primary key,
  patient_id uuid not null references public.profiles (id) on delete restrict,
  device_id uuid not null references public.devices (id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz,
  status public.session_status not null default 'active',
  simulated_wound_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monitoring_sessions_status_ck check (
    (status in ('active', 'paused') and ended_at is null)
    or (status = 'completed' and ended_at is not null)
  ),
  constraint monitoring_sessions_time_ck check (ended_at is null or ended_at >= started_at),
  constraint monitoring_sessions_label_ck check (
    simulated_wound_label is null or char_length(simulated_wound_label) <= 120
  ),
  constraint monitoring_sessions_notes_ck check (notes is null or char_length(notes) <= 500)
);

comment on table public.monitoring_sessions is
  'A monitoring period on a simulated dressing. id may be generated by the phone before upload.';
comment on column public.monitoring_sessions.simulated_wound_label is
  'Label for the safe simulated wound model. Not a clinical wound record.';

create unique index monitoring_sessions_one_open_patient_idx
  on public.monitoring_sessions (patient_id)
  where status in ('active', 'paused');

create index monitoring_sessions_device_idx
  on public.monitoring_sessions (device_id, started_at desc);

create index monitoring_sessions_patient_started_idx
  on public.monitoring_sessions (patient_id, started_at desc);

create table public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.monitoring_sessions (id) on delete restrict,
  device_id uuid not null references public.devices (id) on delete restrict,
  sequence_number integer,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  localized_temperature_c numeric(5, 2),
  ambient_temperature_c numeric(5, 2),
  humidity_percent numeric(5, 2),
  relative_moisture_value integer,
  battery_percent numeric(5, 2),
  device_status public.device_link_status not null,
  source public.reading_source not null default 'ble_mobile_sync',
  sync_status public.sync_status not null default 'synced',
  client_reading_id uuid not null,
  created_at timestamptz not null default now(),
  constraint sensor_readings_sequence_ck check (
    sequence_number is null or sequence_number between 0 and 1000000
  ),
  constraint sensor_readings_local_temp_ck check (
    localized_temperature_c is null or localized_temperature_c between -55 and 125
  ),
  constraint sensor_readings_ambient_temp_ck check (
    ambient_temperature_c is null or ambient_temperature_c between -40 and 85
  ),
  constraint sensor_readings_humidity_ck check (
    humidity_percent is null or humidity_percent between 0 and 100
  ),
  constraint sensor_readings_moisture_ck check (
    relative_moisture_value is null or relative_moisture_value between 0 and 4095
  ),
  constraint sensor_readings_battery_ck check (
    battery_percent is null or battery_percent between 0 and 100
  ),
  constraint sensor_readings_payload_ck check (
    num_nonnulls(
      localized_temperature_c,
      ambient_temperature_c,
      humidity_percent,
      relative_moisture_value
    ) >= 1
  ),
  constraint sensor_readings_client_key unique (device_id, client_reading_id)
);

comment on table public.sensor_readings is
  'Offline-capable indicator samples. client_reading_id is the phone idempotency key.';
comment on column public.sensor_readings.localized_temperature_c is
  'DS18B20 localized temperature near the simulated dressing, degrees Celsius.';
comment on column public.sensor_readings.ambient_temperature_c is
  'BME280 ambient temperature around the dressing, degrees Celsius.';
comment on column public.sensor_readings.humidity_percent is
  'BME280 relative humidity percent.';
comment on column public.sensor_readings.relative_moisture_value is
  'Copper-tape ADC count, 0 to 4095. A relative moisture signal, not a clinical exudate measurement.';
comment on column public.sensor_readings.sequence_number is
  'BLE sequence number from the ESP32 packet.';
comment on column public.sensor_readings.captured_at is
  'UTC time from the phone or ESP32, including samples stored in SQLite while offline.';
comment on column public.sensor_readings.received_at is
  'UTC time when the Lambda API stored the sample.';
comment on column public.sensor_readings.client_reading_id is
  'Client UUID. A retry with the same device and id is skipped and does not insert a second row.';

create index sensor_readings_session_captured_idx
  on public.sensor_readings (session_id, captured_at desc, id desc);

create index sensor_readings_device_captured_idx
  on public.sensor_readings (device_id, captured_at desc);

create index sensor_readings_captured_idx
  on public.sensor_readings (captured_at desc);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  scope public.alert_scope not null,
  patient_id uuid references public.profiles (id) on delete cascade,
  device_id uuid references public.devices (id) on delete cascade,
  temperature_delta_threshold numeric(4, 2),
  humidity_threshold numeric(5, 2),
  moisture_threshold integer,
  enabled boolean not null default true,
  configured_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alert_rules_scope_ck check (
    (scope = 'global' and patient_id is null and device_id is null)
    or (scope = 'patient' and patient_id is not null and device_id is null)
    or (scope = 'device' and device_id is not null and patient_id is null)
  ),
  constraint alert_rules_temp_ck check (
    temperature_delta_threshold is null or temperature_delta_threshold between 0.1 and 20
  ),
  constraint alert_rules_humidity_ck check (
    humidity_threshold is null or humidity_threshold between 0 and 100
  ),
  constraint alert_rules_moisture_ck check (
    moisture_threshold is null or moisture_threshold between 0 and 4095
  ),
  constraint alert_rules_has_threshold_ck check (
    num_nonnulls(temperature_delta_threshold, humidity_threshold, moisture_threshold) >= 1
  )
);

comment on table public.alert_rules is
  'Predefined monitoring thresholds for a simulated dressing. Not diagnostic criteria.';
comment on column public.alert_rules.temperature_delta_threshold is
  'Absolute change in localized temperature from a rolling baseline, in Celsius.';

create index alert_rules_patient_idx on public.alert_rules (patient_id) where enabled;
create index alert_rules_device_idx on public.alert_rules (device_id) where enabled;

create table public.indicator_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  device_id uuid references public.devices (id) on delete restrict,
  session_id uuid references public.monitoring_sessions (id) on delete restrict,
  reading_id uuid references public.sensor_readings (id) on delete restrict,
  alert_rule_id uuid references public.alert_rules (id) on delete set null,
  alert_type public.indicator_alert_type not null,
  severity public.indicator_severity not null,
  status public.indicator_alert_status not null default 'open',
  message text not null,
  dedupe_key text not null,
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint indicator_alerts_message_ck check (char_length(message) between 20 and 500),
  constraint indicator_alerts_wording_ck check (
    message ~* 'monitoring indicator'
    and message !~* 'infection detected'
    and message !~* 'diagnosed'
  ),
  constraint indicator_alerts_dedupe_ck check (char_length(dedupe_key) between 3 and 200),
  constraint indicator_alerts_status_ck check (
    (
      status = 'open'
      and acknowledged_at is null
      and acknowledged_by is null
      and resolved_at is null
    )
    or (
      status = 'acknowledged'
      and acknowledged_at is not null
      and acknowledged_by is not null
      and resolved_at is null
    )
    or (status = 'resolved' and resolved_at is not null)
  )
);

comment on table public.indicator_alerts is
  'Early-warning monitoring indicators that require clinical review. An alert is not a diagnosis.';
comment on column public.indicator_alerts.dedupe_key is
  'One open or acknowledged indicator per patient and key.';

create unique index indicator_alerts_one_active_idx
  on public.indicator_alerts (patient_id, dedupe_key)
  where status in ('open', 'acknowledged');

create index indicator_alerts_patient_created_idx
  on public.indicator_alerts (patient_id, created_at desc, id desc);

create index indicator_alerts_status_idx
  on public.indicator_alerts (status, created_at desc);

create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  session_id uuid references public.monitoring_sessions (id) on delete set null,
  alert_id uuid references public.indicator_alerts (id) on delete set null,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_notes_text_ck check (char_length(btrim(note_text)) between 1 and 1000)
);

comment on table public.clinical_notes is
  'Monitoring notes from an assigned doctor or nurse. Not a diagnosis and not visible to the patient app.';

create index clinical_notes_patient_idx
  on public.clinical_notes (patient_id, created_at desc);

create table public.device_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint device_events_type_ck check (char_length(event_type) between 3 and 80),
  constraint device_events_payload_ck check (jsonb_typeof(event_payload) = 'object'),
  constraint device_events_no_secrets_ck check (
    not (
      event_payload ?| array[
        'password', 'token', 'secret', 'service_role_key', 'authorization',
        'access_token', 'refresh_token'
      ]
    )
  )
);

comment on table public.device_events is
  'Pairing, sync, and threshold events. Do not store tokens or raw credentials.';

create index device_events_device_idx on public.device_events (device_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_ck check (char_length(action) between 3 and 80),
  constraint audit_logs_entity_ck check (char_length(entity_type) between 3 and 80),
  constraint audit_logs_metadata_ck check (jsonb_typeof(metadata) = 'object'),
  constraint audit_logs_no_secrets_ck check (
    not (
      metadata ?| array[
        'password', 'token', 'secret', 'service_role_key', 'authorization',
        'access_token', 'refresh_token'
      ]
    )
  )
);

comment on table public.audit_logs is
  'Append-only record of assignments, uploads, acknowledgements, and notes. No secrets.';

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create index clinician_assignments_clinician_idx
  on public.clinician_patient_assignments (clinician_id);
create index alert_rules_configured_by_idx on public.alert_rules (configured_by);
create index indicator_alerts_device_idx on public.indicator_alerts (device_id);
create index indicator_alerts_session_idx on public.indicator_alerts (session_id);
create index indicator_alerts_reading_idx on public.indicator_alerts (reading_id);
create index indicator_alerts_ack_idx on public.indicator_alerts (acknowledged_by);
create index clinical_notes_author_idx on public.clinical_notes (author_id);
create index clinical_notes_session_idx on public.clinical_notes (session_id);
create index clinical_notes_alert_idx on public.clinical_notes (alert_id);
