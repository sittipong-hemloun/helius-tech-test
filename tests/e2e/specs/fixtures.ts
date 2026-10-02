import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '../../..');
const runtime = JSON.parse(readFileSync(resolve(ROOT, 'tests/e2e/.runtime/env.json'), 'utf8')) as {
  apiEnv: Record<string, string>;
};

function api(script: string): string {
  return execFileSync('pnpm', ['--silent', 'run', script], {
    cwd: resolve(ROOT, 'apps/api'),
    env: { ...process.env, ...runtime.apiEnv },
    encoding: 'utf8',
  });
}

/** Restores the 5 Excel records (test database only). */
export function resetData(): void {
  api('test:reset');
}

export { expect, test };

/**
 * Data rows actually shown in the page: inside <main> (not Next's hidden streaming buffer)
 * and not the loading skeleton, so counts never pass before real data is visible.
 */
export function rows(page: Page) {
  return page.locator('main table tbody tr:not([data-skeleton])');
}
