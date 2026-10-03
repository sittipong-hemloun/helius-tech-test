import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadEnvFile } from '../../src/config/env-file.js';

/**
 * Builds connection strings for a throwaway test database on the dev PostgreSQL container, as the
 * test role (CREATEDB). The app role used by dev/staging cannot create or drop databases.
 */
function testDatabaseUrls(runId: string) {
  loadEnvFile();
  const user = process.env.TEST_DB_USER ?? 'employee_console_test';
  const password = process.env.TEST_DB_PASSWORD;
  const port = process.env.POSTGRES_HOST_PORT ?? '5432';
  const host = process.env.TEST_DB_HOST ?? 'localhost';
  if (!password) throw new Error('TEST_DB_PASSWORD missing: run `pnpm run setup` and `pnpm dev:up` first');
  const name = `employee_console_test_${runId}`;
  const base = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`;
  return { name, adminUrl: `${base}/postgres`, url: `${base}/${name}` };
}

export async function createTestDatabase(runId: string): Promise<string> {
  const { name, adminUrl, url } = testDatabaseUrls(runId);
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(import.meta.dirname, '../..'),
    env: { ...process.env, DATABASE_URL: url, ENV_FILE: '/dev/null' },
    stdio: 'pipe',
  });
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(`INSERT INTO app_meta (key, value) VALUES ('database_purpose', 'test')`);
  await client.end();
  return url;
}

export async function dropTestDatabase(runId: string): Promise<void> {
  const { name, adminUrl } = testDatabaseUrls(runId);
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}

/** Refuses any database that is not marked database_purpose=test (e.g. a mistaken TEST_DATABASE_URL). */
export async function assertTestDatabase(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const r = await client.query(`SELECT value FROM app_meta WHERE key = 'database_purpose'`).catch(() => ({ rows: [] }));
    const purpose = (r.rows[0] as { value?: string } | undefined)?.value ?? null;
    if (purpose !== 'test') throw new Error(`refusing to run integration tests: database purpose is "${purpose ?? 'unmarked'}", expected "test"`);
  } finally {
    await client.end();
  }
}
