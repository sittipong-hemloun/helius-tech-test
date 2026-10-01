#!/usr/bin/env node
// pnpm test:e2e — Playwright against production builds of web + API on an isolated test DB.
// Sessions come from the test:session CLI (APP_ENV=test only); there is no login bypass route.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { apiEnv, freshDatabase, localDb, startProcess, waitHttp } from './lib/test-env.mjs';
import { ROOT, run } from './lib/sh.mjs';

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3020);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3021);
const DB = `employee_console_test_e2e_${process.pid}`;
const ORIGIN = `http://localhost:${WEB_PORT}`;
const extraArgs = process.argv.slice(2);

const url = await freshDatabase(DB, 'test');
const env = apiEnv({ databaseUrl: url, port: API_PORT, origin: ORIGIN });

if (!process.env.E2E_SKIP_BUILD) {
  run('pnpm', ['--filter', '@employee-console/api', 'run', 'build']);
  run('pnpm', ['--filter', '@employee-console/web', 'run', 'build'], {
    env: { ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, NEXT_TELEMETRY_DISABLED: '1' },
  });
}
// Standalone output needs its static assets next to server.js.
const webDir = resolve(ROOT, 'apps/web');
const standalone = resolve(webDir, '.next/standalone/apps/web');
cpSync(resolve(webDir, '.next/static'), resolve(standalone, '.next/static'), { recursive: true });
if (existsSync(resolve(webDir, 'public'))) cpSync(resolve(webDir, 'public'), resolve(standalone, 'public'), { recursive: true });

mkdirSync(resolve(ROOT, '.tmp'), { recursive: true });
const api = startProcess('node', ['dist/main.js'], { cwd: resolve(ROOT, 'apps/api'), env: { ...env, REPORT_MAINTENANCE_ENABLED: 'false' }, logFile: resolve(ROOT, '.tmp/e2e-api.log') });
const web = startProcess('node', ['server.js'], {
  cwd: standalone,
  env: { ...process.env, PORT: String(WEB_PORT), HOSTNAME: '127.0.0.1', API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, NODE_ENV: 'production' },
  logFile: resolve(ROOT, '.tmp/e2e-web.log'),
});

let status = 1;
try {
  await waitHttp(`http://127.0.0.1:${API_PORT}/api/health/ready`, 'api');
  await waitHttp(`http://127.0.0.1:${WEB_PORT}/login`, 'web');
  const runtime = resolve(ROOT, 'tests/e2e/.auth');
  mkdirSync(runtime, { recursive: true });
  // Test-only values for this run; the directory is git-ignored and removed afterwards.
  writeFileSync(resolve(runtime, 'env.json'), JSON.stringify({ apiEnv: env, baseURL: ORIGIN }), { mode: 0o600 });
  status = run('pnpm', ['--filter', '@employee-console/e2e', 'exec', 'playwright', 'test', ...extraArgs], {
    allowFailure: true,
    env: { ...process.env, E2E_BASE_URL: ORIGIN },
  });
} catch (err) {
  console.error(err);
  console.error(api.dump().slice(-3000));
  console.error(web.dump().slice(-3000));
} finally {
  api.kill('SIGTERM');
  web.kill('SIGTERM');
  rmSync(resolve(ROOT, 'tests/e2e/.auth'), { recursive: true, force: true });
  if (!process.env.KEEP_TEST_DB) {
    const admin = new pg.Client({ connectionString: localDb().admin });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    await admin.end();
  }
}
process.exit(status);
