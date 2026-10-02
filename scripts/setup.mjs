#!/usr/bin/env node
// pnpm run setup — checks prerequisites, creates/updates .env and .env.staging without
// overwriting existing values, generates local secrets, and lists EXTERNAL values to fill.
// Secret values are never printed.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { capture, info, ok, portInUse, portOwner, ROOT, warn } from './lib/sh.mjs';
import { dbPassword, GENERATE, readEnvFile, secret, writeEnvFile } from './lib/env.mjs';

const problems = [];

// ---- prerequisites
const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== 24 || minor < 15) problems.push(`Node ${process.versions.node} found; Node 24 LTS (>=24.15) is required (see .node-version)`);
else ok(`Node ${process.versions.node}`);

const pnpmVersion = capture('pnpm', ['--version']);
const wantedPnpm = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).packageManager.split('@')[1];
if (pnpmVersion !== wantedPnpm) warn(`pnpm ${pnpmVersion ?? 'missing'} found; this repo pins pnpm ${wantedPnpm} (run: corepack enable)`);
else ok(`pnpm ${pnpmVersion}`);

const docker = capture('docker', ['version', '--format', '{{.Server.Version}}']);
if (!docker) problems.push('Docker daemon is not reachable (start Docker Desktop)');
else ok(`Docker ${docker}, ${capture('docker', ['compose', 'version', '--short']) ?? 'compose ?'}`);

// ---- env files
function prepare(target, template, generated) {
  const templatePath = resolve(ROOT, template);
  const targetPath = resolve(ROOT, target);
  const existed = existsSync(targetPath);
  const existing = readEnvFile(targetPath);
  const templateValues = readEnvFile(templatePath);
  const updates = new Map(existing);
  for (const [k, v] of templateValues) if (!updates.has(k)) updates.set(k, v);
  for (const [k, make] of Object.entries(generated)) {
    const current = updates.get(k);
    if (!current || current === GENERATE) updates.set(k, make(updates));
  }
  const base = existed ? readFileSync(targetPath, 'utf8') : readFileSync(templatePath, 'utf8');
  writeEnvFile(targetPath, base, updates);
  ok(`${target} ${existed ? 'updated (existing values kept)' : 'created'}`);
  return updates;
}

const common = {
  POSTGRES_PASSWORD: () => dbPassword(),
  APP_DB_PASSWORD: () => dbPassword(),
};

const local = prepare('.env', '.env.example', {
  ...common,
  DATABASE_URL: (u) =>
    `postgresql://${u.get('APP_DB_USER') || 'employee_console_app'}:${u.get('APP_DB_PASSWORD')}@localhost:${u.get('POSTGRES_HOST_PORT') || 5432}/employee_console_dev`,
  TEST_DB_PASSWORD: () => dbPassword(),
  JENKINS_ADMIN_PASSWORD: () => secret(18),
});

prepare('.env.staging', '.env.staging.example', {
  ...common,
  DATABASE_URL: (u) => `postgresql://${u.get('APP_DB_USER') || 'employee_console_app'}:${u.get('APP_DB_PASSWORD')}@postgres:5432/employee_console_staging`,
});


// ---- ports
const ports = [
  [Number(local.get('PORT') || 3001), 'API (dev)'],
  [3000, 'Web (dev)'],
  [3100, 'Web (staging)'],
  [Number(local.get('POSTGRES_HOST_PORT') || 5432), 'PostgreSQL'],
];
for (const [port, label] of ports) {
  if (await portInUse(port)) {
    const owner = portOwner(port);
    const ours = owner && /docker|com\.docke|postgres/i.test(owner);
    (ours ? info : warn)(`port ${port} (${label}) is in use${owner ? ` by ${owner}` : ''}${ours ? '' : ' — stop it or change the port in .env'}`);
  }
}


if (problems.length) {
  console.log('\nFix before continuing:');
  for (const p of problems) console.log(`  ✖ ${p}`);
  process.exit(1);
}
console.log('\nNext: pnpm dev:up');
