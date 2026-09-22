import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { toHttpRequest, toLambdaResult } from "./lambda.js";
import { createRuntime } from "./runtime.js";

type Handle = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

function failed(message: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 500,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      error: { code: "configuration_error", message },
    }),
  };
}

let handle: Handle | null = null;
let startupError: string | null = null;

try {
  const app = createRuntime(process.env);
  handle = async (event) => toLambdaResult(await app(toHttpRequest(event)));
} catch {
  startupError = "The API is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (!handle) return failed(startupError ?? "The API is not configured.");
  try {
    return await handle(event);
  } catch {
    return failed("The request could not be completed.");
  }
}
