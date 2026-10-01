import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { ApiResponse } from './envelope.js';
import type { AppRequest } from './request-context.js';

/** Adds meta.requestId and `Cache-Control: no-store` to every JSON success response. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AppRequest>();
    const res = http.getResponse<Response>();
    return next.handle().pipe(
      map((value) => {
        if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store');
        if (value instanceof ApiResponse) {
          return { data: value.data, meta: { requestId: req.requestId, ...value.meta } };
        }
        return value;
      }),
    );
  }
}
