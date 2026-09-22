import type { Access } from "../domain/authz.js";
import { LIMITS } from "../domain/limits.js";
import type { ParseResult } from "../domain/schemas.js";
import { ApiError } from "../errors.js";
import type { HttpRequest } from "../http.js";

export function reject(access: Access): never {
  if (access.ok) throw new ApiError(500, "internal_error", "The request could not be completed.");
  throw new ApiError(access.status, access.code, access.message);
}

export function invalid(result: ParseResult<unknown>): never {
  if (result.ok) throw new ApiError(500, "internal_error", "The request could not be completed.");
  throw new ApiError(400, "validation_error", result.message, result.details);
}

export function readJson(request: HttpRequest): unknown {
  if (request.bodyText && request.bodyText.length > LIMITS.bodyMaxChars) {
    throw new ApiError(400, "validation_error", "Request body is too large.");
  }
  if (!request.bodyText) return {};
  try {
    return JSON.parse(request.bodyText) as unknown;
  } catch {
    throw new ApiError(400, "validation_error", "Request body must be JSON.");
  }
}
