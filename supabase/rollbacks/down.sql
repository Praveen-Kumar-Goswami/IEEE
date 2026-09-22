-- Manual teardown for a dedicated smart-dressing project.
-- Do not run this against ASHA_DATABASE.

begin;

drop trigger if exists on_auth_user_created on auth.users;

drop view if exists public.patient_monitoring_overview;
drop function if exists public.reading_buckets(uuid, timestamptz, timestamptz, integer);
drop function if exists public.platform_daily_activity(integer);
drop table if exists public.access_requests cascade;
drop table if exists public.reports cascade;
drop table if exists public.messages cascade;
drop table if exists public.notifications cascade;
drop table if exists public.appointments cascade;
drop table if exists public.care_plans cascade;
drop table if exists public.patient_checkins cascade;
drop table if exists public.care_tasks cascade;
drop table if exists public.staff_profiles cascade;
drop table if exists public.facilities cascade;

drop type if exists public.access_request_status;
drop type if exists public.report_status;
drop type if exists public.report_format;
drop type if exists public.report_type;
drop type if exists public.notification_kind;
drop type if exists public.appointment_status;
drop type if exists public.appointment_kind;
drop type if exists public.dressing_condition;
drop type if exists public.care_task_status;
drop type if exists public.care_task_priority;
drop type if exists public.care_task_type;
drop type if exists public.staff_status;

drop table if exists public.audit_logs cascade;
drop table if exists public.device_events cascade;
drop table if exists public.clinical_notes cascade;
drop table if exists public.indicator_alerts cascade;
drop table if exists public.alert_rules cascade;
drop table if exists public.sensor_readings cascade;
drop table if exists public.monitoring_sessions cascade;
drop table if exists public.devices cascade;
drop table if exists public.clinician_patient_assignments cascade;
drop table if exists public.patient_profiles cascade;
drop table if exists public.profiles cascade;

drop function if exists public.sync_sensor_readings(jsonb);
drop function if exists public.set_profile_role(uuid, uuid, public.app_role);

drop type if exists public.indicator_alert_status;
drop type if exists public.indicator_severity;
drop type if exists public.indicator_alert_type;
drop type if exists public.alert_scope;
drop type if exists public.device_link_status;
drop type if exists public.sync_status;
drop type if exists public.reading_source;
drop type if exists public.session_status;
drop type if exists public.pairing_status;
drop type if exists public.assignment_role;
drop type if exists public.monitoring_status;
drop type if exists public.app_role;

drop schema if exists private cascade;

delete from auth.users
where email in (
  'admin.smart-dressing@example.com',
  'doctor.smart-dressing@example.com',
  'nurse.smart-dressing@example.com',
  'patient.smart-dressing@example.com'
);

commit;
