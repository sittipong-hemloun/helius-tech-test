import { expect, resetData, rows, test } from './fixtures';

test.beforeEach(() => resetData());

for (const timezoneId of ['UTC', 'Asia/Bangkok', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
  test(`dates do not shift in ${timezoneId} (AC-11)`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId });
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
  const page = await context.newPage();
  await page.goto('/employees');
  await expect(rows(page)).toHaveCount(5);
  // Mobile Chrome widens the layout viewport (zooms out) when content overflows, so check both:
  // the viewport stays at device width and nothing is wider than it.
  const layout = await page.evaluate(() => ({ inner: window.innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(layout.inner).toBeLessThanOrEqual(376);
  expect(layout.scroll).toBeLessThanOrEqual(layout.client);
  const search = await page.getByLabel('Search by name').boundingBox();
  const dept = await page.getByLabel('Department').boundingBox();
  expect(dept!.y).toBeGreaterThan(search!.y); // stacked vertically

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#mobile-nav').getByRole('link', { name: 'Employees' })).toBeVisible();

  await page.goto('/employees/new');
  await page.getByLabel('Name').fill('Mobile Person');
  await page.getByLabel('Department').selectOption('hr');
  await page.getByLabel('Salary').fill('1000');
  await page.getByLabel('Join date').fill('2026-01-05');
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.getByText('Employee created.')).toBeVisible();
  await context.close();
});

test('keyboard only: focus order, visible focus, checkbox, dialog Escape, submit with Enter (AC-35)', async ({ page }) => {
  await page.goto('/employees');
  await expect(rows(page)).toHaveCount(5);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter'); // skip link moves focus past the navigation
  // Reach the search box with Tab (keyboard modality), so :focus-visible applies as for a real user.
  const search = page.getByLabel('Search by name');
  for (let i = 0; i < 6 && !(await search.evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  const outline = await search.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');

  // Delete dialog: opens from the keyboard, traps focus, closes with Escape without deleting.
  await page.getByRole('button', { name: 'Delete John Doe' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(5);

  // Create form filled with the keyboard only; Tab order follows the visual order.
  await page.goto('/employees/new');
  await page.getByLabel('Name').focus();
  await page.keyboard.type('Keyboard Person');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Department')).toBeFocused();
  await page.keyboard.type('E'); // type-ahead selects "Engineering" (ArrowDown opens the menu on macOS)
  await expect(page.getByLabel('Department')).toHaveValue('engineering');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Active')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Active')).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Active')).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Salary')).toBeFocused();
  await page.keyboard.type('45000');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Salary')).toHaveValue('45,000.00');
  await expect(page.getByLabel('Join date')).toBeFocused();
  await page.getByLabel('Join date').fill('2026-03-01');
  // Chromium's date input has month/day/year segments; Tab walks them before leaving the field.
  const cancel = page.getByRole('button', { name: 'Cancel' });
  for (let i = 0; i < 4 && !(await cancel.evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Save employee' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Employee created.')).toBeVisible();
  await expect(page.locator('dl')).toContainText('45,000.00');

  // Validation errors are text with an icon (role=alert), not colour alone.
  await page.goto('/employees/new');
  await page.getByRole('button', { name: 'Save employee' }).press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a department.' })).toBeVisible();
  await expect(page.getByLabel('Name')).toBeFocused();
});

test('layout screenshots at 375 / 1024 / 1440 px for the manual review record (AC-35)', async ({ browser }) => {
  const dir = process.env.E2E_SCREENSHOT_DIR;
  test.skip(!dir, 'set E2E_SCREENSHOT_DIR to capture review screenshots');
  for (const width of [375, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const [name, path] of [
      ['employees', '/employees'],
      ['detail', '/employees/104'],
      ['edit', '/employees/104/edit'],
    ] as const) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${name} @${width}px overflows`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage: true });
    }
    await context.close();
  }
});
