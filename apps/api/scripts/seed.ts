// pnpm db:seed — add the Excel source data that is missing by ID; never overwrites (PRD §9.5).
import { loadEnvFile } from '../src/config/env-file.js';
import { createPrismaClient } from '../src/database/prisma.service.js';
import { seedOriginal, seedSummary } from '../src/seed/seed-original.js';

loadEnvFile();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (run pnpm run setup)');
  process.exit(1);
}
const prisma = createPrismaClient(url, 2);
try {
  const result = await seedOriginal(prisma);
  const summary = await seedSummary(prisma);
  console.log(
    `seed: +${result.departmentsInserted} departments, +${result.employeesInserted} employees; ` +
      `now ${summary.total} employees (${summary.active} Active / ${summary.inactive} In Active), ` +
      `${summary.departments} departments, salary sum ${summary.salary_sum}; next ID ${result.nextEmployeeId}`,
  );
} finally {
  await prisma.$disconnect();
}
