import { loginPatient, registerPatient } from "../auth/patient-auth.js";
import { loginSchema, parseWith, registerSchema } from "../domain/schemas.js";
import { json, type HttpRequest, type HttpResponse } from "../http.js";
import { invalid, readJson } from "./shared.js";

export async function registerAccount(request: HttpRequest): Promise<HttpResponse> {
  const parsed = parseWith(registerSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  const session = await registerPatient(process.env, parsed.value);
  return json(201, { session });
}

export async function loginAccount(request: HttpRequest): Promise<HttpResponse> {
  const parsed = parseWith(loginSchema, readJson(request));
  if (!parsed.ok) invalid(parsed);
  const session = await loginPatient(process.env, parsed.value);
  return json(200, { session });
}
