# HTTP API

Bearer access token from Supabase Auth. The Lambda verifies the user, then reads `profiles.role`. It does not trust signup metadata. Responses are JSON. Errors look like:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request body is invalid.",
    "request_id": "req-test-1234",
    "details": [{ "path": "readings", "message": "Array must contain at least 1 element(s)" }]
  }
}
```

Codes: `unauthorized` 401, `forbidden` 403, `not_found` 404, `validation_error` 400, `conflict` 409, `configuration_error` 500, `internal_error` 500.

Every monitoring payload includes this idea: indicators are for review of a simulated dressing, not a diagnosis.

## GET /health

No token. `{ "status": "ok", "service": "smart-dressing-api" }`.

## POST /v1/mobile/sync/readings

Patient who owns the session. A nurse, doctor, or admin upload returns 404. Batch size 1 to 100. Provide `device_id` or `device_serial` (`ESP32-001`). A repeated `client_reading_id` for the same device is skipped and the stored sample is left unchanged.

```json
{
  "device_serial": "ESP32-001",
  "session_id": "77777777-7777-4777-8777-777777777777",
  "readings": [
    {
      "client_reading_id": "b1111111-1111-4111-8111-111111111202",
      "sequence": 120,
      "captured_at": "2026-09-22T15:00:00.000Z",
      "localized_temperature_c": 36.8,
      "ambient_temperature_c": 28.2,
      "humidity_percent": 65.4,
      "relative_moisture_value": 412,
      "device_status": "connected"
    }
  ]
}
```

```json
{
  "uploaded": ["b1111111-1111-4111-8111-111111111202"],
  "skipped": [],
  "failed": [{ "id": "b1111111-1111-4111-8111-111111111203", "reason": "invalid reading" }],
  "alerts_created": 1
}
```

`captured_at` must fall inside the session, within 5 minutes of the future, and within 90 days. Temperature alerts use the mean of earlier localized readings in the session. Humidity and moisture use the configured absolute thresholds. New alerts are created only for rows that were uploaded.

## POST /v1/mobile/sessions

Patient only. The client supplies the session UUID so a retry is safe. Same id returns `200` and `created: false`. A second open session returns 409.

```json
{
  "id": "77777777-7777-4777-8777-777777777777",
  "device_serial": "ESP32-001",
  "started_at": "2026-09-22T12:00:00.000Z",
  "simulated_wound_label": "Simulated dressing, left forearm"
}
```

## POST /v1/mobile/sessions/{sessionId}/end

Patient, assigned clinician, or admin. Body may be `{}` or `{ "ended_at": "2026-09-22T16:00:00.000Z" }`. Outcome is `completed` or `already_completed`.

## GET /v1/patients/me/summary

Patient only. Returns `disclaimer`, `indication` (`led`, `buzzer`, `status`, `label`), `device`, `current_session`, `latest_reading`, `trend`, and `open_indicators`.

## GET /v1/clinician/patients

Doctor or nurse sees assigned patients. Admin sees patients. Each row has `id`, `full_name`, `monitoring_status`, and `open_alert_count`.

## GET /v1/clinician/patients/{patientId}/monitoring

Assigned doctor or nurse, the patient, or an admin. Returns sessions, the latest readings (default 50), notes, and indicator alerts, plus the disclaimer.

## POST /v1/alerts/{alertId}/acknowledge

Assigned doctor or nurse, or an admin. Empty object body. A patient receives 403. A resolved indicator returns 409. Acknowledging again returns the current row.

## POST /v1/notes

Assigned doctor or nurse, or an admin. Text that contains `infection detected` or `diagnosed` is rejected.

```json
{
  "patient_id": "44444444-4444-4444-8444-444444444444",
  "note_text": "Relative moisture indicator reviewed. Continue simulated monitoring."
}
```

## POST /v1/admin/devices/assign

Admin. `{ "device_id", "patient_id" }`. Sets pairing to paired.

## POST /v1/admin/assignments

Admin. `{ "clinician_id", "patient_id", "assignment_role": "doctor" | "nurse" }`.

## POST /v1/admin/roles

Admin. `{ "profile_id", "role" }`. An admin cannot change their own role.

## POST /v1/admin/alert-rules

Admin. Scope is `global`, `patient`, or `device`. A specific enabled rule replaces global rules for that patient or device. At least one of `temperature_delta_threshold`, `humidity_threshold`, or `moisture_threshold` is required.

Machine-readable paths are in [openapi.yaml](openapi.yaml).
