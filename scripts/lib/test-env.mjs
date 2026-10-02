// Shared helpers for E2E/Postman/perf runs: an isolated database marked with its purpose,
// an API process in APP_ENV=test|performance, and session fixtures via the CLI (no HTTP route).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { readEnvFile } from './env.mjs';
import { capture, ROOT, waitFor } from './sh.mjs';

export const TEST_ADMIN = 'admin@example.test';
export const TEST_VIEWER = 'viewer@example.test';

/** Connection base for the test role (CREATEDB, owns only throwaway test/perf databases). */
export function localDb() {
  const env = readEnvFile(resolve(ROOT, '.env'));
  const user = env.get('TEST_DB_USER') || 'employee_console_test';
  const password = env.get('TEST_DB_PASSWORD');
  const port = env.get('POSTGRES_HOST_PORT') || '5432';
  if (!password) throw new Error('TEST_DB_PASSWORD missing — run `pnpm run setup` and `pnpm dev:up`');
  const base = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:${port}`;
  return { base, admin: `${base}/postgres` };
}

/** Drops and recreates `name`, applies migrations, marks the purpose, seeds the Excel data. */
export async function freshDatabase(name, purpose, { seed = true } = {}) {
  if (!/^employee_console_(test|perf)[a-z0-9_]*$/.test(name)) throw new Error(`refusing to recreate unexpected database ${name}`);
  const { base, admin } = localDb();
  const client = new pg.Client({ connectionString: admin });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  const url = `${base}/${name}`;
  const env = { ...process.env, DATABASE_URL: url, ENV_FILE: '/dev/null' };
  runApi(['exec', 'prisma', 'migrate', 'deploy'], env);
  runApi(['run', 'db:mark', `--purpose=${purpose}`], env);
  if (seed) runApi(['run', 'db:seed'], env);
  return url;
}

function runApi(args, env) {
  const out = capture('pnpm', args, { cwd: resolve(ROOT, 'apps/api'), env });
  if (out === null) throw new Error(`pnpm ${args.join(' ')} failed`);
  return out;
}

// Secrets are random per run: nothing reusable is baked into the repo, and a token from one run is
// worthless against the next.
const runSecret = () => randomBytes(32).toString('base64url');

/** App variables for a test/performance API process (no inherited shell environment). */
export function appEnv({ databaseUrl, port, origin, appEnv = 'test', extra = {} }) {
  return {
    ENV_FILE: '/dev/null',
    APP_ENV: appEnv,
    NODE_ENV: 'production',
    PORT: String(port),
    HOST: '127.0.0.1',
    DATABASE_URL: databaseUrl,
    PUBLIC_APP_ORIGIN: origin,
    SESSION_SECRET: runSecret(),
    ADMIN_EMAILS: TEST_ADMIN,
    VIEWER_EMAILS: TEST_VIEWER,
    AUTH_FIXTURES_ENABLED: 'true',
    REPORTS_ENABLED: 'true',
    WORKER_SERVICE_TOKEN: runSecret(),
    SCHEDULER_SERVICE_TOKEN: runSecret(),
    LOG_LEVEL: 'warn',
    ...extra,
  };
}

/** Full process environment for spawning the API: the shell environment plus `appEnv(...)`. */
export function apiEnv(options) {
  return { ...process.env, ...appEnv(options) };
}

export function startProcess(cmd, args, { cwd, env, logFile }) {
  mkdirSync(resolve(ROOT, '.tmp'), { recursive: true });
  const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [];
  const keep = (d) => {
    chunks.push(d);
    if (chunks.length > 400) chunks.shift();
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  child.on('exit', () => logFile && writeFileSync(logFile, Buffer.concat(chunks)));
  child.dump = () => Buffer.concat(chunks).toString();
  return child;
}

export async function waitHttp(url, label, timeoutMs = 90_000) {
  await waitFor(
    async () => {
      try {
        const r = await fetch(url, { redirect: 'manual' });
        return r.status < 500;
      } catch {
        return false;
      }
    },
    { timeoutMs, intervalMs: 500, label },
  );
}

/** Issues a fixture session with the CLI, using the same env the API runs with. */
export function fixtureSession(env, email) {
  const out = capture('pnpm', ['--silent', 'run', 'test:session', `--email=${email}`], { cwd: resolve(ROOT, 'apps/api'), env });
  if (!out) throw new Error(`test:session failed for ${email}`);
  return JSON.parse(out.slice(out.indexOf('{')));
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
