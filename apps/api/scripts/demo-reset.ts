// pnpm demo:reset --confirm-reset — restore the 5 source records on a demo database.
// Guards (PRD §9.5): APP_ENV local/staging, database marked "demo", explicit flag.
// Clears employees, reports and idempotency keys only; users and sessions are kept.
import { loadEnvFile } from '../src/config/env-file.js';
import { createPrismaClient } from '../src/database/prisma.service.js';
import { databasePurpose, seedOriginal, seedSummary } from '../src/seed/seed-original.js';

loadEnvFile();
const appEnv = process.env.APP_ENV ?? 'local';
if (!process.argv.includes('--confirm-reset')) {
  console.error('Refusing to reset without --confirm-reset. This deletes all employees and reports in the demo database.');
  process.exit(2);
}
if (appEnv !== 'local' && appEnv !== 'staging') {
  console.error(`demo:reset is only allowed for APP_ENV=local or staging (current: ${appEnv})`);
  process.exit(1);
}
const prisma = createPrismaClient(process.env.DATABASE_URL!, 2);
try {
  const purpose = await databasePurpose(prisma);
  if (purpose !== 'demo') {
    console.error(`database purpose is "${purpose ?? 'unmarked'}", expected "demo"; nothing was changed`);
    process.exit(1);
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM reports`;
    await tx.$executeRaw`DELETE FROM idempotency_keys`;
    await tx.$executeRaw`DELETE FROM employees`;
    await tx.$executeRaw`ALTER TABLE employees ALTER COLUMN id RESTART WITH 1`;
  });
  const result = await seedOriginal(prisma);
  const s = await seedSummary(prisma);
  console.log(`demo reset: ${s.total} employees (${s.active}/${s.inactive}), salary sum ${s.salary_sum}, next ID ${result.nextEmployeeId}`);
} finally {
  await prisma.$disconnect();
}
