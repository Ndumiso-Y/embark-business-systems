import { expect, test, type Page } from '@playwright/test';

// Medical practice dashboard (design record: docs/design/08_medical_dashboard_addendum_2026-11.md).
// Figures come from the visit records, safety-relevant alerts stay reachable, permissions and
// client branding behave as before, and no other industry changes.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const kpi = (page: Page, id: string) => page.getByTestId(`kpi-${id}`);
const legend = async (page: Page, label: string) => Number(await page.locator('.od-legend > div', { hasText: label }).locator('dd').textContent());

test.describe('Medical dashboard', () => {
  test('figures agree with each other and with the full schedule', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/medical');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good day, Thandeka');
    await expect(page.locator('.demo-pill')).toContainText('Demonstration');
    const total = Number(await kpi(page, 'visits').locator('.od-kpi-value').textContent());
    expect(total).toBeGreaterThan(0);
    const parts = await Promise.all(['Still to arrive', 'Waiting to be seen', 'With a doctor', 'At billing', 'Done', 'Did not attend'].map((l) => legend(page, l)));
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    const done = parts[4];
    const pct = Math.round((done / total) * 100);
    await expect(page.locator('.od-ring')).toHaveAttribute('aria-label', `${pct}% done: ${done} of ${total} visits done`);
    // The waiting-room card and the waiting-longest list count the same people.
    const waiting = Number(await kpi(page, 'waiting').locator('.od-kpi-value').textContent());
    expect(waiting).toBe(parts[1]);
    await expect(page.getByTestId('waiting-longest').locator('li')).toHaveCount(waiting);
    // Claims stay a Rand amount; no invented trend badge or contact button.
    await expect(kpi(page, 'claims').locator('.od-kpi-value')).toHaveText(/^R[\d,. km]+$/);
    await expect(page.locator('.od')).not.toContainText('+4');
    await expect(page.getByRole('button', { name: /contact/i })).toHaveCount(0);
    // The hour chart adds up to the day.
    const counts = await page.locator('.md-hour-count').allTextContents();
    expect(counts.reduce((n, c) => n + (Number(c) || 0), 0)).toBe(total);
    await page.getByTestId('schedule-toggle').click();
    await expect(page.getByTestId('schedule-list').locator('li')).toHaveCount(total);
    expect(errors).toEqual([]);
  });

  test('needs attention is one click from the top, expands fully, and every row opens its record', async ({ page }) => {
    await page.goto('#/medical');
    const chip = page.getByTestId('attention-jump');
    const n = Number((await chip.textContent())!.match(/\d+/)![0]);
    await chip.click();
    await expect(page.locator('#md-attention')).toBeFocused();
    await expect(page.locator('#md-attention')).toBeInViewport();
    const rows = page.getByTestId('attention-list').locator('li');
    await expect(rows).toHaveCount(Math.min(4, n));
    await page.getByTestId('attention-toggle').click();
    await expect(rows).toHaveCount(n);
    await page.keyboard.press('Escape');
    await expect(rows).toHaveCount(4);
    await expect(page.getByTestId('attention-toggle')).toBeFocused();
    await rows.first().click({ position: { x: 8, y: 8 } });
    await expect(page).toHaveURL(/#\/medical\/(waiting|results|scripts|consults|chronic|claims)\/.+/);
  });

  test('previews expand by keyboard; the chart, activity and role bar are still reachable', async ({ page }) => {
    await page.goto('#/medical');
    const list = page.getByTestId('schedule-list').locator('li');
    await expect(list).toHaveCount(5);
    await page.getByTestId('schedule-toggle').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('schedule-toggle')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(5);
    await page.getByTestId('more-toggle').click();
    await expect(page.getByRole('img', { name: 'Consultations and nurse visits per month' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
    await expect(page.getByTestId('role-bar')).toBeVisible();
  });

  test('shortcuts go where they say', async ({ page }) => {
    for (const [id, url] of [['waiting', /\/waiting$/], ['results', /\/results$/], ['chronic', /\/chronic$/], ['claims', /\/claims$/]] as const) {
      await page.goto('#/medical');
      await kpi(page, id).click();
      await expect(page).toHaveURL(url);
    }
    await page.goto('#/medical');
    await page.getByTestId('waiting-longest').getByRole('link').first().click();
    await expect(page).toHaveURL(/#\/medical\/waiting\/visits_\d+$/);
  });

  test('each simulated user sees only their own modules, and clinical alerts only with clinical access', async ({ page }) => {
    await page.goto('#/medical');
    for (const id of ['u_partner', 'u_gp', 'u_locum', 'u_nurse', 'u_rec', 'u_bill']) {
      await signInAs(page, id);
      await expect(page.locator('.od')).toBeVisible();
      for (const t of ['schedule-toggle', 'attention-toggle']) if (await page.getByTestId(t).count()) await page.getByTestId(t).click();
      const allowed = await page.locator('.sidebar a.nav-item').evaluateAll((els) => els.map((a) => (a.getAttribute('href') ?? '').split('/')[2] ?? ''));
      const used = await page.locator('.od a').evaluateAll((els) => els.map((a) => (a.getAttribute('href') ?? '').split('/')[2] ?? ''));
      for (const mod of used) expect(allowed, `${id}: link to "${mod}"`).toContain(mod);
      for (const [card, mod] of [['results', 'results'], ['chronic', 'chronic'], ['claims', 'claims']]) {
        if (!allowed.includes(mod)) await expect(kpi(page, card), `${id} has no ${mod}`).toHaveCount(0);
      }
      if (!allowed.includes('results')) await expect(page.getByTestId('results-summary')).toHaveCount(0);
    }
    // The receptionist has no clinical access, so vitals highlights are not listed.
    await signInAs(page, 'u_rec');
    if (await page.getByTestId('attention-toggle').count()) await page.getByTestId('attention-toggle').click();
    await expect(page.locator('.od')).not.toContainText('for doctor review');
  });

  test('client branding renames and recolours the dashboard and the navy sidebar', async ({ page }) => {
    await page.goto('#/medical');
    const stroke = () => page.locator('.od-ring-seg.is-done').evaluate((el) => getComputedStyle(el).stroke);
    const defaultStroke = await stroke();
    await page.goto('?name=Harbourview%20Clinic&accent=0f766e#/medical');
    await expect(page.locator('.od-sub')).toContainText('Harbourview Clinic');
    await expect(page.locator('.od')).not.toContainText('Acacia');
    expect(await stroke()).not.toBe(defaultStroke);
    expect(await page.locator('.sidebar .nav-item').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  });

  for (const width of [1440, 1280, 1024, 768, 390, 360]) {
    test(`layout at ${width}px: no sideways scroll, nothing spills, touch targets`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('#/medical');
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      const spills = await page.locator('.od-kpi').evaluateAll((cards) => cards.filter((c) => Array.from(c.querySelectorAll('.od-kpi-value, .od-kpi-label')).some((el) => el.getBoundingClientRect().right > c.getBoundingClientRect().right + 0.5)).length);
      expect(spills).toBe(0);
      for (const t of ['schedule-toggle', 'attention-toggle', 'more-toggle', 'attention-jump']) {
        const b = (await page.getByTestId(t).boundingBox())!;
        expect(b.height, `${t} height`).toBeGreaterThanOrEqual(44);
      }
      await page.getByTestId('schedule-toggle').click();
      await page.getByTestId('more-toggle').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
