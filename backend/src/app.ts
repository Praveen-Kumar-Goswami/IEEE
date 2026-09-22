import { randomUUID } from "node:crypto";
import type { AppContext } from "./context.js";
import type { Database } from "./data/database.js";
import type { Actor } from "./domain/authz.js";
import { requireActor } from "./domain/authz.js";
import { LIMITS } from "./domain/limits.js";
import { ApiError, toApiError } from "./errors.js";
import { bearerToken, corsHeaders, json, safeRequestId, type HttpRequest, type HttpResponse } from "./http.js";
import type { Logger } from "./logger.js";
import * as auth from "./routes/auth.js";
import * as handlers from "./routes/handlers.js";
import { reject } from "./routes/shared.js";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

function open(handler: (request: HttpRequest) => Promise<HttpResponse>): Route["handle"] {
  return (ctx, params, request) => {
    void ctx;
    void params;
    return handler(request);
  };
}

type Route = {
  method: string;
  pattern: RegExp;
  auth: boolean;
  handle: (ctx: AppContext, params: Record<string, string>, request: HttpRequest) => Promise<HttpResponse>;
};

const routes: Route[] = [
  { method: "GET", pattern: /^\/health$/, auth: false, handle: async () => json(200, { status: "ok", service: "smart-dressing-api" }) },
  { method: "POST", pattern: /^\/v1\/auth\/register$/, auth: false, handle: open(auth.registerAccount) },
  { method: "POST", pattern: /^\/v1\/auth\/login$/, auth: false, handle: open(auth.loginAccount) },
  { method: "POST", pattern: /^\/v1\/mobile\/sync\/readings$/, auth: true, handle: (ctx, _p, request) => handlers.syncReadings(ctx, request) },
  { method: "POST", pattern: /^\/v1\/mobile\/sessions$/, auth: true, handle: (ctx, _p, request) => handlers.createSession(ctx, request) },
  { method: "POST", pattern: new RegExp(`^/v1/mobile/sessions/(?<id>${UUID})/end$`), auth: true, handle: (ctx, params, request) => handlers.endSession(ctx, request, params.id ?? "") },
  { method: "GET", pattern: /^\/v1\/patients\/me\/summary$/, auth: true, handle: (ctx) => handlers.patientSummary(ctx) },
  { method: "GET", pattern: /^\/v1\/clinician\/patients$/, auth: true, handle: (ctx) => handlers.clinicianPatients(ctx) },
  { method: "GET", pattern: new RegExp(`^/v1/clinician/patients/(?<patientId>${UUID})/monitoring$`), auth: true, handle: (ctx, params) => handlers.clinicianMonitoring(ctx, params.patientId ?? "") },
  { method: "POST", pattern: new RegExp(`^/v1/alerts/(?<alertId>${UUID})/acknowledge$`), auth: true, handle: (ctx, params, request) => handlers.acknowledgeAlert(ctx, request, params.alertId ?? "") },
  { method: "POST", pattern: /^\/v1\/notes$/, auth: true, handle: (ctx, _p, request) => handlers.createNote(ctx, request) },
  { method: "POST", pattern: /^\/v1\/admin\/devices\/assign$/, auth: true, handle: (ctx, _p, request) => handlers.assignDevice(ctx, request) },
  { method: "POST", pattern: /^\/v1\/admin\/assignments$/, auth: true, handle: (ctx, _p, request) => handlers.createAssignment(ctx, request) },
  { method: "POST", pattern: /^\/v1\/admin\/roles$/, auth: true, handle: (ctx, _p, request) => handlers.setRole(ctx, request) },
  { method: "POST", pattern: /^\/v1\/admin\/alert-rules$/, auth: true, handle: (ctx, _p, request) => handlers.createRule(ctx, request) },
];

export type AppDeps = {
  authenticate: (token: string) => Promise<Actor | null>;
  db: Database;
  logger: Logger;
  now?: () => Date;
  corsAllowedOrigins?: string[];
};

export function createApp(deps: AppDeps) {
  const allowed = deps.corsAllowedOrigins ?? [];
  const now = deps.now ?? (() => new Date());
  return async function handle(request: HttpRequest): Promise<HttpResponse> {
    const started = Date.now();
    try {
      const response = await dispatch(request);
      deps.logger.info({
        request_id: request.requestId,
        method: request.method,
        path: request.path,
        status: response.status,
        duration_ms: Date.now() - started,
      });
      return finish(request, response, allowed);
    } catch (error) {
      const api = toApiError(error);
      const fields = { request_id: request.requestId, method: request.method, path: request.path, status: api.status, code: api.code };
      if (api.status >= 500) deps.logger.error(fields);
      else deps.logger.info(fields);
      return finish(request, errorJson(api, request.requestId), allowed);
    }
  };

  async function dispatch(request: HttpRequest): Promise<HttpResponse> {
    if (request.bodyText && request.bodyText.length > LIMITS.bodyMaxChars) {
      throw new ApiError(400, "validation_error", "Request body is too large.");
    }
    if (request.method === "OPTIONS") return { status: 204, headers: {}, body: null };
    const matched = routes.filter((route) => route.pattern.test(request.path));
    const route = matched.find((item) => item.method === request.method);
    if (!route) {
      if (matched.length > 0) {
        return json(405, { error: { code: "validation_error", message: "Method is not allowed.", request_id: request.requestId } });
      }
      throw new ApiError(404, "not_found", "Route not found.");
    }
    const params = route.pattern.exec(request.path)?.groups ?? {};
    let actor: Actor | null = null;
    if (route.auth) {
      const token = bearerToken(request.headers.authorization);
      if (!token) throw new ApiError(401, "unauthorized", "Sign in is required.");
      actor = await deps.authenticate(token);
      const signedIn = requireActor(actor);
      if (!signedIn.ok) reject(signedIn);
    }
    if (route.auth && !actor) throw new ApiError(401, "unauthorized", "Sign in is required.");
    const ctx: AppContext = {
      actor: actor ?? { id: "00000000-0000-0000-0000-000000000000", role: "patient", fullName: "" },
      db: deps.db,
      now: now(),
      requestId: request.requestId,
      logger: deps.logger,
    };
    return route.handle(ctx, params, request);
  }
}

function errorJson(error: ApiError, requestId: string): HttpResponse {
  return json(error.status, {
    error: {
      code: error.code,
      message: error.message,
      request_id: requestId,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

function finish(request: HttpRequest, response: HttpResponse, allowed: string[]): HttpResponse {
  return {
    status: response.status,
    body: response.body,
    headers: {
      ...corsHeaders(request.headers.origin, allowed),
      "x-request-id": request.requestId,
      ...response.headers,
    },
  };
}

export function requestIdFrom(header: string | undefined, fallback?: string): string {
  return safeRequestId(header, fallback) ?? randomUUID();
}
