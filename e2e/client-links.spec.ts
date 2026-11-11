import { expect, test } from '@playwright/test';

// Runs against the multi-site Pages build: `npm run build:pages`, serve dist-pages/,
// then PAGES_URL=http://host/path/ npm run e2e. Skipped otherwise.
const PAGES = process.env.PAGES_URL;
const SITES = [
  { slug: 'optometry', id: 'optometry', name: 'Northgate Optometry' },
  { slug: 'medical-practice', id: 'medical', name: 'Acacia Family Practice' },
  { slug: 'automotive', id: 'automotive', name: 'Torque Lane Auto Services' },
  { slug: 'mining', id: 'mining', name: 'Ridgeback Minerals' },
  { slug: 'law-firm', id: 'legal', name: 'Mahlaba & Rossouw Attorneys' },
  { slug: 'real-estate', id: 'realestate', name: 'Kestrel Property Group' },
  { slug: 'construction', id: 'construction', name: 'Ironbark Building & Civils' },
  { slug: 'tyre-fitment', id: 'tyres', name: 'TreadRight Tyre & Fitment' },
];
const HUB = 'hub-k7q3m9';

test.describe('client links (one industry per link)', () => {
  test.skip(!PAGES, 'PAGES_URL not set');

  for (const s of SITES) {
    test(`${s.slug}: opens on its own dashboard with no route to other demos`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${PAGES}${s.slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');
      await expect(page).toHaveTitle(`${s.name} · Demonstration`);
      await expect(page.getByRole('link', { name: 'All industry demos' })).toHaveCount(0);

      // The gallery route and other industries' routes all land back on this dashboard.
      for (const other of ['', ...SITES.filter((x) => x.id !== s.id).map((x) => x.id)]) {
        await page.goto(`${PAGES}${s.slug}/#/${other}`);
        await expect(page).toHaveURL(new RegExp(`#/${s.id}$`));
      }
      const html = await page.content();
      for (const o of SITES.filter((x) => x.id !== s.id)) expect(html).not.toContain(o.name);
      expect(errors).toEqual([]);
    });
  }

  test('the site root lists no demos', async ({ page }) => {
    await page.goto(PAGES!);
    await expect(page.getByRole('heading', { name: 'Client demonstrations' })).toBeVisible();
    await expect(page.locator('a')).toHaveCount(0);
  });

  test('the unlisted hub still shows every industry', async ({ page }) => {
    await page.goto(`${PAGES}${HUB}/`);
    for (const s of SITES) await expect(page.getByTestId(`industry-${s.id}`)).toBeVisible();
  });
});
