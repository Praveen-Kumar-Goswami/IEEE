# Deployment

Migrations were not applied. The only connected Supabase project is `ASHA_DATABASE` (`fjrgoshacluiawqocarl`, ap-south-1), and it already contains a different schema. Create a separate project, then run the three SQL files in `docs/DATABASE.md` with the Supabase SQL editor or:

```bash
supabase link --project-ref YOUR_NEW_PROJECT_REF
supabase db push
```

Set demo passwords from `backend` after the seed exists:

```bash
npm run seed:demo
```

That script reads `DEMO_ADMIN_PASSWORD`, `DEMO_DOCTOR_PASSWORD`, `DEMO_NURSE_PASSWORD`, and `DEMO_PATIENT_PASSWORD`. It does not print them.

## AWS Lambda

From `backend`:

```bash
npm install
npm run package:lambda
```

That writes two deployable files:

- `dist/lambda.zip` — upload this in the Lambda console. The zip root contains `handler.js` and `package.json`.
- `lambda-artifact/` — SAM copies this folder. It is the same two files.

Runtime `nodejs22.x`. Handler `handler.handler`. Architecture `arm64` or `x86_64` both run this JavaScript bundle. Timeout 15 seconds. Memory 256 MB.

Environment variables on the function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ALLOWED_ORIGINS` (use `*` for the mobile app and the staff site)
- `LOG_LEVEL` (`info`)

### Console

1. Lambda → Create function → Author from scratch → Node.js 22.x.
2. Upload `backend/dist/lambda.zip`.
3. Set the handler to `handler.handler` and the four environment variables.
4. Add a Function URL with auth type NONE, or an API Gateway HTTP API trigger with payload format 2.0 and routes `ANY /` and `ANY /{proxy+}`.

`GET /health` on that URL returns `{"status":"ok","service":"smart-dressing-api"}` before the database is used. Other routes need the Supabase URL and service-role key.

### SAM

The AWS CLI and SAM CLI are not installed on this machine, so no stack was deployed and there is no API URL yet. After they are installed, from `backend`:

```bash
npm run package:lambda
sam build
sam deploy --guided
```

SAM parameter names: `SupabaseUrl`, `SupabaseServiceRoleKey`, `CorsAllowedOrigins`, `LogLevel`.

The stack outputs `ApiUrl` (API Gateway) and `FunctionUrl` (Lambda function URL). Use either one. Do not commit a filled-in service-role key.

Local only: `PORT` (default `43127`) and the four `DEMO_*_PASSWORD` names.

`samconfig.toml.example` lists the parameter names with an empty service-role key. Do not commit a filled-in key. CORS is applied by the function. `GET /health` does not call Supabase.
