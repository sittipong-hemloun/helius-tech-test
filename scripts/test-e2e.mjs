#!/usr/bin/env node
// pnpm test:e2e — Playwright against production builds of web + API on an isolated test DB.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appEnv, dropDatabase, freshDatabase, startProcess, waitHttp } from './lib/test-env.mjs';
import { ROOT, run } from './lib/sh.mjs';

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3020);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3021);
const DB = `employee_console_test_e2e_${process.pid}`;
const ORIGIN = `http://localhost:${WEB_PORT}`;
const extraArgs = process.argv.slice(2);

const url = await freshDatabase(DB);
// App variables only: env.json must not capture the developer's whole shell environment.
const app = appEnv({ databaseUrl: url, port: API_PORT, origin: ORIGIN });
const env = { ...process.env, ...app };

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
const api = startProcess('node', ['dist/main.js'], { cwd: resolve(ROOT, 'apps/api'), env, logFile: resolve(ROOT, '.tmp/e2e-api.log') });
const web = startProcess('node', ['server.js'], {
  cwd: standalone,
  env: { ...process.env, PORT: String(WEB_PORT), HOSTNAME: '127.0.0.1', API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, NODE_ENV: 'production' },
  logFile: resolve(ROOT, '.tmp/e2e-web.log'),
});

let status = 1;
try {
  await waitHttp(`http://127.0.0.1:${API_PORT}/api/health/ready`, 'api');
  await waitHttp(`http://127.0.0.1:${WEB_PORT}/employees`, 'web');
  const runtime = resolve(ROOT, 'tests/e2e/.runtime');
  mkdirSync(runtime, { recursive: true });
  // Test-only values for this run; the directory is git-ignored and removed afterwards.
  writeFileSync(resolve(runtime, 'env.json'), JSON.stringify({ apiEnv: app }), { mode: 0o600 });
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
  rmSync(resolve(ROOT, 'tests/e2e/.runtime'), { recursive: true, force: true });
  await dropDatabase(DB);
}
process.exit(status);
