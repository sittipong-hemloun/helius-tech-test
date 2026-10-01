import { ADMIN, expect, resetData, rows, signIn, test } from './fixtures';

test.beforeEach(() => resetData());

for (const timezoneId of ['UTC', 'Asia/Bangkok', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
  test(`dates do not shift in ${timezoneId} (AC-11)`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId });
    await signIn(context, ADMIN);
    const page = await context.newPage();
    await page.goto('/employees');
    const john = rows(page).filter({ hasText: 'John Doe' });
    await expect(john).toContainText('15 Jan 2023');
    await expect(john).toContainText('10 Jan 2026');
    await page.goto('/employees/101/edit');
    await expect(page.getByLabel('Join date')).toHaveValue('2023-01-15');
    await page.getByLabel('Join date').fill('2024-02-29');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('dl')).toContainText('29 Feb 2024');
    await context.close();
  });
}

test('mobile 375px: no page overflow, stacked filters, usable form (AC-35)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await signIn(context, ADMIN);
  const page = await context.newPage();
  await page.goto('/employees');
  await expect(rows(page)).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const search = await page.getByLabel('Search by name').boundingBox();
  const dept = await page.getByLabel('Department').boundingBox();
  expect(dept!.y).toBeGreaterThan(search!.y); // stacked vertically

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible();

  await page.goto('/employees/new');
  await page.getByLabel('Name').fill('Mobile Person');
  await page.getByLabel('Department').selectOption('hr');
  await page.getByLabel('Salary').fill('1000');
  await page.getByLabel('Join date').fill('2026-01-05');
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.getByText('Employee created.')).toBeVisible();
  await context.close();
});

test('keyboard: labels, visible focus and Enter-free form navigation (AC-35)', async ({ admin: page }) => {
  await page.goto('/employees');
  await page.keyboard.press('Tab'); // skip link
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByLabel('Search by name').focus();
  const outline = await page.getByLabel('Search by name').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.goto('/employees/new');
  for (const label of ['Name', 'Department', 'Active', 'Salary', 'Join date']) await expect(page.getByLabel(label)).toBeVisible();
  await page.getByRole('button', { name: 'Save employee' }).click();
  // Errors are text with an icon, not colour alone.
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a department.' })).toBeVisible();
});
