import { spawnSync, execFileSync } from 'node:child_process';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (r.status !== 0 && !opts.allowFailure) {
    console.error(`\n✖ ${cmd} ${args.join(' ')} exited with ${r.status}`);
    process.exit(r.status ?? 1);
  }
  return r.status ?? 1;
}

export function capture(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
  } catch {
    return null;
  }
}

export function portInUse(port, host = '127.0.0.1') {
  return new Promise((resolvePromise) => {
    const socket = net.connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolvePromise(true);
    });
    socket.once('error', () => resolvePromise(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolvePromise(false);
    });
  });
}

export function portOwner(port) {
  const out = capture('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
  if (!out) return null;
  const line = out.split('\n')[1];
  if (!line) return null;
  const [command, pid] = line.split(/\s+/);
  return `${command} (PID ${pid})`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(check, { timeoutMs = 60_000, intervalMs = 1000, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return true;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

export const ok = (msg) => console.log(`✔ ${msg}`);
export const warn = (msg) => console.log(`⚠ ${msg}`);
export const info = (msg) => console.log(`• ${msg}`);
