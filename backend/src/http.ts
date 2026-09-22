export type HttpRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string | undefined>;
  bodyText: string | null;
  requestId: string;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export function json(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    body,
  };
}

export function corsHeaders(origin: string | undefined, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    "access-control-allow-headers": "authorization, content-type, x-request-id",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
    "access-control-max-age": "600",
  };
  if (allowed.includes("*")) {
    headers["access-control-allow-origin"] = "*";
    return headers;
  }
  if (origin && allowed.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  return headers;
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match?.[1] || match[1].length > 8192) return null;
  return match[1];
}

const REQUEST_ID = /^[A-Za-z0-9._:-]{8,80}$/;

export function safeRequestId(...candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && REQUEST_ID.test(candidate)) return candidate;
  }
  return null;
}
