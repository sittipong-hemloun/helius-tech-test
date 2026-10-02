// pnpm db:mark --purpose=demo|test|performance — records what a database is for.
// Reset and synthetic seed refuse to run on the wrong kind of database.
import { loadEnvFile } from '../src/config/env-file.js';
import { createPrismaClient } from '../src/database/prisma.service.js';
import { databasePurpose } from '../src/seed/seed-original.js';

loadEnvFile();
const purpose = process.argv.find((a) => a.startsWith('--purpose='))?.split('=')[1];
const force = process.argv.includes('--force');
if (!purpose || !['demo', 'test', 'performance'].includes(purpose)) {
  console.error('usage: db:mark --purpose=demo|test|performance [--force]');
  process.exit(2);
}
const prisma = createPrismaClient(process.env.DATABASE_URL!, 1);
try {
  const current = await databasePurpose(prisma);
  if (current && current !== purpose && !force) {
    console.error(`database is already marked "${current}"; refusing to change it without --force`);
    process.exit(1);
  }
  await prisma.$executeRaw`
    INSERT INTO app_meta (key, value) VALUES ('database_purpose', ${purpose})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  console.log(`database marked as ${purpose}`);
} finally {
  await prisma.$disconnect();
}
