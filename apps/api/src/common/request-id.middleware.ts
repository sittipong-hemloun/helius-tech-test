import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AppRequest } from './request-context.js';
import type { JsonLogger } from './json-logger.js';

/**
 * Assigns a server-generated UUID to every request (caller-supplied X-Request-Id is
 * ignored — PRD §10.1) and writes one access-log line when the response finishes.
 */
export function requestContextMiddleware(logger: JsonLogger) {
  return (req: AppRequest, res: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const routeTemplate = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
      logger.write(res.statusCode >= 500 ? 'error' : 'info', 'request', {
        requestId: req.requestId,
        method: req.method,
        routeTemplate,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        errorCode: res.locals.errorCode,
      });
    });
    next();
  };
}
