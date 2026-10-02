import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiProperty, ApiPropertyOptional, ApiResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * OpenAPI decorators that describe the runtime shapes (PRD §10.1, §10.5): every JSON success is
 * `{ data, meta }`, every error is `{ error: { code, message, details?, requestId } }`, and the
 * contract headers (X-Request-Id, ETag, Location, Idempotency-Replayed, Retry-After) are documented.
 */

export class MetaDto {
  @ApiProperty({ format: 'uuid' }) requestId: string;
}

export class PageMetaDto extends MetaDto {
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) pageSize: number;
  @ApiProperty({ example: 5 }) total: number;
  @ApiProperty({ example: 1, description: '0 when total is 0' }) totalPages: number;
}

export class EmployeeListMetaDto extends PageMetaDto {
  @ApiProperty({ enum: ['id', 'name', 'department', 'joinDate', 'isActive', 'lastUpdatedDate', 'salary'] }) sortBy: string;
  @ApiProperty({ enum: ['asc', 'desc'] }) sortOrder: string;
}

export class ChangedMetaDto extends MetaDto {
  @ApiProperty({ description: 'false when the PATCH matched the stored values after normalization (no write, same version)' })
  changed: boolean;
}

export class FieldErrorDto {
  @ApiProperty({ example: 'salary' }) field: string;
  @ApiProperty({ example: 'DECIMAL_SCALE_EXCEEDED' }) code: string;
  @ApiProperty({ example: 'Salary must have at most 2 decimal places.' }) message: string;
}

export class ErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' }) code: string;
  @ApiProperty({ example: 'Please correct the highlighted fields.' }) message: string;
  @ApiProperty({ format: 'uuid' }) requestId: string;
  @ApiPropertyOptional({ type: FieldErrorDto, isArray: true }) details?: FieldErrorDto[];
  @ApiPropertyOptional({ description: 'VERSION_CONFLICT only' }) currentVersion?: number;
}

export class ErrorEnvelopeDto {
  @ApiProperty({ type: ErrorBodyDto }) error: ErrorBodyDto;
}

const str = (description: string) => ({ description, schema: { type: 'string' as const } });

export const Headers = {
  requestId: { 'X-Request-Id': str('Server-generated UUID for this request') },
  etag: { ETag: str('Quoted employee version, e.g. "1" — send it back as If-Match') },
  location: { Location: str('Path of the created resource') },
  replayed: { 'Idempotency-Replayed': str('"true" when the response was replayed for a repeated Idempotency-Key') },
  retryAfter: { 'Retry-After': str('Seconds to wait before retrying') },
};

interface EnvelopeOptions {
  status?: number;
  isArray?: boolean;
  nullable?: boolean;
  meta?: Type<unknown>;
  description?: string;
  headers?: Record<string, { description: string; schema: { type: 'string' } }>;
}

export function ApiEnvelope(model: Type<unknown>, opts: EnvelopeOptions = {}) {
  const meta = opts.meta ?? MetaDto;
  const ref = { $ref: getSchemaPath(model) };
  const data = opts.isArray ? { type: 'array', items: ref } : opts.nullable ? { allOf: [ref], nullable: true } : ref;
  return applyDecorators(
    ApiExtraModels(model, meta),
    ApiResponse({
      status: opts.status ?? 200,
      description: opts.description ?? 'Success',
      headers: { ...Headers.requestId, ...(opts.headers ?? {}) },
      schema: { type: 'object', required: ['data', 'meta'], properties: { data, meta: { $ref: getSchemaPath(meta) } } },
    }),
  );
}

const ERROR_TEXT: Record<number, string> = {
  400: 'VALIDATION_ERROR / INVALID_QUERY / INVALID_IDEMPOTENCY_KEY / MALFORMED_JSON',
  404: 'EMPLOYEE_NOT_FOUND',
  409: 'VERSION_CONFLICT / IDEMPOTENCY_CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  428: 'PRECONDITION_REQUIRED (If-Match missing)',
  429: 'RATE_LIMITED',
  503: 'DEPENDENCY_UNAVAILABLE',
};

export function ApiErrors(...statuses: number[]) {
  return applyDecorators(
    ApiExtraModels(ErrorEnvelopeDto),
    ...[...statuses, 500].map((status) =>
      ApiResponse({
        status,
        description: status === 500 ? 'INTERNAL_ERROR' : ERROR_TEXT[status],
        headers: { ...Headers.requestId, ...(status === 429 ? Headers.retryAfter : {}) },
        schema: { $ref: getSchemaPath(ErrorEnvelopeDto) },
      }),
    ),
  );
}

export function ApiNoContent(description = 'No content') {
  return ApiResponse({ status: 204, description, headers: Headers.requestId });
}
