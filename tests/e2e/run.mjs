// pnpm test:e2e — Playwright against production builds of the API (:3021) and web (:3020),
// both on TEST_DATABASE_URL so the dev data is never touched. Extra arguments go to Playwright:
//   pnpm test:e2e --grep "seed data"
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is missing — copy .env.example to .env');

const API_PORT = 3021;
const WEB_PORT = 3020;
const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}` };

function run(cmd, args) {
  const { status } = spawnSync(cmd, args, { cwd: ROOT, env, stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}

async function waitFor(url) {
  for (let i = 0; i < 120; i += 1) {
    if (await fetch(url).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not start`);
}

run('pnpm', ['db:migrate']);
run('pnpm', ['build']); // the web build bakes API_INTERNAL_URL into its /api rewrite

const servers = [
  spawn('node', ['dist/main.js'], { cwd: resolve(ROOT, 'apps/api'), env: { ...env, PORT: String(API_PORT) }, stdio: 'inherit' }),
  spawn('node', ['node_modules/next/dist/bin/next', 'start', '--port', String(WEB_PORT)], { cwd: resolve(ROOT, 'apps/web'), env, stdio: 'inherit' }),
];

let status = 1;
try {
  await waitFor(`http://127.0.0.1:${API_PORT}/api/employees`);
  await waitFor(`http://127.0.0.1:${WEB_PORT}/employees`);
  status = spawnSync('pnpm', ['exec', 'playwright', 'test', ...process.argv.slice(2)], { cwd: import.meta.dirname, env, stdio: 'inherit' }).status ?? 1;
} finally {
  for (const server of servers) server.kill();
}
process.exit(status);
