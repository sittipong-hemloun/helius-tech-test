import { execFileSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';

/** Restores the 5 Excel records in the test database. Only `pnpm test:e2e` sets TEST_DATABASE_URL for us. */
export function resetData(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Run the e2e tests with `pnpm test:e2e`');
  execFileSync('pnpm', ['--silent', '--filter', '@employee-console/api', 'run', 'db:reset'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}

export { expect, test };

/**
 * Data rows actually shown in the page: inside <main> (not Next's hidden streaming buffer)
 * and not the loading skeleton, so counts never pass before real data is visible.
 */
export function rows(page: Page) {
  return page.locator('main table tbody tr:not([data-skeleton])');
}
