import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { inject } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { FakeClock } from '../../src/common/clock.js';
import { JsonLogger } from '../../src/common/json-logger.js';
import { loadConfig, type AppConfig } from '../../src/config/app-config.js';
import { createPrismaClient } from '../../src/database/prisma.service.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { RateLimiter } from '../../src/auth/rate-limiter.js';
import { seedOriginal } from '../../src/seed/seed-original.js';
import { createFixtureSession, type FixtureSession } from '../../src/testing/session-fixture.js';

export const ADMIN_EMAIL = 'admin@example.test';
export const VIEWER_EMAIL = 'viewer@example.test';
export const ORIGIN = 'http://localhost:3000';
export const WORKER_TOKEN = 'worker-token-for-tests-0123456789abcdef';
export const SCHEDULER_TOKEN = 'scheduler-token-for-tests-0123456789abcd';

export function testEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'test',
    NODE_ENV: 'test',
    APP_TIMEZONE: 'Asia/Bangkok',
    PUBLIC_APP_ORIGIN: ORIGIN,
    DATABASE_URL: inject('testDatabaseUrl'),
    SESSION_SECRET: 'test-session-secret-that-is-at-least-32-chars',
    ADMIN_EMAILS: ADMIN_EMAIL,
    VIEWER_EMAILS: VIEWER_EMAIL,
    AUTH_FIXTURES_ENABLED: 'true',
    REPORTS_ENABLED: 'true',
    REPORT_MAINTENANCE_ENABLED: 'false',
    RATE_LIMIT_ENABLED: 'false',
    WORKER_SERVICE_TOKEN: WORKER_TOKEN,
    SCHEDULER_SERVICE_TOKEN: SCHEDULER_TOKEN,
    GEMINI_MODEL: 'gemini-flash-lite-latest',
    LOG_LEVEL: 'error',
    ...overrides,
  };
}

export interface TestContext {
  app: NestExpressApplication;
  config: AppConfig;
  clock: FakeClock;
  prisma: PrismaClient;
  http: ReturnType<typeof request>;
  /** http://127.0.0.1:<port> of the listening test app. */
  baseUrl: string;
  close: () => Promise<void>;
}

/** Fixed "now": 2026-10-01 10:00 Bangkok (03:00Z), matching the PRD examples. */
export const DEFAULT_NOW = '2026-10-01T03:00:00.000Z';

export async function startApp(envOverrides: Record<string, string> = {}, now = DEFAULT_NOW): Promise<TestContext> {
  const config = loadConfig(testEnv(envOverrides));
  const clock = new FakeClock(new Date(now));
  const app = await createApp(config, { clock, logger: new JsonLogger('test', config.logLevel) });
  // Listen once on an explicit loopback port. Passing the bare server to supertest makes it
  // bind a new wildcard ephemeral port per request, which occasionally collided with another
  // local process bound to 127.0.0.1 on that port (requests then hit the wrong server: 404).
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as { port: number };
  const prisma = createPrismaClient(config.databaseUrl, 3);
  return {
    app,
    config,
    clock,
    prisma,
    http: request(`http://127.0.0.1:${port}`),
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

/** Clean slate: Excel seed only, IDs restart so the next employee is 106. */
export async function resetData(ctx: TestContext): Promise<void> {
  await ctx.prisma.$executeRawUnsafe(
    'TRUNCATE reports, idempotency_keys, sessions, employees, integration_state, users RESTART IDENTITY CASCADE',
  );
  await ctx.prisma.$executeRawUnsafe('ALTER TABLE employees ALTER COLUMN id RESTART WITH 1');
  await seedOriginal(ctx.prisma, ctx.clock.now());
  ctx.app.get(RateLimiter).reset();
}

export async function login(ctx: TestContext, email: string, opts: { now?: Date; idleMs?: number; absoluteMs?: number } = {}): Promise<FixtureSession> {
  return createFixtureSession(ctx.prisma, ctx.config, { email, now: opts.now ?? ctx.clock.now(), ...opts });
}

/** Headers for a cookie-authenticated mutation from the app origin. */
export function asUser(s: FixtureSession, extra: Record<string, string> = {}) {
  return { Cookie: s.cookieHeader, 'X-CSRF-Token': s.csrfToken, Origin: ORIGIN, ...extra };
}
