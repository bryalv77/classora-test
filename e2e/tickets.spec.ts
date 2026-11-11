import { expect, test } from '@playwright/test';

// Tests e2e con playwright para asegurar calidad

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('table')).toBeVisible();
});

const rows = (page: import('@playwright/test').Page) => page.getByRole('row');

test('loads the first page of tickets', async ({ page }) => {
  await expect(rows(page)).toHaveCount(21);
  await expect(page.getByText('1 / 7')).toBeVisible();
});

test('a filter goes to the URL, filters the rows and survives a reload (shareable link)', async ({ page }) => {
  await page.getByLabel('Estado').selectOption('DONE');

  await expect(page).toHaveURL(/state=DONE/);
  await expect(rows(page).filter({ hasNotText: 'Hecho' })).toHaveCount(1);
  await expect(page.getByText('1 / 2')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Estado')).toHaveValue('DONE');
  await expect(rows(page).filter({ hasNotText: 'Hecho' })).toHaveCount(1);
});

test('back and forward restore the filters', async ({ page }) => {
  await page.getByLabel('Estado').selectOption('DONE');
  await expect(page).toHaveURL(/state=DONE/);

  await page.goBack();
  await expect(page.getByLabel('Estado')).toHaveValue('ALL');
  await page.goForward();
  await expect(page.getByLabel('Estado')).toHaveValue('DONE');
});

test('search waits for a pause in typing: one request, not one per key', async ({ page }) => {
  const listRequests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/v1/tickets') listRequests.push(r.url());
  });

  await page.getByLabel('Buscar').pressSequentially('SEC-1005', { delay: 40 });

  await expect(page).toHaveURL(/q=SEC-1005/);
  await expect(rows(page)).toHaveCount(2);
  expect(listRequests.filter((u) => u.includes('q='))).toHaveLength(1);
});

test('sorts from the column headers, both directions', async ({ page }) => {
  await page.getByRole('button', { name: 'Clave' }).click();
  await expect(page).toHaveURL(/sort=KEY&direction=ASC/);
  await expect(rows(page).nth(1)).toContainText('SEC-1000');

  await page.getByRole('button', { name: /Clave/ }).click();
  await expect(rows(page).nth(1)).toContainText('SEC-1133');
});

test('sets a commitment date: the row updates and a REPORTED ticket moves to IN_PROGRESS', async ({ page }) => {
  await page.getByLabel('Buscar').fill('SEC-1000');
  const row = rows(page).nth(1);
  await expect(row).toContainText('Reportado');

  await page.getByRole('button', { name: 'Fijar fecha de compromiso de SEC-1000' }).click();
  await page.getByLabel('Fecha de compromiso de SEC-1000').fill('2026-12-01');
  await page.getByRole('button', { name: 'Guardar' }).click();

  const shown = await page.evaluate(() => new Date('2026-12-01T12:00:00Z').toLocaleDateString());
  await expect(row).toContainText('En curso');
  await expect(row).toContainText(shown);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a manipulated URL is normalized: the page works and shows the first page', async ({ page }) => {
  await page.goto('/?offset=-5&limit=9999&state=FOO');

  await expect(rows(page)).toHaveCount(21);
  await expect(page.getByLabel('Estado')).toHaveValue('ALL');
  await expect(page.getByText('1 / 7')).toBeVisible();
});

test('changing a filter resets the page, changing the page keeps the filters', async ({ page }) => {
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/offset=20/);
  await expect(page.getByText('2 / 7')).toBeVisible();

  await page.getByLabel('Estado').selectOption('IN_PROGRESS');
  await expect(page).toHaveURL(/state=IN_PROGRESS/);
  await expect(page).not.toHaveURL(/offset=/);
  await expect(page.getByText(/^1 \/ /)).toBeVisible();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/state=IN_PROGRESS/);
  await expect(page).toHaveURL(/offset=20/);
});
