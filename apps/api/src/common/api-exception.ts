import { HttpException } from '@nestjs/common';

export interface FieldErrorDetail {
  field: string;
  code: string;
  message: string;
}

/**
 * Application error carrying a stable machine code (PRD §10.5).
 * `extra` adds safe top-level fields to the error object (e.g. currentReportId).
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
  unauthenticated: () => new ApiException(401, 'UNAUTHENTICATED', 'Sign in to continue.'),
  sessionExpired: () => new ApiException(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.'),
  forbidden: (message = 'You do not have permission to perform this action.') =>
    new ApiException(403, 'FORBIDDEN', message),
  accountNotAllowed: () =>
    new ApiException(403, 'ACCOUNT_NOT_ALLOWED', 'This account is not allowed to use Employee Console.'),
  csrfInvalid: () => new ApiException(403, 'CSRF_INVALID', 'The request could not be verified. Reload the page and try again.'),
  invalidServiceToken: () => new ApiException(401, 'INVALID_SERVICE_TOKEN', 'A valid service token is required.'),
  employeeNotFound: () => new ApiException(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.'),
  reportNotFound: () => new ApiException(404, 'REPORT_NOT_FOUND', 'Report not found.'),
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
