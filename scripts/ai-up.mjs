#!/usr/bin/env node
// pnpm ai:up — start n8n (profile automation) and Open WebUI (profile ai-workspace), then
// bind n8n credentials from your env files and import both workflows (PRD §12.4, §12.7).
// Secrets are written to a temporary file inside the container and deleted right after import.
// Options: --activate  publish/activate the workflows (needs GEMINI_API_KEY for real reports)
//          --no-webui  skip Open WebUI
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CREDENTIALS } from '../workflows/n8n/credentials.mjs';
import { readEnvFile } from './lib/env.mjs';
import { capture, info, ok, ROOT, run, waitFor, warn } from './lib/sh.mjs';

const args = process.argv.slice(2);
const env = readEnvFile(resolve(ROOT, '.env'));
if (!env.get('N8N_ENCRYPTION_KEY')) {
  console.error('Run `pnpm run setup` first (.env is missing n8n secrets).');
  process.exit(1);
}

const target = env.get('N8N_INTERNAL_API_URL') || 'http://api-staging:3001/internal/v1';
// Tokens must belong to the API that n8n calls: staging tokens for api-staging, dev tokens otherwise.
const tokenSource = target.includes('api-staging') ? readEnvFile(resolve(ROOT, '.env.staging')) : env;
const workerToken = tokenSource.get('WORKER_SERVICE_TOKEN');
const schedulerToken = tokenSource.get('SCHEDULER_SERVICE_TOKEN');
const geminiKey = env.get('GEMINI_API_KEY');

if (!capture('docker', ['network', 'inspect', 'employee-console-shared'])) run('docker', ['network', 'create', 'employee-console-shared']);
const services = ['postgres', 'n8n', ...(args.includes('--no-webui') ? [] : ['open-webui'])];
run('docker', ['compose', '--profile', 'automation', '--profile', 'ai-workspace', 'up', '-d', ...services]);

await waitFor(
  async () => {
    try {
      return (await fetch('http://127.0.0.1:5678/healthz', { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
      return false;
    }
  },
  { timeoutMs: 180_000, intervalMs: 2000, label: 'n8n /healthz' },
);
ok('n8n is up at http://localhost:5678');

// ---- credentials (decrypted input; n8n encrypts them with N8N_ENCRYPTION_KEY on import)
const credentials = [
  { ...CREDENTIALS.worker, type: 'httpHeaderAuth', data: { name: 'Authorization', value: `Bearer ${workerToken}` } },
  { ...CREDENTIALS.scheduler, type: 'httpHeaderAuth', data: { name: 'Authorization', value: `Bearer ${schedulerToken}` } },
  ...(geminiKey ? [{ ...CREDENTIALS.gemini, type: 'httpHeaderAuth', data: { name: 'x-goog-api-key', value: geminiKey } }] : []),
];
mkdirSync(resolve(ROOT, '.tmp'), { recursive: true });
const tmp = resolve(ROOT, '.tmp/n8n-credentials.json');
writeFileSync(tmp, JSON.stringify(credentials), { mode: 0o600 });
try {
  run('docker', ['compose', 'cp', tmp, 'n8n:/tmp/ec-credentials.json']);
  // docker cp keeps the host uid and 0600 mode; hand the file to the n8n user inside the container.
  run('docker', ['compose', 'exec', '-T', '-u', 'root', 'n8n', 'chown', 'node:node', '/tmp/ec-credentials.json']);
  run('docker', ['compose', 'exec', '-T', 'n8n', 'n8n', 'import:credentials', '--input=/tmp/ec-credentials.json']);
} finally {
  rmSync(tmp, { force: true });
  capture('docker', ['compose', 'exec', '-T', '-u', 'root', 'n8n', 'rm', '-f', '/tmp/ec-credentials.json']);
}
ok(`credentials bound: ${credentials.map((c) => c.name).join(', ')}`);
if (!geminiKey) warn('GEMINI_API_KEY is empty: the worker imports, but real (non-empty) reports will fail with PROVIDER_AUTH_ERROR until you add the key and rerun pnpm ai:up');

// ---- workflows
run('docker', ['compose', 'exec', '-T', 'n8n', 'n8n', 'import:workflow', '--separate', '--input=/workflows']);
ok('workflows imported: employee-report-worker, employee-report-daily');

if (args.includes('--activate')) {
  for (const wf of ['ecReportWorker01', 'ecReportDaily001']) {
    // n8n 2.x publishes the current version; older CLIs use update:workflow --active=true.
    const published = run('docker', ['compose', 'exec', '-T', 'n8n', 'n8n', 'publish:workflow', `--id=${wf}`], { allowFailure: true });
    if (published !== 0) run('docker', ['compose', 'exec', '-T', 'n8n', 'n8n', 'update:workflow', `--id=${wf}`, '--active=true']);
  }
  run('docker', ['compose', 'restart', 'n8n']);
  ok('workflows activated (n8n restarted to load the schedules)');
} else {
  info('workflows are imported but inactive; rerun with --activate when credentials are ready');
}

console.log(`
n8n calls ${target}
Next steps:
  1. Open http://localhost:5678 and create the n8n owner account (first visit only).
  2. Set REPORTS_ENABLED=true in ${target.includes('api-staging') ? '.env.staging' : '.env'} and restart the API.
  3. Activate: pnpm ai:up --activate   (or toggle the workflows in the n8n UI)
  4. Open WebUI: http://localhost:3002 — the first account becomes admin; then set
     OPEN_WEBUI_ENABLE_SIGNUP=false in .env and run: docker compose --profile ai-workspace up -d open-webui
`);
if (!existsSync(resolve(ROOT, '.env.staging'))) warn('.env.staging missing — run pnpm run setup');
