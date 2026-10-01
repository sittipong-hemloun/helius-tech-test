// pnpm test:session --email=admin@example.test [--out=file.json]
// Issues a session fixture for automated tests (APP_ENV=test/performance only — PRD §11.5).
import { writeFileSync } from 'node:fs';
import { ConfigError, loadConfig } from '../src/config/app-config.js';
import { loadEnvFile } from '../src/config/env-file.js';
import { createPrismaClient } from '../src/database/prisma.service.js';
import { createFixtureSession, FixtureRefused } from '../src/testing/session-fixture.js';

loadEnvFile();
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err instanceof ConfigError ? err.message : err);
  process.exit(1);
}
const email = arg('email');
if (!email) {
  console.error('usage: test:session --email=<allowlisted email> [--out=path]');
  process.exit(2);
}
const prisma = createPrismaClient(config.databaseUrl, 1);
try {
  const session = await createFixtureSession(prisma, config, { email });
  const json = JSON.stringify(session, null, 2);
  const out = arg('out');
  if (out) {
    writeFileSync(out, json, { mode: 0o600 });
    console.error(`session fixture for ${session.role} written to ${out}`);
  } else {
    process.stdout.write(`${json}\n`);
  }
} catch (err) {
  if (err instanceof FixtureRefused) {
    console.error(`refused: ${err.message}`);
    process.exit(1);
  }
  throw err;
} finally {
  await prisma.$disconnect();
}
