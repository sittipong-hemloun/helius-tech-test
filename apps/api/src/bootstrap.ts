import 'reflect-metadata';
import './auth/session-types.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import connectPgSimple from 'connect-pg-simple';
import express, { type NextFunction, type Response } from 'express';
import session from 'express-session';
import type pg from 'pg';
import { AppModule } from './app.module.js';
import { AccessPolicyService } from './auth/access-policy.service.js';
import { isAbsolutelyExpired } from './auth/session-helpers.js';
import { Clock, SystemClock } from './common/clock.js';
import { EnvelopeInterceptor } from './common/envelope.interceptor.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { JsonLogger } from './common/json-logger.js';
import type { AppRequest } from './common/request-context.js';
import { requestContextMiddleware } from './common/request-id.middleware.js';
import type { AppConfig } from './config/app-config.js';
import { SESSION_POOL } from './database/session-pool.js';

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
    .setDescription(
      'NestJS API for Employee Console. Browser clients authenticate with the session cookie (Google OIDC) ' +
        'and send X-CSRF-Token on mutations. /internal/v1 is for the n8n worker/scheduler (bearer tokens).',
    )
    .setVersion(config.build.appVersion)
    .addCookieAuth(config.session.cookieName)
    .addBearerAuth()
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
  });

  app.set('trust proxy', config.trustProxy);
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
  app.use('/internal', express.json({ limit: config.bodyLimits.callback }));
  app.use(express.json({ limit: config.bodyLimits.default }));

  // Sessions for browser routes only; internal endpoints never read cookies.
  const PgStore = connectPgSimple(session);
  const pool = app.get<pg.Pool>(SESSION_POOL);
  app.use(
    '/api',
    session({
      store: new PgStore({ pool, tableName: 'sessions', createTableIfMissing: false, pruneSessionInterval: 15 * 60 }),
      name: config.session.cookieName,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      unset: 'destroy',
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.session.secure,
        path: '/',
        maxAge: config.session.idleTimeoutMs,
      },
    }),
  );

  if (options.swagger !== false) {
    const policy = app.get(AccessPolicyService);
    // OpenAPI UI/document are Admin-only; no interactive login bypass (PRD §10.2).
    app.use(['/api/docs', '/api/openapi.json'], (req: AppRequest, res: Response, next: NextFunction) => {
      const auth = req.session?.auth;
      if (!auth || isAbsolutelyExpired(auth.absoluteExpiresAt, clock.now())) {
        return errorBody(res, req, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
      }
      if (policy.roleFor(auth.email) !== 'ADMIN') return errorBody(res, req, 403, 'FORBIDDEN', 'Admin role required.');
      next();
    });
    const document = buildOpenApiDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/openapi.json',
      yamlDocumentUrl: undefined,
      swaggerOptions: { withCredentials: true },
    });
  }

  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.enableShutdownHooks();
  return app;
}
