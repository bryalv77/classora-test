import { expect, test, type Page } from '@playwright/test';

// Tests e2e para errores con MSW
const stubFetch = (page: Page, method: string, path: string, status: number, body: unknown) =>
  page.addInitScript(
    ([m, p, s, b]) => {
      const g = globalThis as unknown as { fetch: (input: string, init?: { method?: string }) => Promise<unknown> };
      const original = g.fetch;
      g.fetch = (input, init) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        if (method === m && new URL(input, 'http://x').pathname.startsWith(p as string)) {
          return Promise.resolve(Response.json(b, { status: s as number, headers: { 'Content-Type': 'application/problem+json' } }));
        }
        return original(input, init);
      };
    },
    [method, path, status, body] as const,
  );

for (const [status, message] of [
  [409, 'no se puede modificar'],
  [403, 'No tienes permiso'],
] as const) {
  test(`PATCH ${status}: the row goes back to REPORTED and the user is told`, async ({ page }) => {
    await stubFetch(page, 'PATCH', '/api/v1/tickets/', status, { type: 'about:blank', title: 'Error', status });
    await page.goto('/');
    await page.getByLabel('Buscar').fill('SEC-1000');
    const row = page.getByRole('row').nth(1);
    await expect(row).toContainText('Reportado');

    await page.getByRole('button', { name: 'Fijar fecha de compromiso de SEC-1000' }).click();
    await page.getByLabel('Fecha de compromiso de SEC-1000').fill('2026-12-01');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('alert')).toContainText(message);
    await expect(row).toContainText('Reportado');
  });
}

test('without tickets.update the action is not rendered', async ({ page }) => {
  await stubFetch(page, 'GET', '/api/v1/me', 200, { permissions: [] });
  await page.goto('/');

  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: /Fijar fecha de compromiso/ })).toHaveCount(0);
});
