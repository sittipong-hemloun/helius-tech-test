import { expect, resetData, rows, test } from './fixtures';

test.beforeEach(() => resetData());

test('seed data: 5 records with all 7 fields; Bob Brown is In Active (AC-01, AC-03, AC-26)', async ({ page }) => {
  await page.goto('/employees');
  await expect(rows(page)).toHaveCount(5);
  await expect(page.getByText('1–5 of 5 employees')).toBeVisible();
  const headers = await page.locator('thead th').allInnerTexts();
  expect(headers.map((h) => h.trim()).filter(Boolean)).toEqual(['ID', 'Name', 'Department', 'Salary', 'Join date', 'Status', 'Last updated', 'Actions']);
  const bob = rows(page).filter({ hasText: 'Bob Brown' });
  await expect(bob).toContainText('104');
  await expect(bob).toContainText('Engineering');
  await expect(bob).toContainText('72,000.00');
  await expect(bob).toContainText('10 Nov 2022');
  await expect(bob).toContainText('In Active');
  await expect(bob).toContainText('01 Mar 2026');
  await expect(rows(page).filter({ hasText: 'John Doe' })).toContainText('10 Jan 2026');
  await expect(page.getByRole('link', { name: 'Add employee' })).toBeVisible();
});

test('search and filters combine, live in the URL and clear back to 5 (AC-21, AC-22, AC-24)', async ({ page }) => {
  await page.goto('/employees');
  await page.getByLabel('Search by name').fill('JOHN');
  await expect(page).toHaveURL(/q=JOHN/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('John Doe');

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(rows(page)).toHaveCount(5);
  await page.getByLabel('Department').selectOption('engineering');
  await page.getByLabel('Status').selectOption('inactive');
  await expect(page).toHaveURL(/departmentId=engineering/);
  await expect(page).toHaveURL(/status=inactive/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Bob Brown');

  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByLabel('Status')).toHaveValue('inactive');

  await page.goBack();
  await expect(page.getByLabel('Status')).toHaveValue('all');
  await page.goForward();
  await expect(page.getByLabel('Status')).toHaveValue('inactive');

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(rows(page)).toHaveCount(5);
  await expect(page).toHaveURL(/\/employees$/);
});

test('sort, page size and page reset (AC-24, AC-25)', async ({ page }) => {
  await page.goto('/employees?pageSize=10');
  await page.getByRole('button', { name: /^Name/ }).click();
  await expect(page).toHaveURL(/sortBy=name/);
  await expect(rows(page).first()).toContainText('Alice Wong');
  await page.getByRole('button', { name: /^Name/ }).click();
  await expect(page).toHaveURL(/sortOrder=desc/);
  await expect(rows(page).first()).toContainText('John Doe');
  await expect(page.locator('th[aria-sort="descending"]')).toContainText('Name');
  await page.reload();
  await expect(rows(page).first()).toContainText('John Doe');

  await page.goto('/employees?q=zzz');
  await expect(page.getByText('No matching employees.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).last().click();
  await expect(rows(page)).toHaveCount(5);
});

test('create → edit → delete journey (AC-04, AC-12, AC-13, AC-17)', async ({ page }) => {
  await page.goto('/employees/new');
  await expect(page.getByText('Assigned on save')).toHaveCount(2);
  await expect(page.getByLabel('Active')).toBeChecked();
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.getByText('Name is required.')).toBeVisible();
  await expect(page.getByLabel('Name')).toBeFocused();

  await page.getByLabel('Name').fill('Dana Lee');
  await page.getByLabel('Department').selectOption('engineering');
  await expect(page.getByLabel('Department').locator('option')).toHaveCount(5); // placeholder + 4
  await page.getByLabel('Salary').fill('62000.999');
  await page.getByLabel('Join date').fill('2026-09-01');
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page.getByText('Salary must have at most 2 decimal places.')).toBeVisible();
  await expect(page.getByLabel('Salary')).toHaveValue('62000.999'); // not rounded silently

  await page.getByLabel('Salary').fill('62000');
  await page.getByLabel('Salary').blur();
  await expect(page.getByLabel('Salary')).toHaveValue('62,000.00');
  await page.getByRole('button', { name: 'Save employee' }).click();
  await expect(page).toHaveURL(/\/employees\/106$/);
  await expect(page.getByText('Employee created.')).toBeVisible();
  await expect(page.getByLabel('Employee ID 106')).toBeVisible();
  await expect(page.locator('dl')).toContainText('62,000.00');
  await expect(page.locator('dl')).toContainText('01 Sep 2026');

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Salary').fill('63000.00');
  await page.getByLabel('Active').uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Employee updated.')).toBeVisible();
  await expect(page.locator('dl')).toContainText('63,000.00');
  await expect(page.locator('dl')).toContainText('In Active');
  await expect(page.locator('dl')).toContainText(/Version\s*2/);

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog')).toContainText('Dana Lee (ID 106)');
  await expect(page.getByRole('dialog')).toContainText('This action cannot be undone.');
  await page.getByRole('button', { name: 'Delete employee' }).click();
  await expect(page).toHaveURL(/\/employees$/);
  await expect(rows(page)).toHaveCount(5);
  await page.goto('/employees/106');
  await expect(page.getByText('This employee record is unavailable.')).toBeVisible();
});

test('Bob Brown checkbox from In Active to Active (AC-12)', async ({ page }) => {
  await page.goto('/employees/104/edit');
  await expect(page.getByLabel('Active')).not.toBeChecked();
  await page.getByLabel('Active').check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Employee updated.')).toBeVisible();
  await expect(page.locator('dl')).toContainText('Active');
  await expect(page.locator('dl')).not.toContainText('In Active');
});

test('saving without changes is a no-op (AC-14)', async ({ page }) => {
  await page.goto('/employees/101/edit');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('No changes to save.')).toBeVisible();
});

test('cancel delete and cancel an edit leave data unchanged (AC-18)', async ({ page }) => {
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Delete John Doe' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(rows(page)).toHaveCount(5);

  await page.goto('/employees/101/edit');
  await page.getByLabel('Name').fill('Changed Name');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/employees\/101$/);
  await expect(page.locator('h1')).toHaveText('John Doe');
});

test('two tabs editing the same record: the stale tab gets a conflict (AC-16)', async ({ browser }) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto('/employees/102/edit');
  await b.goto('/employees/102/edit');
  await a.getByLabel('Name').fill('Jane Smith-Updated');
  await a.getByRole('button', { name: 'Save changes' }).click();
  await expect(a.getByText('Employee updated.')).toBeVisible();

  await b.getByLabel('Name').fill('Jane Overwrite');
  await b.getByRole('button', { name: 'Save changes' }).click();
  await expect(b.getByText('This employee was changed by another user. Reload the latest version.')).toBeVisible();
  await b.getByRole('button', { name: 'Reload latest' }).click();
  await expect(b.getByLabel('Name')).toHaveValue('Jane Smith-Updated');
  await context.close();
});

test('pagination: page links, URL state and step-back after deleting the last row of a page (AC-24, AC-25)', async ({ page }) => {
  // 12 records → pageSize 10 gives two pages (5 source rows + 7 created through the API).
  for (let i = 1; i <= 7; i += 1) {
    const res = await page.request.post('/api/employees', {
      data: { name: `Paging Person ${i}`, departmentId: 'sales', salary: '1000.00', joinDate: '2025-01-0' + ((i % 9) + 1), isActive: true },
    });
    expect(res.status()).toBe(201);
  }
  await page.goto('/employees?pageSize=10');
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByText('1–10 of 12 employees')).toBeVisible();
  await page.getByRole('button', { name: 'Page 2' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByText('11–12 of 12 employees')).toBeVisible();
  await page.reload();
  await expect(rows(page)).toHaveCount(2);

  // Changing a filter returns to page 1.
  await page.getByLabel('Status').selectOption('active');
  await expect(page).not.toHaveURL(/page=2/);
  await page.goBack();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows(page)).toHaveCount(2);

  // Delete both rows on page 2 → the list steps back to the last page that has data.
  for (let i = 0; i < 2; i += 1) {
    await rows(page).first().getByRole('button', { name: /^Delete / }).click();
    await page.getByRole('button', { name: 'Delete employee' }).click();
    await expect(page.getByText('Employee deleted.').first()).toBeVisible();
  }
  await expect(page).not.toHaveURL(/page=2/);
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByText('1–10 of 10 employees')).toBeVisible();
});
