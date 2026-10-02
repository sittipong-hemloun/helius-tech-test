#!/usr/bin/env node
// pnpm ci:up — Jenkins LTS controller (Docker, :8080) + inbound agent on this machine (PRD §14.1).
// The repo is mounted read-only at its real path so the job can use a file:// SCM URL when no remote exists.
// pnpm ci:up --stop  stops the agent and the controller (volume kept).
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readEnvFile } from './lib/env.mjs';
import { ok, ROOT, run, waitFor } from './lib/sh.mjs';

const pidFile = resolve(ROOT, '.tmp/jenkins-agent.pid');
const env = { ...process.env, JENKINS_LOCAL_REPO: ROOT };

if (process.argv.includes('--stop')) {
  if (existsSync(pidFile)) {
    try {
      process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGTERM');
    } catch {
      /* already stopped */
    }
    rmSync(pidFile, { force: true });
  }
  run('docker', ['compose', '--profile', 'ci', 'stop', 'jenkins'], { env, allowFailure: true });
  process.exit(0);
}

for (const f of ['.env', '.env.staging']) {
  if (!existsSync(resolve(ROOT, f))) {
    console.error(`${f} is missing. Run pnpm run setup.`);
    process.exit(1);
  }
}
const cfg = readEnvFile(resolve(ROOT, '.env'));
run('docker', ['compose', '--profile', 'ci', 'up', '-d', '--build', 'jenkins'], { env });
await waitFor(
  async () => {
    try {
      return (await fetch('http://127.0.0.1:8080/login', { signal: AbortSignal.timeout(2000) })).status === 200;
    } catch {
      return false;
    }
  },
  { timeoutMs: 240_000, intervalMs: 3000, label: 'Jenkins login page' },
);
ok('Jenkins controller is up at http://localhost:8080');

// The login page only proves Jenkins started. Check that JCasC was applied (admin login works, the
// job and the agent node exist) and that every pinned plugin is installed and active.
const auth = `Basic ${Buffer.from(`${cfg.get('JENKINS_ADMIN_ID') || 'admin'}:${cfg.get('JENKINS_ADMIN_PASSWORD')}`).toString('base64')}`;
const jenkinsJson = async (path) => {
  const r = await fetch(`http://127.0.0.1:8080${path}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
};
try {
  await waitFor(async () => (await jenkinsJson('/job/employee-console/api/json?tree=name').catch(() => null))?.name === 'employee-console', {
    timeoutMs: 120_000,
    intervalMs: 3000,
    label: 'JCasC job employee-console',
  });
  const nodes = await jenkinsJson('/computer/api/json?tree=computer%5BdisplayName%5D');
  if (!nodes.computer.some((c) => c.displayName === 'host-agent')) throw new Error('agent node host-agent not configured');
  const installed = new Map((await jenkinsJson('/pluginManager/api/json?depth=1&tree=plugins%5BshortName,version,active%5D')).plugins.map((p) => [p.shortName, p]));
  const pinned = readFileSync(resolve(ROOT, 'infra/jenkins/plugins.txt'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(':'));
  const wrong = pinned.filter(([name, version]) => installed.get(name)?.version !== version || !installed.get(name)?.active);
  if (wrong.length) throw new Error(`plugins not at pinned version/active: ${wrong.map(([n, v]) => `${n}:${v} (have ${installed.get(n)?.version ?? 'none'})`).join(', ')}`);
  ok(`JCasC applied (job employee-console, node host-agent); ${pinned.length} pinned plugins active`);
} catch (err) {
  console.error(`✖ Jenkins configuration check failed: ${err.message}`);
  process.exit(1);
}

mkdirSync(resolve(ROOT, '.tmp'), { recursive: true });
if (existsSync(pidFile)) {
  try {
    process.kill(Number(readFileSync(pidFile, 'utf8')), 0);
    ok('agent already running');
    process.exit(0);
  } catch {
    rmSync(pidFile, { force: true });
  }
}
const log = openSync(resolve(ROOT, '.tmp/jenkins-agent.log'), 'a');
const agent = spawn(process.execPath, [resolve(ROOT, 'infra/jenkins/agent.mjs')], { detached: true, stdio: ['ignore', log, log], env });
agent.unref();
closeSync(log);
writeFileSync(pidFile, String(agent.pid));
ok(`agent started (pid ${agent.pid}, log .tmp/jenkins-agent.log)`);
console.log(`
Sign in: http://localhost:8080  user ${cfg.get('JENKINS_ADMIN_ID') || 'admin'} — password is JENKINS_ADMIN_PASSWORD in .env
Job:     employee-console (Build with Parameters). SCM: ${cfg.get('JENKINS_GIT_URL') || `file://${ROOT} (local repo, branch main)`}
Stop:    pnpm ci:up --stop
`);
