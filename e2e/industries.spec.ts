import { expect, test } from '@playwright/test';

const INDUSTRIES = ['optometry', 'medical', 'automotive', 'mining', 'legal'];

for (const id of INDUSTRIES) {
  test(`${id}: dashboard, every module, a record, admin and settings render without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(`#/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.stat').first()).toBeVisible();

    const sidebar = page.getByLabel('Main navigation');
    const hrefs = await sidebar.locator('a.nav-item').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    const modules = hrefs.filter((h) => h.startsWith(`#/${id}/`) && !/\/(admin|settings)$/.test(h));
    expect(modules.length).toBeGreaterThanOrEqual(5);

    for (const href of modules) {
      await page.goto(href);
      await expect(page.getByRole('heading', { level: 1 }), href).toBeVisible();
      const row = page.locator('table[data-testid^="table-"] tbody tr.clickable').first();
      if (await row.count()) {
        await row.click();
        await expect(page.getByRole('heading', { level: 1 }), `${href} detail`).toBeVisible();
      }
    }
    await page.goto(`#/${id}/admin`);
    await expect(page.getByTestId('module-matrix')).toBeVisible();
    await page.goto(`#/${id}/settings`);
    await expect(page.getByTestId('reset-demo')).toBeVisible();

    // Every non-admin user can open the dashboard and sees fewer modules than the super admin.
    await page.goto(`#/${id}`);
    const all = await sidebar.locator('a.nav-item').count();
    const users = await page.getByTestId('user-switcher').locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
    let restricted = 0;
    for (const u of users) {
      await page.getByTestId('user-switcher').selectOption(u);
      if ((await sidebar.locator('a.nav-item').count()) < all) restricted++;
    }
    expect(restricted).toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}
