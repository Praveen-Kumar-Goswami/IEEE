export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "internal_error"
  | "configuration_error";

export type FieldIssue = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: FieldIssue[];

  constructor(status: number, code: ErrorCode, message: string, details?: FieldIssue[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.message && !/eyJ[\w.-]{20,}|sb_secret_/i.test(error.message)) {
    return new ApiError(500, "internal_error", error.message.slice(0, 180));
  }
  return new ApiError(500, "internal_error", "The request could not be completed.");
}
