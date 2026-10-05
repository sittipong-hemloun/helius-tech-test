import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env itself. Same root .env as src/env.ts; variables already set win.
const envFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Used by the Prisma CLI only (migrate deploy). The app connects through the pg adapter.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
