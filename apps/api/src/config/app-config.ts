import { z } from 'zod';

/**
 * Typed runtime configuration (PRD §13.2). Every timeout/limit used by the app is
 * defined here with the PRD default so business code never carries magic numbers.
 * Validation runs at startup; an invalid environment stops the process.
 */
export const APP_ENVS = ['local', 'staging', 'test', 'performance'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const PROMPT_VERSION = 'employee-summary-v1';

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
  session: {
    secret: string;
    cookieName: string;
    secure: boolean;
    idleTimeoutMs: number;
    absoluteTimeoutMs: number;
    loginStateTtlMs: number;
  };
  google: {
    configured: boolean;
  };
  access: {
    adminEmails: ReadonlySet<string>;
    viewerEmails: ReadonlySet<string>;
  };
  reports: {
    enabled: boolean;
    model: string;
    promptVersion: string;
    leaseMs: number;
    maxAttempts: number;
    backoffMs: readonly number[];
    deadlineMs: number;
    manualQuotaPerHour: number;
    workerStaleMs: number;
    maintenanceIntervalMs: number;
    maintenanceEnabled: boolean;
  };
  serviceTokens: {
    worker: string | null;
    scheduler: string | null;
  };
  rateLimits: {
    enabled: boolean;
    windowMs: number;
    readPerWindow: number;
    writePerWindow: number;
    authStartPerWindow: number;
    claimPerWindow: number;
  };
  idempotencyTtlMs: number;
  bodyLimits: { default: string; callback: string };
  authFixturesEnabled: boolean;
  build: { commitSha: string; appVersion: string };
}

const MINUTE = 60_000;

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v === 'true' || v === '1'));

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : null));

const emailList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((e) => normalizeEmail(e))
      .filter((e) => e.length > 0),
  );

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_COOKIE_NAME: z.string().optional(),
  ADMIN_EMAILS: emailList,
  VIEWER_EMAILS: emailList,
  REPORTS_ENABLED: bool(false),
  GEMINI_MODEL: z.string().default('gemini-flash-lite-latest'),
  WORKER_SERVICE_TOKEN: optionalSecret,
  SCHEDULER_SERVICE_TOKEN: optionalSecret,
  REPORT_MAINTENANCE_ENABLED: bool(true),
  AUTH_FIXTURES_ENABLED: bool(false),
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
  const secure = origin?.protocol === 'https:';
  if (origin && !secure && !LOOPBACK_HOSTS.has(origin.hostname)) {
    problems.push('PUBLIC_APP_ORIGIN must use HTTPS unless it is a loopback address (PRD §11.4)');
  }

  try {
    if (!Intl.supportedValuesOf('timeZone').includes(e.APP_TIMEZONE) && e.APP_TIMEZONE !== 'UTC') {
      problems.push(`APP_TIMEZONE "${e.APP_TIMEZONE}" is not a known IANA time zone`);
    }
  } catch {
    // Intl.supportedValuesOf is available on Node 24; ignore on exotic runtimes.
  }

  const defaultAdmins = ['admin@chememan.com'];
  const defaultViewers = ['viewer@chememan.com'];
  const admins = new Set(e.ADMIN_EMAILS.length > 0 ? e.ADMIN_EMAILS : defaultAdmins);
  const viewers = new Set(e.VIEWER_EMAILS.length > 0 ? e.VIEWER_EMAILS : defaultViewers);
  const overlap = [...admins].filter((m) => viewers.has(m));
  if (overlap.length > 0) {
    // PRD §11.1 step 5: never guess which role wins.
    problems.push(`ADMIN_EMAILS and VIEWER_EMAILS overlap (${overlap.length} address(es)); each account needs exactly one role`);
  }

  if (e.AUTH_FIXTURES_ENABLED && e.APP_ENV !== 'test' && e.APP_ENV !== 'performance') {
    problems.push('AUTH_FIXTURES_ENABLED=true is only allowed when APP_ENV is test or performance (PRD §11.5)');
  }
  if (!e.RATE_LIMIT_ENABLED && e.APP_ENV !== 'test') {
    problems.push('RATE_LIMIT_ENABLED=false is only allowed when APP_ENV=test (performance uses PERF_RATE_LIMIT_OVERRIDE)');
  }
  if (e.PERF_RATE_LIMIT_OVERRIDE && e.APP_ENV !== 'performance') {
    problems.push('PERF_RATE_LIMIT_OVERRIDE=true is only allowed when APP_ENV=performance');
  }

  for (const [name, value] of [
    ['WORKER_SERVICE_TOKEN', e.WORKER_SERVICE_TOKEN],
    ['SCHEDULER_SERVICE_TOKEN', e.SCHEDULER_SERVICE_TOKEN],
  ] as const) {
    if (value !== null && value.length < 32) problems.push(`${name} must be at least 32 characters`);
  }
  if (e.WORKER_SERVICE_TOKEN && e.WORKER_SERVICE_TOKEN === e.SCHEDULER_SERVICE_TOKEN) {
    problems.push('WORKER_SERVICE_TOKEN and SCHEDULER_SERVICE_TOKEN must be different credentials');
  }
  if (e.REPORTS_ENABLED && !e.WORKER_SERVICE_TOKEN) {
    problems.push('REPORTS_ENABLED=true requires WORKER_SERVICE_TOKEN');
  }
  if (e.SESSION_SECRET.length >= 32 && /change-me|example|placeholder/i.test(e.SESSION_SECRET) && e.APP_ENV !== 'test') {
    problems.push('SESSION_SECRET still contains a placeholder value; run `pnpm run setup` to generate one');
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
    session: {
      secret: e.SESSION_SECRET,
      cookieName: e.SESSION_COOKIE_NAME?.trim() || `employee_console.${e.APP_ENV}.sid`,
      secure,
      idleTimeoutMs: 30 * MINUTE,
      absoluteTimeoutMs: 8 * 60 * MINUTE,
      loginStateTtlMs: 10 * MINUTE,
    },
    google: {
      configured: false,
    },
    access: { adminEmails: admins, viewerEmails: viewers },
    reports: {
      enabled: e.REPORTS_ENABLED,
      model: e.GEMINI_MODEL,
      promptVersion: PROMPT_VERSION,
      leaseMs: 120_000,
      maxAttempts: 3,
      backoffMs: [30_000, 60_000],
      deadlineMs: 10 * MINUTE,
      manualQuotaPerHour: 10,
      workerStaleMs: 60_000,
      maintenanceIntervalMs: 30_000,
      maintenanceEnabled: e.REPORT_MAINTENANCE_ENABLED,
    },
    serviceTokens: { worker: e.WORKER_SERVICE_TOKEN, scheduler: e.SCHEDULER_SERVICE_TOKEN },
    rateLimits: {
      enabled: rateLimitsEnabled,
      windowMs: MINUTE,
      readPerWindow: 300,
      writePerWindow: 60,
      authStartPerWindow: 10,
      claimPerWindow: 10,
    },
    idempotencyTtlMs: 24 * 60 * MINUTE,
    bodyLimits: { default: '32kb', callback: '8kb' },
    authFixturesEnabled: e.AUTH_FIXTURES_ENABLED,
    build: { commitSha: e.BUILD_COMMIT_SHA, appVersion: e.APP_VERSION },
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
