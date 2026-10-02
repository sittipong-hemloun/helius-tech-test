#!/usr/bin/env node
// pnpm secrets:scan — fails if a tracked file contains a value from .env/.env.staging
// or a common credential pattern (AC-57). Values are compared, never printed.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readEnvFile } from './lib/env.mjs';
import { ROOT } from './lib/sh.mjs';

const SECRET_KEYS = /(SECRET|SECRET_KEY|PASSWORD|TOKEN|API_KEY|ENCRYPTION_KEY|DATABASE_URL|CLIENT_ID)$/;
const secrets = new Map();
for (const file of ['.env', '.env.staging']) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) continue;
  for (const [k, v] of readEnvFile(path)) if (SECRET_KEYS.test(k) && v && v.length >= 12 && v !== '__generate__') secrets.set(`${file}:${k}`, v);
}
const PATTERNS = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Google OAuth client secret', /GOCSPX-[0-9A-Za-z_-]{20,}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /gh[pousr]_[0-9A-Za-z]{30,}/],
  ['signed session cookie', /employee_console\.(?:local|staging)\.sid=s%3A[0-9A-Za-z_-]{20,}\.[0-9A-Za-z%_-]{20,}/],
];
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];
for (const f of files) {
  if (/\.(pdf|docx|xlsx|png|jpg|ico|woff2?)$/i.test(f)) continue;
  let text;
  try {
    text = readFileSync(resolve(ROOT, f), 'utf8');
  } catch {
    continue;
  }
  for (const [name, value] of secrets) if (text.includes(value)) findings.push(`${f}: contains the value of ${name}`);
  for (const [name, re] of PATTERNS) if (re.test(text)) findings.push(`${f}: looks like a ${name}`);
}
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log(`secret scan: ${files.length} tracked files, ${secrets.size} local secret values, no matches`);
