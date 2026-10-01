#!/usr/bin/env node
// CI-only PostgreSQL: Compose project employee-console-ci-<build> on a free loopback port.
// `up` writes .env for this workspace (random secrets via setup); `down` removes only that project.
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';
import { readEnvFile, writeEnvFile } from './lib/env.mjs';
import { capture, ROOT, run, waitFor } from './lib/sh.mjs';

const project = process.env.CI_PROJECT ?? `employee-console-ci-${process.env.BUILD_NUMBER ?? 'local'}`;
const [cmd] = process.argv.slice(2);

function freePort() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

if (cmd === 'up') {
  if (!existsSync(resolve(ROOT, '.env'))) run('node', ['scripts/setup.mjs'], { allowFailure: true });
  const port = await freePort();
  const envPath = resolve(ROOT, '.env');
  const env = readEnvFile(envPath);
  env.set('POSTGRES_HOST_PORT', String(port));
  env.set('DATABASE_URL', `postgresql://${env.get('APP_DB_USER')}:${env.get('APP_DB_PASSWORD')}@localhost:${port}/employee_console_dev`);
  writeEnvFile(envPath, readFileSync(envPath, 'utf8'), env);
  run('docker', ['compose', '-p', project, 'up', '-d', 'postgres']);
  await waitFor(() => capture('docker', ['compose', '-p', project, 'ps', 'postgres', '--format', '{{.Health}}']) === 'healthy', {
    timeoutMs: 120_000,
    label: 'CI postgres healthy',
  });
  console.log(`CI database ready on 127.0.0.1:${port} (project ${project})`);
} else if (cmd === 'down') {
  run('docker', ['compose', '-p', project, 'down', '-v', '--remove-orphans'], { allowFailure: true });
} else {
  console.error('usage: ci-db.mjs up|down');
  process.exit(2);
}
