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
