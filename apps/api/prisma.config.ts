import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env automatically. Same lookup as src/config/env-file.ts.
const envFile = process.env.ENV_FILE ?? resolve(import.meta.dirname, '../../.env');
if (existsSync(envFile)) config({ path: envFile, quiet: true, override: false });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Used by the Prisma CLI only (migrate deploy/diff). Runtime uses the pg adapter.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
