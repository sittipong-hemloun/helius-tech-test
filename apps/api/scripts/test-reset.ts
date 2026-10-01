// pnpm --filter @employee-console/api run test:reset — E2E/Postman helper.
// Restores the Excel fixture on a database marked "test" (never demo/staging data).
import { loadEnvFile } from '../src/config/env-file.js';
import { createPrismaClient } from '../src/database/prisma.service.js';
import { databasePurpose, seedOriginal } from '../src/seed/seed-original.js';

loadEnvFile();
if (process.env.APP_ENV !== 'test') {
  console.error('test:reset requires APP_ENV=test');
  process.exit(1);
}
const prisma = createPrismaClient(process.env.DATABASE_URL!, 1);
try {
  if ((await databasePurpose(prisma)) !== 'test') {
    console.error('database is not marked "test"; nothing was changed');
    process.exit(1);
  }
  await prisma.$executeRawUnsafe('TRUNCATE reports, idempotency_keys, employees, integration_state RESTART IDENTITY');
  await prisma.$executeRawUnsafe('ALTER TABLE employees ALTER COLUMN id RESTART WITH 1');
  await seedOriginal(prisma);
  console.log('test fixture restored');
} finally {
  await prisma.$disconnect();
}
