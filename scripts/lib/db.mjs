import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { ROOT } from './sh.mjs';

async function withClient(connectionString, fn) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 4000 });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export function bundledMigrations() {
  return readdirSync(resolve(ROOT, 'apps/api/prisma/migrations'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export async function databaseState(connectionString) {
  return withClient(connectionString, async (c) => {
    const applied = await c
      .query(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)
      .then((r) => r.rows.map((x) => x.migration_name))
      .catch(() => []);
    const purpose = await c
      .query(`SELECT value FROM app_meta WHERE key = 'database_purpose'`)
      .then((r) => r.rows[0]?.value ?? null)
      .catch(() => null);
    const employees = await c
      .query('SELECT count(*)::int AS n FROM employees')
      .then((r) => r.rows[0].n)
      .catch(() => null);
    const canCreateDb = await c
      .query('SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user')
      .then((r) => r.rows[0]?.rolcreatedb ?? null)
      .catch(() => null);
    return { applied, purpose, employees, canCreateDb };
  });
}
