// Minimal .env reader/writer that preserves comments and ordering.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const GENERATE = '__generate__';

export function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line);
    if (m) values.set(m[1], m[2].trim().replace(/^"(.*)"$/, '$1'));
  }
  return values;
}

export function readEnvFile(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : new Map();
}

/** Applies `updates` to the file text, appending keys that are not present yet. */
export function writeEnvFile(path, templateText, updates) {
  const seen = new Set();
  const lines = templateText.split(/\r?\n/).map((line) => {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (!m) return line;
    seen.add(m[1]);
    return updates.has(m[1]) ? `${m[1]}=${updates.get(m[1])}` : line;
  });
  for (const [k, v] of updates) if (!seen.has(k)) lines.push(`${k}=${v}`);
  writeFileSync(path, lines.join('\n'), { mode: 0o600 });
}

export const secret = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const dbPassword = () => randomBytes(24).toString('hex');
