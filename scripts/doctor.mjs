#!/usr/bin/env node
// pnpm run doctor — (plain `pnpm doctor` is a pnpm built-in) health of processes, database, schema and configuration presence.
// Prints whether values are set, never the values themselves.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { bundledMigrations, databaseState } from './lib/db.mjs';
import { readEnvFile } from './lib/env.mjs';
import { capture, portInUse, portOwner, ROOT } from './lib/sh.mjs';

const rows = [];
const add = (area, check, state, note = '') => rows.push({ area, check, state, note });
const http = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: 'manual' });
    return r.status;
  } catch {
    return null;
  }
};

const envPath = resolve(ROOT, '.env');
const env = readEnvFile(envPath);
add('tooling', 'Node', /^24\./.test(process.versions.node) ? 'ok' : 'warn', process.versions.node);
add('tooling', 'pnpm', capture('pnpm', ['--version']) ? 'ok' : 'fail', capture('pnpm', ['--version']) ?? 'missing');
const docker = capture('docker', ['version', '--format', '{{.Server.Version}}']);
add('tooling', 'Docker daemon', docker ? 'ok' : 'fail', docker ?? 'not reachable');
add('config', '.env present', existsSync(envPath) ? 'ok' : 'fail', existsSync(envPath) ? '' : 'run pnpm run setup');

for (const [key, label] of [
  ['GOOGLE_CLIENT_ID', 'Google client ID'],
  ['GOOGLE_CLIENT_SECRET', 'Google client secret'],
  ['ADMIN_EMAILS', 'Admin allowlist'],
  ['GEMINI_API_KEY', 'Gemini API key (n8n/Open WebUI)'],
]) {
  add('config', label, env.get(key) ? 'ok' : 'missing', env.get(key) ? 'set' : 'empty');
}
add('config', 'REPORTS_ENABLED', env.get('REPORTS_ENABLED') === 'true' ? 'ok' : 'info', env.get('REPORTS_ENABLED') || 'false');

const pgHealth = capture('docker', ['compose', 'ps', 'postgres', '--format', '{{.Health}}']);
add('database', 'postgres container', pgHealth === 'healthy' ? 'ok' : 'fail', pgHealth || 'not running (pnpm dev:up)');
if (env.get('DATABASE_URL') && pgHealth === 'healthy') {
  try {
    const s = await databaseState(env.get('DATABASE_URL'));
    const missing = bundledMigrations().filter((m) => !s.applied.includes(m));
    add('database', 'migrations', missing.length ? 'fail' : 'ok', missing.length ? `pending: ${missing.join(', ')}` : bundledMigrations().at(-1));
    add('database', 'purpose marker', s.purpose ? 'ok' : 'warn', s.purpose ?? 'unmarked');
    add('database', 'employees', s.employees === null ? 'fail' : 'ok', String(s.employees));
    add('database', 'app role least privilege', s.canCreateDb === false ? 'ok' : 'warn', s.canCreateDb ? 'app role has CREATEDB — run pnpm dev:up' : 'NOCREATEDB');
    add('database', 'test role password', env.get('TEST_DB_PASSWORD') ? 'ok' : 'warn', env.get('TEST_DB_PASSWORD') ? 'set' : 'missing — run pnpm run setup');
    const age = s.worker ? Math.round((Date.now() - new Date(s.worker).getTime()) / 1000) : null;
    add('reports', 'worker heartbeat (dev DB)', age !== null && age <= 60 ? 'ok' : 'info', age === null ? 'never seen' : `${age}s ago`);
  } catch (err) {
    add('database', 'connection', 'fail', err.code ?? err.message);
  }
}

const apiPort = env.get('PORT') || '3001';
const live = await http(`http://127.0.0.1:${apiPort}/api/health/live`);
const ready = await http(`http://127.0.0.1:${apiPort}/api/health/ready`);
const busy = await portInUse(Number(apiPort));
add(
  'dev',
  `API :${apiPort}`,
  ready === 200 ? 'ok' : live === 200 ? 'warn' : busy ? 'warn' : 'off',
  ready === 200
    ? 'ready'
    : live === 200
      ? `live, not ready (${ready})`
      : busy
        ? `port used by ${portOwner(Number(apiPort)) ?? 'another process'} — not this API`
        : 'not running',
);
const web = await http('http://127.0.0.1:3000/login');
add('dev', 'Web :3000', web === 200 ? 'ok' : 'off', web ? String(web) : 'not running');
const staging = await http('http://127.0.0.1:3100/api/health/ready');
add('staging', 'Staging :3100', staging === 200 ? 'ok' : 'off', staging ? String(staging) : 'not running');
for (const [port, name, path] of [
  [5678, 'n8n', '/healthz'],
  [8080, 'Jenkins', '/login'],
  [3002, 'Open WebUI', '/health'],
]) {
  const s = await http(`http://127.0.0.1:${port}${path}`);
  add('tools', `${name} :${port}`, s && s < 500 ? 'ok' : 'off', s ? String(s) : 'not running');
}

const icon = { ok: '✔', warn: '⚠', fail: '✖', missing: '○', info: '•', off: '–' };
for (const r of rows) console.log(`${icon[r.state] ?? '•'} ${r.area.padEnd(9)} ${r.check.padEnd(28)} ${r.note}`);
process.exit(rows.some((r) => r.state === 'fail') ? 1 : 0);
