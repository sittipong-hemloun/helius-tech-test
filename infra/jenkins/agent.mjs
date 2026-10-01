#!/usr/bin/env node
// Starts the Jenkins inbound agent on this machine (it has Node 24, pnpm and Docker).
// Usage: node infra/jenkins/agent.mjs   (after `pnpm ci:up`). Reads admin credentials from .env.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnvFile } from '../../scripts/lib/env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = readEnvFile(resolve(ROOT, '.env'));
const JENKINS = process.env.JENKINS_URL ?? 'http://localhost:8080';
const NODE_NAME = 'host-agent';
const workDir = env.get('JENKINS_AGENT_WORKDIR') || '/tmp/employee-console-jenkins-agent';
const auth = `Basic ${Buffer.from(`${env.get('JENKINS_ADMIN_ID') || 'admin'}:${env.get('JENKINS_ADMIN_PASSWORD')}`).toString('base64')}`;

const jar = resolve(ROOT, 'infra/jenkins/agent/agent.jar');
mkdirSync(dirname(jar), { recursive: true });
mkdirSync(workDir, { recursive: true });
if (!existsSync(jar)) {
  const r = await fetch(`${JENKINS}/jnlpJars/agent.jar`);
  if (!r.ok) throw new Error(`cannot download agent.jar (${r.status}); is Jenkins up?`);
  writeFileSync(jar, Buffer.from(await r.arrayBuffer()));
}
const jnlp = await fetch(`${JENKINS}/computer/${NODE_NAME}/jenkins-agent.jnlp`, { headers: { Authorization: auth } });
if (!jnlp.ok) throw new Error(`cannot read agent secret (${jnlp.status}); check JENKINS_ADMIN_PASSWORD in .env`);
const secret = /<argument>([a-f0-9]{64})<\/argument>/.exec(await jnlp.text())?.[1];
if (!secret) throw new Error('agent secret not found in JNLP');

// Put Node 24 + pnpm (corepack) first so builds match the pinned toolchain.
const extraPath = ['/opt/homebrew/opt/node@24/bin', '/usr/local/opt/node@24/bin'].filter(existsSync);
const PATH = [...extraPath, process.env.PATH].join(':');
try {
  execFileSync('java', ['-version'], { stdio: 'ignore' });
} catch {
  throw new Error('Java 17+ is required to run the Jenkins agent');
}
console.log(`Connecting ${NODE_NAME} to ${JENKINS} (workDir ${workDir}) ...`);
const child = spawn('java', ['-jar', jar, '-url', JENKINS, '-secret', secret, '-name', NODE_NAME, '-webSocket', '-workDir', workDir], {
  stdio: 'inherit',
  env: { ...process.env, PATH, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
});
child.on('exit', (code) => process.exit(code ?? 0));
