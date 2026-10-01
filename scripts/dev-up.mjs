#!/usr/bin/env node
// pnpm dev:up — start PostgreSQL, apply migrations, and seed the Excel data on first run.
// It never resets data. Afterwards run `pnpm dev` for hot-reloading web + API.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { bundledMigrations, databaseState } from './lib/db.mjs';
import { readEnvFile } from './lib/env.mjs';
import { capture, info, ok, portInUse, portOwner, ROOT, run, waitFor, warn } from './lib/sh.mjs';

if (!existsSync(resolve(ROOT, '.env'))) {
  console.error('No .env yet. Run `pnpm run setup` first.');
  process.exit(1);
}
const env = readEnvFile(resolve(ROOT, '.env'));

if (!capture('docker', ['network', 'inspect', 'employee-console-shared'])) {
  run('docker', ['network', 'create', 'employee-console-shared']);
}
run('docker', ['compose', 'up', '-d', 'postgres']);
await waitFor(() => capture('docker', ['compose', 'ps', 'postgres', '--format', '{{.Health}}']) === 'healthy', {
  timeoutMs: 90_000,
  label: 'postgres healthy',
});
ok('PostgreSQL is healthy');

run('pnpm', ['--filter', '@employee-console/api', 'exec', 'prisma', 'migrate', 'deploy']);
const before = await databaseState(env.get('DATABASE_URL'));
const missing = bundledMigrations().filter((m) => !before.applied.includes(m));
if (missing.length) {
  console.error(`Migrations not applied: ${missing.join(', ')}`);
  process.exit(1);
}
ok(`schema at ${bundledMigrations().at(-1)}`);

if (!before.purpose) {
  // First bootstrap of this database: mark it as the demo database and load the source data.
  run('pnpm', ['--filter', '@employee-console/api', 'run', 'db:mark', '--purpose=demo']);
  run('pnpm', ['--filter', '@employee-console/api', 'run', 'db:seed']);
} else {
  info(`database already bootstrapped (purpose ${before.purpose}, ${before.employees} employees) — seed skipped; use pnpm db:seed or pnpm demo:reset --confirm-reset explicitly`);
}

const apiPort = Number(env.get('PORT') || 3001);
for (const [port, label] of [
  [apiPort, 'API'],
  [3000, 'web'],
]) {
  if (await portInUse(port)) warn(`port ${port} (${label}) is busy${portOwner(port) ? ` (${portOwner(port)})` : ''}; stop it or change PORT/API_INTERNAL_URL in .env`);
}
console.log(`\nNext: pnpm dev  → web http://localhost:3000, API http://localhost:${apiPort}`);
