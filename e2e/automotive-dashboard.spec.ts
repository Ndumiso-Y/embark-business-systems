import { expect, test, type Page } from '@playwright/test';

// Automotive workshop dashboard (design record: docs/design/09_automotive_dashboard_addendum_2026-11.md).
// Figures come from the job cards, the approval-before-work gate stays visible, every list from the
// previous dashboard is still there, permissions and branding behave, and no other industry changes.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const kpi = (page: Page, id: string) => page.getByTestId(`kpi-${id}`);
const value = async (page: Page, id: string) => Number(await kpi(page, id).locator('.od-kpi-value').textContent());

test.describe('Automotive dashboard', () => {
  test('figures agree: ring, legend, stage track, KPI cards and lists', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/automotive');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good day, Gareth');
    await expect(page.locator('.demo-pill')).toContainText('Demonstration');
    const onSite = Number(await page.locator('.od-ring figcaption b').textContent());
    expect(await value(page, 'workshop')).toBe(onSite);
    // Each legend cell is "<count><span>pct%</span>": read the count without the percentage.
    const counts = await page.locator('.au-legend dd').evaluateAll((els) => els.map((el) => Number(el.firstChild?.textContent ?? 'NaN')));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(onSite);
    const track = (await page.locator('.au-track small').allTextContents()).map((t) => Number(t.match(/\d+/)![0]));
    expect(track).toEqual(counts);
    const pcts = (await page.locator('.au-legend dd span').allTextContents()).map((t) => Number(t.replace('%', '')));
    pcts.forEach((p, i) => expect(p).toBe(Math.round((counts[i] / onSite) * 100)));
    // Awaiting approval and ready cards match their lists (unchanged test hooks).
    await expect(page.getByTestId('awaiting-list').locator('li')).toHaveCount(await value(page, 'approval'));
    await expect(page.getByTestId('ready-list').locator('li')).toHaveCount(await value(page, 'ready'));
    // The approval-before-work rule is stated next to the flow.
    await expect(page.locator('.au-gate')).toContainText('Work starts only after the customer approves the estimate');
    // Bookings: the card, the list and the bay capacity agree.
    const bookings = await value(page, 'bookings');
    const toggle = page.getByTestId('bookings-toggle');
    if (await toggle.count()) await toggle.click();
    await expect(page.getByTestId('bookings-list').locator('li')).toHaveCount(bookings);
    await expect(page.getByTestId('capacity')).toContainText(/of 32 h across 4 bays · \d+%/);
    // Unpaid invoices stay a Rand amount; no invented trend or capacity figures.
    await expect(kpi(page, 'unpaid').locator('.od-kpi-value')).toHaveText(/^R[\d,. km]+$/);
    await expect(page.locator('.od')).not.toContainText(/vs\. last|\+\d+%|Weekly capacity/);
    expect(errors).toEqual([]);
  });

  test('every list expands and collapses, the attention button jumps to the list, and rows open records', async ({ page }) => {
    await page.goto('#/automotive');
    const n = Number((await page.getByTestId('attention-jump').textContent())!.match(/\d+/)![0]);
    await page.getByTestId('attention-jump').click();
    await expect(page.locator('#au-attention')).toBeFocused();
    const rows = page.getByTestId('attention-list').locator('li');
    await expect(rows).toHaveCount(Math.min(3, n));
    await page.getByTestId('attention-toggle').click();
    await expect(rows).toHaveCount(n);
    await page.keyboard.press('Escape');
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId('attention-toggle')).toBeFocused();
    const cards = page.getByTestId('open-cards').locator('tbody tr');
    const total = await value(page, 'workshop');
    await expect(cards).toHaveCount(Math.min(5, total));
    if (total > 5) { await page.getByTestId('cards-toggle').click(); await expect(cards).toHaveCount(total); }
    await page.getByTestId('more-toggle').click();
    await expect(page.getByRole('img', { name: 'Labour and parts revenue per month' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Low stock' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
    await expect(page.getByTestId('role-bar')).toBeVisible();
    await rows.first().click({ position: { x: 8, y: 8 } });
    await expect(page).toHaveURL(/#\/automotive\/(jobs|invoices|parts)\/.+/);
  });

  test('shortcuts go where they say', async ({ page }) => {
    for (const [id, url] of [['bookings', /\/planner$/], ['workshop', /\/jobs$/], ['approval', /\/jobs$/], ['ready', /\/jobs$/], ['unpaid', /\/invoices$/]] as const) {
      await page.goto('#/automotive');
      await kpi(page, id).click();
      await expect(page).toHaveURL(url);
    }
    await page.goto('#/automotive');
    await page.getByTestId('open-cards').getByRole('link').first().click();
    await expect(page).toHaveURL(/#\/automotive\/jobs\/jobs_[a-z_]*\d+$/);
  });

  test('each simulated user only gets links to modules in their own menu', async ({ page }) => {
    await page.goto('#/automotive');
    for (const id of ['u_owner', 'u_adv', 'u_fore', 'u_tech', 'u_clerk']) {
      await signInAs(page, id);
      await expect(page.locator('.od')).toBeVisible();
      for (const t of ['bookings-toggle', 'cards-toggle', 'attention-toggle']) if (await page.getByTestId(t).count()) await page.getByTestId(t).click();
      const allowed = await page.locator('.sidebar a.nav-item').evaluateAll((els) => els.map((a) => (a.getAttribute('href') ?? '').split('/')[2] ?? ''));
      const used = await page.locator('.od a').evaluateAll((els) => els.map((a) => (a.getAttribute('href') ?? '').split('/')[2] ?? ''));
      for (const mod of used) expect(allowed, `${id}: link to "${mod}"`).toContain(mod);
      if (allowed.includes('invoices')) await expect(kpi(page, 'unpaid')).toHaveCount(1);
      else await expect(kpi(page, 'unpaid')).toHaveCount(0);
    }
    // The technician has parts but no invoices, so the fifth card is "Parts low".
    await signInAs(page, 'u_tech');
    await expect(kpi(page, 'parts')).toBeVisible();
  });

  test('client branding renames and recolours; the sidebar stays dark and the car stays neutral', async ({ page }) => {
    await page.goto('?name=Westside%20Motors&accent=1f6fd6#/automotive');
    await expect(page.locator('.od-sub')).toContainText('Westside Motors');
    await expect(page.locator('.od')).not.toContainText('Torque Lane');
    const accent = await page.locator('.app').evaluate((el) => getComputedStyle(el).getPropertyValue('--accent').trim());
    expect(accent).not.toBe('#b4572e');
    expect(await page.locator('.sidebar .nav-item').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
    expect(await page.locator('.au-car-body').evaluate((el) => getComputedStyle(el).stroke)).toBe('rgb(91, 104, 120)');
  });

  test('other industries keep their own look', async ({ page }) => {
    for (const id of ['mining', 'tyres']) {
      await page.goto(`#/${id}`);
      await expect(page.locator('.dash-hero')).toBeVisible();
      await expect(page.locator('.od')).toHaveCount(0);
      expect(await page.locator('.sidebar').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    }
  });

  for (const width of [1440, 1280, 1024, 768, 390, 360]) {
    test(`layout at ${width}px: no sideways scroll, nothing spills, touch targets`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('#/automotive');
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      const spills = await page.locator('.od-kpi, .au-flow, .au-cards').evaluateAll((boxes) => boxes.filter((c) => {
        const r = c.getBoundingClientRect();
        return Array.from(c.querySelectorAll('.od-kpi-value, .od-kpi-label, .au-legend dd, .au-table .tag')).some((el) => el.getBoundingClientRect().right > r.right + 0.5);
      }).length);
      expect(spills).toBe(0);
      for (const t of ['bookings-toggle', 'attention-toggle', 'more-toggle', 'attention-jump']) {
        const b = (await page.getByTestId(t).boundingBox())!;
        expect(b.height, `${t} height`).toBeGreaterThanOrEqual(44);
      }
    });
  }
});
