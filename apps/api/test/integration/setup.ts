import { execFileSync } from 'node:child_process';
import { loadEnv } from '../../src/env.js';

/** Vitest global setup: bring the test database to the latest migration (Prisma creates it if missing). */
export default function setup(): void {
  loadEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is missing — copy .env.example to .env');
  if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must not be the dev database: tests delete its data');
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
