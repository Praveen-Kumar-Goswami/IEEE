# Smart dressing indicator API

IEEE MEDHA 2026 prototype for noninvasive monitoring of a **simulated** dressing. It logs localized temperature (DS18B20), ambient temperature and humidity (BME280), and a copper-tape relative moisture count. LEDs and a buzzer show predefined changes. It does not diagnose surgical-site infection and it does not make a clinical decision.

The patient Android app is in `mobile`. The clinician website is in `web`. Staff sign in once through the Lambda `POST /v1/auth/login` route, then open the doctor, nurse, or admin workspace from the same session.

## Layout

- `supabase/migrations` — schema, row level security, and demo seed
- `backend` — TypeScript API for API Gateway
- `mobile` — Android patient app
- `web` — clinician website (doctor, nurse, and admin workspaces)
- `docs` — problem statement, hardware, architecture, API, database, deployment

## Deploy on AWS Lambda

From `backend`, `npm run package:lambda` writes `dist/lambda.zip`. Create a Node.js 22 function, upload that zip, and set the handler to `handler.handler`. Put `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ALLOWED_ORIGINS`, and `LOG_LEVEL` in the function environment. Then add a Function URL or an API Gateway HTTP API. Steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Android app

`mobile` is the patient app. It talks to the deployed Lambda URL and keeps readings in SQLite until sync. Build output:

`mobile/build/app/outputs/flutter-apk/app-release.apk`

A copy is `smart-dressing.apk` in this folder. The first screen is sign in or register with name, phone, email, and password. Re-upload `smart-dressing-api-lambda.zip` before registering, and keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the function.

## Local API

```bash
cd backend
npm install
copy .env.example .env
npm test
npm run dev
```

`GET http://127.0.0.1:43127/health` works before Supabase credentials are set. Authenticated routes return `configuration_error` until `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Keep the service-role key on the server.

Do not run the migrations against the existing project `ASHA_DATABASE` (`fjrgoshacluiawqocarl`). Create a new Supabase project and follow [docs/DATABASE.md](docs/DATABASE.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Safety

Alerts say that a monitoring indicator changed and that clinical review is recommended. They do not say that an infection was detected or that a site was diagnosed.
