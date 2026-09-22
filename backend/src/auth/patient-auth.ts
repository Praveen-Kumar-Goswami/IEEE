import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readConfig } from "../config.js";
import { ApiError } from "../errors.js";

export type PatientSession = {
  access_token: string;
  refresh_token: string;
  email: string;
  full_name: string;
  phone: string;
};

type FetchLike = typeof fetch;

type AuthResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function registerPatient(
  env: NodeJS.ProcessEnv,
  input: { full_name: string; phone: string; email: string; password: string },
  fetchImpl?: FetchLike,
): Promise<PatientSession> {
  const created = await authRequest(env, "/auth/v1/admin/users", {
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, phone: input.phone },
  }, fetchImpl);
  if (created.status === 422 || /already.*(registered|exists)|email_exists|user_already_exists/i.test(textOf(created.body))) {
    throw new ApiError(409, "conflict", "An account with this email already exists. Sign in instead.");
  }
  if (created.status >= 400) throw new ApiError(400, "validation_error", accountFailure(created.body));
  return loginPatient(env, { email: input.email, password: input.password, full_name: input.full_name, phone: input.phone }, fetchImpl);
}

export async function loginPatient(
  env: NodeJS.ProcessEnv,
  input: { email: string; password: string; full_name?: string; phone?: string },
  fetchImpl?: FetchLike,
): Promise<PatientSession> {
  const result = await authRequest(env, "/auth/v1/token?grant_type=password", {
    email: input.email,
    password: input.password,
  }, fetchImpl);
  if (result.status === 400 || result.status === 401) {
    const text = textOf(result.body);
    if (/invalid api key|unauthorized|no api key/i.test(text)) {
      throw new ApiError(500, "configuration_error", "The server rejected the Supabase service role key.");
    }
    throw new ApiError(401, "unauthorized", "Email or password is incorrect.");
  }
  if (result.status >= 400) throw new ApiError(500, "internal_error", accountFailure(result.body));
  const token = stringField(result.body, "access_token");
  const refresh = stringField(result.body, "refresh_token");
  if (!token || !refresh) throw new ApiError(500, "internal_error", "Sign in could not be completed.");
  const user = result.body.user;
  const metadata = user && typeof user === "object" ? (user as { user_metadata?: Record<string, unknown> }).user_metadata : undefined;
  return {
    access_token: token,
    refresh_token: refresh,
    email: input.email,
    full_name: input.full_name || stringField(metadata, "full_name") || "Patient",
    phone: input.phone || stringField(metadata, "phone") || "",
  };
}

async function authRequest(env: NodeJS.ProcessEnv, path: string, body: unknown, fetchImpl: FetchLike): Promise<AuthResult> {
  const config = readConfig(env);
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new ApiError(500, "configuration_error", "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the Lambda function.");
  }
  const supabaseUrl = config.supabaseUrl.replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
    throw new ApiError(500, "configuration_error", "SUPABASE_URL must look like https://PROJECT.supabase.co");
  }
  let response: { status: number; json: () => Promise<unknown> };
  try {
    response = await (fetchImpl ?? nodeFetch)(`${supabaseUrl}${path}`, {
      method: "POST",
      headers: {
        apikey: config.supabaseServiceRoleKey,
        authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
    throw new ApiError(502, "configuration_error", `Could not reach Supabase. ${reason}${cause ? ` (${cause})` : ""}`.slice(0, 180));
  }
  const parsed = await response.json().catch(() => ({}));
  return { status: response.status, body: parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {} };
}

function nodeFetch(url: string, init?: RequestInit): Promise<Response> {
  const target = new URL(url);
  const payload = typeof init?.body === "string" ? init.body : "";
  const headers = { ...(init?.headers as Record<string, string> | undefined), "content-length": String(Buffer.byteLength(payload)) };
  const transport = target.protocol === "http:" ? httpRequest : httpsRequest;
  return new Promise((resolve, reject) => {
    const req = transport(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: init?.method ?? "POST",
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve(new Response(text, { status: res.statusCode ?? 500 }));
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function stringField(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || !(key in value)) return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : "";
}

function textOf(body: Record<string, unknown>): string {
  return [body.msg, body.message, body.error_description, body.error_code, body.code]
    .filter((item) => typeof item === "string")
    .join(" ");
}

function accountFailure(body: Record<string, unknown>): string {
  const text = textOf(body);
  if (/database error|relation |handle_new_user|profiles/i.test(text)) {
    return "The account could not be saved. Apply the database migrations on the Supabase project, then register again.";
  }
  if (/invalid api key|unauthorized|no api key/i.test(text)) {
    return "The server rejected the Supabase service role key. Check SUPABASE_SERVICE_ROLE_KEY on Lambda.";
  }
  return "The account could not be created. Check the email, phone, and password, then try again.";
}
