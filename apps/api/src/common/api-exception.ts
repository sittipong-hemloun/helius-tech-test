import { HttpException } from '@nestjs/common';

export interface FieldErrorDetail {
  field: string;
  code: string;
  message: string;
}

/**
 * Application error carrying a stable machine code (PRD §10.5).
 * `extra` adds safe top-level fields to the error object (e.g. currentVersion).
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldErrorDetail[],
    public readonly extra?: Record<string, unknown>,
    public readonly headers?: Record<string, string>,
  ) {
    super({ code, message }, status);
  }
}

export const Errors = {
  validation: (details: FieldErrorDetail[]) =>
    new ApiException(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', details),
  invalidQuery: (details: FieldErrorDetail[]) =>
    new ApiException(400, 'INVALID_QUERY', 'The query parameters are not valid.', details),
  employeeNotFound: () => new ApiException(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.'),
  versionConflict: (currentVersion?: number) =>
    new ApiException(
      409,
      'VERSION_CONFLICT',
      'This employee was changed by another user. Reload the latest version.',
      undefined,
      currentVersion === undefined ? undefined : { currentVersion },
    ),
  preconditionRequired: () =>
    new ApiException(428, 'PRECONDITION_REQUIRED', 'Send If-Match with the employee version you edited.'),
  idempotencyKeyInvalid: () =>
    new ApiException(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key header must be a UUID.'),
  idempotencyConflict: () =>
    new ApiException(409, 'IDEMPOTENCY_CONFLICT', 'This Idempotency-Key was already used with a different request.'),
  rateLimited: (retryAfterSeconds: number) =>
    new ApiException(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.', undefined, undefined, {
      'Retry-After': String(retryAfterSeconds),
    }),
  dependencyUnavailable: () =>
    new ApiException(503, 'DEPENDENCY_UNAVAILABLE', 'A required service is unavailable. Try again shortly.'),
};
