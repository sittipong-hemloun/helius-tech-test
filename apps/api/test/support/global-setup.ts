import type { TestProject } from 'vitest/node';
import { createTestDatabase, dropTestDatabase } from './test-db.js';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const runId = (process.env.TEST_RUN_ID ?? `${Date.now().toString(36)}${process.pid}`).replace(/[^a-z0-9_]/gi, '').toLowerCase();
  const url = process.env.TEST_DATABASE_URL ?? (await createTestDatabase(runId));
  project.provide('testDatabaseUrl', url);
  return async () => {
    if (!process.env.TEST_DATABASE_URL && !process.env.KEEP_TEST_DB) await dropTestDatabase(runId);
  };
}
