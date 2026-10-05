import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApiException } from './api-exception.js';
import type { JsonLogger } from './json-logger.js';
import type { AppRequest } from './request-context.js';

const STATUS_CODES: Record<number, { code: string; message: string }> = {
  400: { code: 'BAD_REQUEST', message: 'The request is not valid.' },
  404: { code: 'NOT_FOUND', message: 'The requested resource does not exist.' },
  405: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Send the body as application/json.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' },
};

interface BodyParserError {
  type?: string;
  status?: number;
}

function isDbUnavailable(err: unknown): boolean {
  const e = err as { code?: string; name?: string; message?: string; cause?: { code?: string } } | null;
  if (!e) return false;
  const codes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'P1001', 'P1002', 'P1017', '57P01', '57P03', '53300'];
  return (
    codes.includes(e.code ?? '') ||
    codes.includes(e.cause?.code ?? '') ||
    e.name === 'PrismaClientInitializationError' ||
    /DatabaseNotReachable|Can't reach database|connect ECONNREFUSED/i.test(e.message ?? '')
  );
}

/** Maps every error to the PRD error envelope; never leaks stack traces or input values. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AppRequest>();
    const requestId = req.requestId;

    let status = 500;
    let body: Record<string, unknown> = { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again or share the request ID.' };
    let headers: Record<string, string> | undefined;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      body = { code: exception.code, message: (exception.getResponse() as { message: string }).message };
      if (exception.details) body.details = exception.details;
      if (exception.extra) Object.assign(body, exception.extra);
      headers = exception.headers;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = { ...(STATUS_CODES[status] ?? { code: 'HTTP_ERROR', message: 'The request failed.' }) };
      // Nest wraps body-parser SyntaxErrors in BadRequestException; never echo the parser message.
      const original = (exception.getResponse() as { message?: unknown })?.message;
      if (status === 400 && /JSON/i.test(String(original))) {
        body = { code: 'MALFORMED_JSON', message: 'The request body is not valid JSON.' };
      }
    } else if ((exception as BodyParserError)?.type === 'entity.too.large') {
      status = 413;
      body = { ...STATUS_CODES[413] };
    } else if ((exception as BodyParserError)?.type === 'entity.parse.failed') {
      status = 400;
      body = { code: 'MALFORMED_JSON', message: 'The request body is not valid JSON.' };
    } else if ((exception as BodyParserError)?.type === 'charset.unsupported' || (exception as BodyParserError)?.type === 'encoding.unsupported') {
      status = 415;
      body = { ...STATUS_CODES[415] };
    } else if (isDbUnavailable(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      body = { code: 'DEPENDENCY_UNAVAILABLE', message: 'A required service is unavailable. Try again shortly.' };
    }

    if (status >= 500) {
      const err = exception as Error;
      this.logger.write('error', 'unhandled_error', {
        requestId,
        errorName: err?.name,
        errorCode: body.code,
        // Message only (no stack, no request data); Prisma messages can include values, so trim.
        errorMessage: typeof err?.message === 'string' ? err.message.slice(0, 200) : undefined,
      });
    }

    res.locals.errorCode = body.code;
    if (headers) for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json({ error: { ...body, requestId } });
  }
}
