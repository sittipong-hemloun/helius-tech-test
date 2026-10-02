#!/usr/bin/env node
// Local staging (PRD §13.1, §14): production images tagged with the commit SHA on this machine.
//   pnpm staging:up        build images → backup → migrate → first-bootstrap seed → start → smoke
//   pnpm staging:restart   redeploy the current tag to apply .env.staging changes
//   pnpm staging:smoke     health, login page, static assets, auth enforcement (not a Google login test)
//   pnpm staging:rollback  redeploy the previous image tag (schema is not rolled back)
//   pnpm staging:down      stop containers, keep the volume
//   node scripts/staging.mjs reset --confirm-reset   restore the 5 source records on staging
//   node scripts/staging.mjs restore --file=<backup.sql> --confirm-restore [--tag=<sha>]
//                          restore a pg_dump backup into a fresh database owned by the app role
// Options: --tag=<sha> deploy an existing tag; --skip-build reuse images; --no-smoke.
// State (manifest + backups) lives in STAGING_STATE_DIR (default ~/.employee-console/staging) so
// local runs and Jenkins builds (different working directories) see the same deployment history.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { readEnvFile } from './lib/env.mjs';
import { capture, info, ok, ROOT, run, sleep, waitFor, warn } from './lib/sh.mjs';

// Jenkins passes the staging env as a secret file (STAGING_ENV_FILE); locally .env.staging is used.
const ENV_FILE = process.env.STAGING_ENV_FILE ?? resolve(ROOT, '.env.staging');
const STATE_DIR = process.env.STAGING_STATE_DIR ?? resolve(homedir(), '.employee-console/staging');
const MANIFEST = resolve(STATE_DIR, 'manifest.json');
const BACKUP_DIR = resolve(STATE_DIR, 'backups');
const LEGACY_MANIFEST = resolve(ROOT, '.deploy/staging-manifest.json');
mkdirSync(BACKUP_DIR, { recursive: true });
if (!existsSync(MANIFEST) && existsSync(LEGACY_MANIFEST)) copyFileSync(LEGACY_MANIFEST, MANIFEST);
const BASE = process.env.STAGING_URL ?? 'http://localhost:3100';
const PROJECT = 'employee-console-staging';
const [command = 'up', ...rest] = process.argv.slice(2);
const flag = (name) => rest.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name) => flag(name)?.split('=').slice(1).join('=');

function requireEnv() {
  if (!existsSync(ENV_FILE)) {
    console.error('.env.staging is missing. Run `pnpm run setup`.');
    process.exit(1);
  }
}

function compose(args, tag, opts = {}) {
  return run('docker', ['compose', '-p', PROJECT, '-f', 'compose.staging.yaml', '--env-file', ENV_FILE, ...args], {
    ...opts,
    env: { ...process.env, IMAGE_TAG: tag },
  });
}

/** Like compose() but throws instead of exiting, so a failed deploy step can trigger a rollback. */
function composeChecked(args, tag) {
  const status = compose(args, tag, { allowFailure: true });
  if (status !== 0) throw new Error(`docker compose ${args.join(' ')} exited with ${status}`);
}

function readManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { current: null, previous: null, history: [] };
}

function writeManifest(m) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify(m, null, 2)}\n`);
  // Also mirror into the workspace so Jenkins can archive it as a build artifact.
  mkdirSync(resolve(ROOT, '.deploy'), { recursive: true });
  writeFileSync(LEGACY_MANIFEST, `${JSON.stringify(m, null, 2)}\n`);
}

export function commitTag() {
  const sha = capture('git', ['rev-parse', '--short=12', 'HEAD']);
  if (!sha) throw new Error('not a git checkout: cannot derive the image tag');
  const dirty = capture('git', ['status', '--porcelain', '--untracked-files=no']);
  // Dirty trees get a distinct tag so an image never claims a commit it does not match.
  return dirty ? `${sha}-dirty` : sha;
}

function imageExists(name) {
  return capture('docker', ['image', 'inspect', name, '--format', '{{.Id}}']) !== null;
}

function buildImages(tag) {
  const sha = tag.replace(/-dirty$/, '');
  run('docker', ['build', '-f', 'infra/docker/api.Dockerfile', '--build-arg', `BUILD_COMMIT_SHA=${sha}`, '-t', `employee-console/api:${tag}`, '.']);
  run('docker', [
    'build',
    '-f',
    'infra/docker/web.Dockerfile',
    '--build-arg',
    `BUILD_COMMIT_SHA=${sha}`,
    '--build-arg',
    'API_INTERNAL_URL=http://api:3001',
    '-t',
    `employee-console/web:${tag}`,
    '.',
  ]);
}

function dbExec(tag, sql) {
  return capture(
    'docker',
    ['compose', '-p', PROJECT, '-f', 'compose.staging.yaml', '--env-file', ENV_FILE, 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'employee_console_staging', '-tAc', sql],
    { env: { ...process.env, IMAGE_TAG: tag } },
  );
}

function backup(tag) {
  // Safety copy before applying migrations (STATE_DIR/backups). Restore with the `restore` command.
  const hasSchema = dbExec(tag, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL");
  if (hasSchema !== 't') return null;
  const file = resolve(BACKUP_DIR, `staging-${new Date().toISOString().replace(/[:.]/g, '-')}-before-${tag}.sql`);
  const dump = capture(
    'docker',
    ['compose', '-p', PROJECT, '-f', 'compose.staging.yaml', '--env-file', ENV_FILE, 'exec', '-T', 'postgres', 'pg_dump', '-U', 'postgres', '--no-owner', 'employee_console_staging'],
    { env: { ...process.env, IMAGE_TAG: tag }, maxBuffer: 512 * 1024 * 1024 },
  );
  if (dump === null) throw new Error('pg_dump failed; refusing to migrate without a backup');
  writeFileSync(file, dump, { mode: 0o600 });
  return file;
}

async function waitHealthy(service, tag) {
  await waitFor(
    () => {
      const h = capture('docker', ['compose', '-p', PROJECT, '-f', 'compose.staging.yaml', '--env-file', ENV_FILE, 'ps', service, '--format', '{{.Health}}'], {
        env: { ...process.env, IMAGE_TAG: tag },
      });
      return h === 'healthy';
    },
    { timeoutMs: 120_000, intervalMs: 2000, label: `${service} healthy` },
  );
}

async function smoke() {
  const results = [];
  const check = async (name, fn) => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail });
    } catch (err) {
      results.push({ name, ok: false, detail: err.message });
    }
  };
  const get = (path, init) => fetch(`${BASE}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(8000), ...init });

  await check('liveness', async () => {
    const r = await get('/api/health/live');
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    return 'ok';
  });
  await check('readiness (DB + schema)', async () => {
    const r = await get('/api/health/ready');
    const body = await r.json();
    if (r.status !== 200 || body.status !== 'ready') throw new Error(`status ${r.status} ${body.status}`);
    return 'ready';
  });
  let html = '';
  await check('login page', async () => {
    const r = await get('/login');
    html = await r.text();
    if (r.status !== 200 || !html.includes('Employee')) throw new Error(`status ${r.status}`);
    return '200';
  });
  await check('static assets', async () => {
    const asset = /\/_next\/static\/[^"']+\.(?:css|js)/.exec(html)?.[0];
    if (!asset) throw new Error('no asset referenced');
    const r = await get(asset);
    if (r.status !== 200) throw new Error(`${asset} → ${r.status}`);
    return asset.split('/').pop();
  });
  await check('auth enforced on employees API', async () => {
    const r = await get('/api/v1/employees');
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
    return '401 without session';
  });
  await check('internal API not exposed via web origin', async () => {
    const r = await get('/internal/v1/report-jobs/claim', { method: 'POST' });
    if (r.status !== 404) throw new Error(`expected 404, got ${r.status}`);
    return '404';
  });
  await check('Google sign-in configuration (presence only)', async () => {
    const r = await get('/api/auth/providers');
    const body = await r.json();
    return body.data.google.configured ? 'configured — interactive login still needs a manual check' : 'not configured';
  });

  for (const r of results) console.log(`${r.ok ? '✔' : '✖'} ${r.name}: ${r.detail}`);
  return results.every((r) => r.ok);
}

async function deploy(tag, { previous }) {
  composeChecked(['up', '-d', 'postgres'], tag);
  await waitHealthy('postgres', tag);
  const backupFile = backup(tag);
  if (backupFile) info(`backup written to ${backupFile}`);
  composeChecked(['run', '--rm', 'migrate'], tag);

  const purpose = dbExec(tag, "SELECT value FROM app_meta WHERE key = 'database_purpose'");
  if (!purpose) {
    // First bootstrap only: mark as demo and load the Excel source data (never on later deploys).
    composeChecked(['run', '--rm', '--entrypoint', 'node', 'migrate', 'dist-scripts/scripts/mark-database.js', '--purpose=demo'], tag);
    composeChecked(['run', '--rm', '--entrypoint', 'node', 'migrate', 'dist-scripts/scripts/seed.js'], tag);
  }

  composeChecked(['up', '-d', '--no-deps', 'api'], tag);
  await waitHealthy('api', tag);
  composeChecked(['up', '-d', '--no-deps', 'web'], tag);
  await waitHealthy('web', tag);

  const m = readManifest();
  const entry = { tag, deployedAt: new Date().toISOString(), previous };
  writeManifest({ current: tag, previous, history: [entry, ...(m.history ?? [])].slice(0, 20) });
  ok(`staging running ${tag} at ${BASE}`);
}

/** Deploy + smoke; on any failure put the last good tag back (no schema rollback). */
async function deployWithRollback(tag, { lastGood, smokeAfter }) {
  try {
    await deploy(tag, { previous: lastGood && lastGood !== tag ? lastGood : readManifest().previous });
    if (smokeAfter) {
      await sleep(1000);
      if (!(await smoke())) throw new Error('smoke checks failed');
    }
    return true;
  } catch (err) {
    warn(`deploy of ${tag} failed: ${err.message}`);
    if (lastGood && lastGood !== tag && imageExists(`employee-console/api:${lastGood}`) && imageExists(`employee-console/web:${lastGood}`)) {
      warn(`rolling back to ${lastGood} (schema left as is; migrations are expand-compatible)`);
      const before = readManifest();
      await deploy(lastGood, { previous: before.previous });
      writeManifest({ ...readManifest(), failed: { tag, at: new Date().toISOString(), reason: err.message } });
      await smoke();
    }
    return false;
  }
}

if (command === 'up') {
  requireEnv();
  if (!capture('docker', ['network', 'inspect', 'employee-console-shared'])) run('docker', ['network', 'create', 'employee-console-shared']);
  const tag = flagValue('tag') ?? commitTag();
  if (!flag('skip-build') && !flagValue('tag')) buildImages(tag);
  for (const img of [`employee-console/api:${tag}`, `employee-console/web:${tag}`]) {
    if (!imageExists(img)) {
      console.error(`image ${img} not found`);
      process.exit(1);
    }
  }
  const lastGood = readManifest().current;
  const okDeploy = await deployWithRollback(tag, { lastGood, smokeAfter: !flag('no-smoke') });
  process.exit(okDeploy ? 0 : 1);
} else if (command === 'restart') {
  // Redeploy the current image tag so .env.staging changes (e.g. REPORTS_ENABLED) take effect.
  requireEnv();
  const m = readManifest();
  if (!m.current) {
    console.error('staging is not deployed yet; run pnpm staging:up');
    process.exit(1);
  }
  await deploy(m.current, { previous: m.previous });
  process.exit((await smoke()) ? 0 : 1);
} else if (command === 'smoke') {
  process.exit((await smoke()) ? 0 : 1);
} else if (command === 'rollback') {
  requireEnv();
  const m = readManifest();
  // m.current is the last tag that deployed AND passed smoke (failed attempts are rolled back
  // automatically and never become current), so the rollback target is the one before it.
  const target = flagValue('tag') ?? m.previous;
  if (!target) {
    console.error(`no previous deployment recorded in ${MANIFEST}`);
    process.exit(1);
  }
  const okRollback = await deployWithRollback(target, { lastGood: m.current, smokeAfter: true });
  process.exit(okRollback ? 0 : 1);
} else if (command === 'reset') {
  // Restores the 5 source records on staging (demo marker + APP_ENV=staging are checked by the script).
  requireEnv();
  if (!flag('confirm-reset')) {
    console.error('Refusing to reset staging without --confirm-reset');
    process.exit(2);
  }
  const tag = readManifest().current;
  if (!tag) {
    console.error('staging is not deployed yet');
    process.exit(1);
  }
  compose(['run', '--rm', '--entrypoint', 'node', 'migrate', 'dist-scripts/scripts/demo-reset.js', '--confirm-reset'], tag);
} else if (command === 'restore') {
  // Explicit restore of a backup: stop writers, recreate the DB owned by the app role, load the dump
  // as the app role (so every object is owned by it), then start the matching image tag.
  requireEnv();
  const file = flagValue('file');
  if (!flag('confirm-restore') || !file || !existsSync(resolve(file))) {
    console.error('usage: staging.mjs restore --file=<backup.sql> --confirm-restore [--tag=<sha>]  (backups: ' + BACKUP_DIR + ')');
    process.exit(2);
  }
  const m = readManifest();
  const tag = flagValue('tag') ?? m.current;
  if (!tag) {
    console.error('no image tag to start after the restore; pass --tag=<sha>');
    process.exit(1);
  }
  const appUser = readEnvFile(ENV_FILE).get('APP_DB_USER') || 'employee_console_app';
  composeChecked(['stop', 'web', 'api'], tag);
  const psql = (db, sql) =>
    compose(['exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db, '-c', sql], tag, { allowFailure: false });
  psql('postgres', 'DROP DATABASE IF EXISTS employee_console_staging WITH (FORCE)');
  psql('postgres', `CREATE DATABASE employee_console_staging OWNER "${appUser}"`);
  const status = run(
    'docker',
    ['compose', '-p', PROJECT, '-f', 'compose.staging.yaml', '--env-file', ENV_FILE, 'exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', appUser, '-d', 'employee_console_staging'],
    { env: { ...process.env, IMAGE_TAG: tag }, input: readFileSync(resolve(file)), stdio: ['pipe', 'inherit', 'inherit'], allowFailure: true },
  );
  if (status !== 0) {
    console.error('restore failed; the database may be incomplete — rerun restore with a known-good backup');
    process.exit(1);
  }
  ok(`restored ${file} as ${appUser}`);
  const okDeploy = await deployWithRollback(tag, { lastGood: null, smokeAfter: true });
  process.exit(okDeploy ? 0 : 1);
} else if (command === 'down') {
  requireEnv();
  compose(['down'], readManifest().current ?? 'none');
} else {
  console.error(`unknown command ${command}`);
  process.exit(2);
}
