import { z } from 'zod';

/**
 * Typed runtime configuration (PRD §13.2). Every timeout/limit used by the app is
 * defined here with the PRD default so business code never carries magic numbers.
 * Validation runs at startup; an invalid environment stops the process.
 */
const APP_ENVS = ['local', 'staging', 'test', 'performance'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export interface AppConfig {
  appEnv: AppEnv;
  nodeEnv: string;
  timezone: string;
  publicAppOrigin: string;
  port: number;
  host: string;
  databaseUrl: string;
  dbPoolMax: number;
  trustProxy: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  rateLimits: {
    enabled: boolean;
    windowMs: number;
    readPerWindow: number;
    writePerWindow: number;
  };
  idempotencyTtlMs: number;
  bodyLimits: { default: string };
  build: { commitSha: string; appVersion: string };
}

const MINUTE = 60_000;

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v === 'true' || v === '1'));

const envSchema = z.object({
  APP_ENV: z.enum(APP_ENVS).default('local'),
  NODE_ENV: z.string().default('development'),
  APP_TIMEZONE: z.string().default('Asia/Bangkok'),
  PUBLIC_APP_ORIGIN: z.string().default('http://localhost:3000'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  // "private-1hop": trust only the immediate proxy (Next.js) and only when it connects from a
  // loopback/private address, so client-supplied X-Forwarded-For entries are never believed.
  TRUST_PROXY: z.string().default('private-1hop'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PERF_RATE_LIMIT_OVERRIDE: bool(false),
  RATE_LIMIT_ENABLED: bool(true),
  BUILD_COMMIT_SHA: z.string().default('unknown'),
  APP_VERSION: z.string().default('1.0.0'),
});

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  const e = parsed.data;
  const problems: string[] = [];

  let origin: URL | null = null;
  try {
    origin = new URL(e.PUBLIC_APP_ORIGIN);
    if (origin.origin !== e.PUBLIC_APP_ORIGIN.replace(/\/$/, '')) {
      problems.push('PUBLIC_APP_ORIGIN must be an origin only (scheme://host[:port]) without a path');
    }
  } catch {
    problems.push('PUBLIC_APP_ORIGIN must be a valid URL origin');
  }
  const publicAppOrigin = origin?.origin ?? 'http://localhost:3000';
  if (origin && origin.protocol !== 'https:' && !LOOPBACK_HOSTS.has(origin.hostname)) {
    problems.push('PUBLIC_APP_ORIGIN must use HTTPS unless it is a loopback address (PRD §11.4)');
  }

  try {
    if (!Intl.supportedValuesOf('timeZone').includes(e.APP_TIMEZONE) && e.APP_TIMEZONE !== 'UTC') {
      problems.push(`APP_TIMEZONE "${e.APP_TIMEZONE}" is not a known IANA time zone`);
    }
  } catch {
    // Intl.supportedValuesOf is available on Node 24; ignore on exotic runtimes.
  }

  if (!e.RATE_LIMIT_ENABLED && e.APP_ENV !== 'test') {
    problems.push('RATE_LIMIT_ENABLED=false is only allowed when APP_ENV=test (performance uses PERF_RATE_LIMIT_OVERRIDE)');
  }
  if (e.PERF_RATE_LIMIT_OVERRIDE && e.APP_ENV !== 'performance') {
    problems.push('PERF_RATE_LIMIT_OVERRIDE=true is only allowed when APP_ENV=performance');
  }


  if (problems.length > 0) throw new ConfigError(problems);

  const rateLimitsEnabled = e.RATE_LIMIT_ENABLED && !e.PERF_RATE_LIMIT_OVERRIDE;

  return {
    appEnv: e.APP_ENV,
    nodeEnv: e.NODE_ENV,
    timezone: e.APP_TIMEZONE,
    publicAppOrigin,
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL,
    dbPoolMax: e.DB_POOL_MAX,
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    rateLimits: {
      enabled: rateLimitsEnabled,
      windowMs: MINUTE,
      readPerWindow: 300,
      writePerWindow: 60,
    },
    idempotencyTtlMs: 24 * 60 * MINUTE,
    bodyLimits: { default: '32kb' },
    build: { commitSha: e.BUILD_COMMIT_SHA, appVersion: e.APP_VERSION },
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
