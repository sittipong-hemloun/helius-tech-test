import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import express, { type NextFunction, type Response } from 'express';
import { AppModule } from './app.module.js';
import { Clock, SystemClock } from './common/clock.js';
import { EnvelopeInterceptor } from './common/envelope.interceptor.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { JsonLogger } from './common/json-logger.js';
import type { AppRequest } from './common/request-context.js';
import { requestContextMiddleware } from './common/request-id.middleware.js';
import type { AppConfig } from './config/app-config.js';

const PRIVATE_OR_LOOPBACK = /^(127\.|::1$|::ffff:127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80:|::ffff:10\.|::ffff:192\.168\.|::ffff:172\.(1[6-9]|2\d|3[01])\.)/i;

/**
 * Express trust-proxy policy. Default "private-1hop": the socket peer (hop 0) is trusted only when it
 * is loopback/private (our Next.js proxy), and nothing beyond it — so req.ip becomes the address the
 * proxy saw, and extra X-Forwarded-For entries sent by a client are ignored (PRD §11.4).
 */
export function trustProxySetting(value: string): string | ((addr: string, hop: number) => boolean) {
  if (value !== 'private-1hop') return value;
  return (addr, hop) => hop === 0 && PRIVATE_OR_LOOPBACK.test(addr);
}

export interface CreateAppOptions {
  clock?: Clock;
  logger?: JsonLogger;
  /** Skip Swagger UI wiring (OpenAPI generation script builds the document itself). */
  swagger?: boolean;
}

function errorBody(res: Response, req: AppRequest, status: number, code: string, message: string): void {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json({ error: { code, message, requestId: req.requestId } });
}

export function buildOpenApiDocument(app: NestExpressApplication, config: AppConfig): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Employee Console API')
    .setDescription('NestJS API for Employee Console.')
    .setVersion(config.build.appVersion)
    .build();
  return SwaggerModule.createDocument(app, builder, { operationIdFactory: (controller, method) => `${controller.replace(/Controller$/, '')}_${method}` });
}

export async function createApp(config: AppConfig, options: CreateAppOptions = {}): Promise<NestExpressApplication> {
  const logger = options.logger ?? new JsonLogger(config.appEnv, config.logLevel);
  const clock = options.clock ?? new SystemClock();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config, clock, logger), {
    bodyParser: false,
    logger,
    abortOnError: false,
    // Graceful shutdown (PRD §13.4): once SIGTERM arrives, new requests get 503 + Connection: close;
    // DB pools close only after the HTTP server stopped (onApplicationShutdown hooks).
    return503OnClosing: true,
  });

  app.set('trust proxy', trustProxySetting(config.trustProxy));
  app.disable('x-powered-by');
  app.use(requestContextMiddleware(logger));
  app.use((_req: AppRequest, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  // JSON only; bodies above the limits are rejected with 413 (PRD §10.1).
  app.use((req: AppRequest, res: Response, next: NextFunction) => {
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
    if (hasBody && ['POST', 'PATCH', 'PUT'].includes(req.method) && !req.is('application/json')) {
      return errorBody(res, req, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the body as application/json.');
    }
    next();
  });
  app.use(express.json({ limit: config.bodyLimits.default }));

  if (options.swagger !== false) {
    const document = buildOpenApiDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/openapi.json',
      // JSON only: @nestjs/swagger would otherwise also serve /api/docs-yaml by default.
      raw: ['json'],
    });
  }

  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.enableShutdownHooks();
  return app;
}
