import { ADMIN, apiBase, expect, resetData, signIn, test, workerToken } from './fixtures';

test.beforeEach(() => resetData());

test('logout ends the session and clears cached data (AC-31)', async ({ browser }) => {
  const context = await browser.newContext();
  await signIn(context, ADMIN);
  const page = await context.newPage();
  await page.goto('/employees');
  await expect(page.getByText('John Doe')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/employees');
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});

test('an expired session sends the user to sign in (AC-31)', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'employee_console.test.sid', value: 's%3Aexpired.invalid', domain: 'localhost', path: '/' }]);
  const page = await context.newPage();
  await page.goto('/employees');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await context.close();
});

test('login page without Google configuration explains what is missing', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText("Google sign-in isn't set up on this server yet.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
});

test('Generate report → queued → worker result shown as AI summary with DB numbers (AC-36, AC-40)', async ({ admin: page, request }) => {
  await page.goto('/reports');
  await page.getByRole('button', { name: 'Generate report' }).click();
  await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Queued — waiting for the report worker')).toBeVisible();
  await expect(page.getByRole('row', { name: /Engineering\s+2\s+1\s+1/ })).toBeVisible();

  const auth = { Authorization: `Bearer ${workerToken()}` };
  const claim = await (await request.post(`${apiBase()}/internal/v1/report-jobs/claim`, { headers: auth, data: {} })).json();
  const job = claim.data;
  expect(JSON.stringify(job.snapshot)).not.toMatch(/John|salary|65000/);
  const done = await request.post(`${apiBase()}/internal/v1/report-jobs/${job.reportId}/complete`, {
    headers: auth,
    data: {
      leaseToken: job.leaseToken,
      generatedBy: 'GEMINI',
      model: job.model,
      promptVersion: job.promptVersion,
      narrative: {
        headline: 'ภาพรวมพนักงานจากข้อมูลปัจจุบัน',
        bullets: ['มีพนักงานทั้งหมด 5 รายการ', 'Active 4 รายการ และ In Active 1 รายการ', '<b>ข้อความ</b> แสดงเป็นตัวอักษร'],
      },
    },
  });
  // HTML in model output is rejected by the API contract.
  expect(done.status()).toBe(400);
  const ok = await request.post(`${apiBase()}/internal/v1/report-jobs/${job.reportId}/complete`, {
    headers: auth,
    data: {
      leaseToken: job.leaseToken,
      generatedBy: 'GEMINI',
      model: job.model,
      promptVersion: job.promptVersion,
      narrative: { headline: 'ภาพรวมพนักงานจากข้อมูลปัจจุบัน', bullets: ['มีพนักงานทั้งหมด 5 รายการ', 'Active 4 รายการ และ In Active 1 รายการ', 'Engineering มี 2 รายการ'] },
    },
  });
  expect(ok.status()).toBe(200);
  await expect(page.getByText('ภาพรวมพนักงานจากข้อมูลปัจจุบัน')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/AI-generated summary — based on snapshot at/)).toBeVisible();
  await expect(page.getByText('Ready')).toBeVisible();
});
