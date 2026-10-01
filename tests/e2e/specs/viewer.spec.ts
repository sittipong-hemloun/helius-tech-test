import { apiBase, expect, newSession, resetData, rows, test, VIEWER } from './fixtures';

test.beforeEach(() => resetData());

test('Viewer: no Salary in UI or network, no CRUD actions (AC-27)', async ({ viewer: page }) => {
  const bodies: string[] = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/v1/employees')) bodies.push(await res.text());
  });
  await page.goto('/employees');
  await expect(rows(page)).toHaveCount(5);
  const headers = (await page.locator('thead th').allInnerTexts()).map((h) => h.trim()).filter(Boolean);
  expect(headers).not.toContain('Salary');
  await expect(page.getByRole('link', { name: 'Add employee' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0);
  await expect(page.getByText('65,000.00')).toHaveCount(0);

  await page.getByRole('link', { name: 'John Doe' }).click();
  await expect(page.locator('dl')).not.toContainText('Salary');
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);

  expect(bodies.length).toBeGreaterThan(0);
  for (const b of bodies) expect(b).not.toMatch(/"salary"/);

  await page.goto('/employees/new');
  await expect(page.getByText("Your role can't add employees.")).toBeVisible();
  await page.goto('/settings/integrations');
  await expect(page.getByText('Integrations are visible to admins only.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Integrations' })).toHaveCount(0);
});

test('Viewer direct API mutation is rejected with 403 (AC-28)', async ({ request }) => {
  const s = newSession(VIEWER);
  const res = await request.post(`${apiBase()}/api/v1/employees`, {
    headers: { Cookie: `${s.cookieName}=${s.cookieValue}`, 'X-CSRF-Token': s.csrfToken, 'Idempotency-Key': crypto.randomUUID() },
    data: { name: 'X', departmentId: 'hr', salary: '1.00', joinDate: '2026-01-01', isActive: true },
  });
  expect(res.status()).toBe(403);
  const sort = await request.get(`${apiBase()}/api/v1/employees?sortBy=salary`, { headers: { Cookie: `${s.cookieName}=${s.cookieValue}` } });
  expect(sort.status()).toBe(403);
});
