import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { requestIdFrom } from "./app.js";
import type { HttpRequest, HttpResponse } from "./http.js";

function normalizePath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
  return withSlash;
}

export function toHttpRequest(event: APIGatewayProxyEventV2): HttpRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (typeof value === "string") headers[key.toLowerCase()] = value;
  }
  const bodyText = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body
    : null;
  return {
    method: event.requestContext.http.method.toUpperCase(),
    path: normalizePath(event.rawPath || event.requestContext.http.path || "/"),
    headers,
    query: event.queryStringParameters ?? {},
    bodyText,
    requestId: requestIdFrom(headers["x-request-id"], event.requestContext.requestId),
  };
}

export function toLambdaResult(response: HttpResponse): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: response.status,
    headers: response.headers,
    body: response.body == null ? "" : JSON.stringify(response.body),
  };
}
