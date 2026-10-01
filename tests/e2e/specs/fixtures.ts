import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '../../..');
const runtime = JSON.parse(readFileSync(resolve(ROOT, 'tests/e2e/.auth/env.json'), 'utf8')) as {
  apiEnv: Record<string, string>;
  baseURL: string;
};

export const ADMIN = 'admin@example.test';
export const VIEWER = 'viewer@example.test';

interface Fixture {
  cookieName: string;
  cookieValue: string;
  csrfToken: string;
}

function api(script: string, args: string[] = []): string {
  return execFileSync('pnpm', ['--silent', 'run', script, ...args], {
    cwd: resolve(ROOT, 'apps/api'),
    env: { ...process.env, ...runtime.apiEnv },
    encoding: 'utf8',
  });
}

/** Restores the 5 Excel records (test database only). */
export function resetData(): void {
  api('test:reset');
}

/** New session through the CLI fixture issuer (APP_ENV=test) — not an HTTP backdoor. */
export function newSession(email: string): Fixture {
  const out = api('test:session', [`--email=${email}`]);
  return JSON.parse(out.slice(out.indexOf('{'))) as Fixture;
}

export async function signIn(context: BrowserContext, email: string): Promise<Fixture> {
  const s = newSession(email);
  const { hostname } = new URL(runtime.baseURL);
  await context.addCookies([{ name: s.cookieName, value: s.cookieValue, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' }]);
  return s;
}

export const workerToken = () => runtime.apiEnv.WORKER_SERVICE_TOKEN;
export const apiBase = () => `http://127.0.0.1:${runtime.apiEnv.PORT}`;

export const test = base.extend<{ admin: Page; viewer: Page }>({
  admin: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: runtime.baseURL });
    await signIn(context, ADMIN);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  viewer: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: runtime.baseURL });
    await signIn(context, VIEWER);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };

/**
 * Data rows actually shown in the page: inside <main> (not Next's hidden streaming buffer)
 * and not the loading skeleton, so counts never pass before real data is visible.
 */
export function rows(page: Page) {
  return page.locator('main table tbody tr:not([data-skeleton])');
}
