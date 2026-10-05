// pnpm db:seed  — load the 5 Excel records into an empty employees table (never overwrites).
// pnpm db:reset — delete every employee, then load the 5 records again.
import { loadEnv } from '../src/env.js';
import { createPrismaClient } from '../src/prisma/prisma.service.js';
import { seed } from '../src/seed.js';

loadEnv();
const prisma = createPrismaClient();
const inserted = await seed(prisma, { reset: process.argv.includes('--reset') });
console.log(inserted ? `Loaded ${inserted} employees from the Excel data.` : 'Employees already exist; nothing to seed.');
await prisma.$disconnect();
