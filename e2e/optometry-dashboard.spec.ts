import { expect, test, type Page } from '@playwright/test';

// Optometry dashboard (design record: docs/design/06_optometry_dashboard_addendum_2026-11.md).
// Figures must come from the demo records, disclosures must work by mouse and keyboard,
// permissions and client branding must behave as before, and no other industry may change.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const kpi = (page: Page, label: string) => page.locator('.od-kpi', { hasText: label });
const legend = async (page: Page, label: string) => Number(await page.locator('.od-legend > div', { hasText: label }).locator('dd').textContent());

test.describe('Optometry dashboard', () => {
  test('figures agree with each other and with the diary', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/optometry');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good day, Lerato');
    await expect(page.locator('.demo-pill')).toContainText('Demonstration');
    await expect(page.locator('.footer-note')).toContainText('fictional');

    const total = Number(await kpi(page, 'Appointments today').locator('.od-kpi-value').textContent());
    expect(total).toBe(16);
    const booked = await legend(page, 'Still to arrive');
    const inPractice = await legend(page, 'In the practice now');
    const completed = await legend(page, 'Completed');
    const noShow = await legend(page, 'Did not attend');
    expect(booked + inPractice + completed + noShow).toBe(total);
    expect(Number(await kpi(page, 'In the practice now').locator('.od-kpi-value').textContent())).toBe(inPractice);

    // The ring's percentage is completed ÷ visits not cancelled, and says so in words.
    const pct = Math.round((completed / total) * 100);
    await expect(page.locator('.od-ring')).toHaveAttribute('aria-label', `${pct}% completed: ${completed} of ${total} visits completed`);
    await expect(page.locator('.od-ring figcaption')).toContainText(`${pct}%`);
    await expect(page.locator('.od-flow-note')).toContainText(`${completed} of ${total} visits completed`);

    // Claims stay a Rand amount with the count beside it; nothing is invented (no trend badge).
    await expect(kpi(page, 'Claims awaiting payment').locator('.od-kpi-value')).toHaveText(/^R[\d,. km]+$/);
    await expect(kpi(page, 'Claims awaiting payment')).toContainText(/\d+ open · \d+ rejected/);
    await expect(page.locator('.od')).not.toContainText('+4');

    // Same count as the diary's own list for today.
    await page.getByTestId('today-toggle').click();
    await expect(page.getByTestId('today-list').locator('li')).toHaveCount(total);
    expect(errors).toEqual([]);
  });

  test('previews expand and collapse by mouse and keyboard, and nothing from the old dashboard is lost', async ({ page }) => {
    await page.goto('#/optometry');
    const today = page.getByTestId('today-list').locator('li');
    await expect(today).toHaveCount(4);
    const toggle = page.getByTestId('today-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(today).toHaveCount(16);
    await page.keyboard.press('Escape');
    await expect(today).toHaveCount(4);
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(today).toHaveCount(16);

    const attention = page.getByTestId('attention-list').locator('li');
    await expect(attention).toHaveCount(3);
    const label = (await page.getByTestId('attention-toggle').textContent())!;
    const all = Number(label.match(/\d+/)![0]);
    await page.getByTestId('attention-toggle').click();
    await expect(attention).toHaveCount(all);

    // Order stages, the six-month chart and recent activity are still here, one click away.
    await page.getByTestId('stages-toggle').click();
    await expect(page.locator('#od-stages .pipeline li')).not.toHaveCount(0);
    await page.getByTestId('more-toggle').click();
    await expect(page.getByRole('img', { name: 'Exams and optical orders per month' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
    await expect(page.locator('#od-more-body')).toContainText(/\d+ exams this month · \d+ in progress/);
    await expect(page.getByTestId('role-bar')).toBeVisible();
  });

  test('every shortcut goes where it says', async ({ page }) => {
    for (const [name, heading] of [
      ['Ready for collection', /Optical orders|Lab/], ['Recalls due', 'Recalls'], ['Claims awaiting payment', /Billing|claims/i],
    ] as const) {
      await page.goto('#/optometry');
      await kpi(page, name).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    }
    await page.goto('#/optometry');
    await page.getByRole('link', { name: 'View day' }).click();
    await expect(page).toHaveURL(/#\/optometry\/diary$/);
    await page.goto('#/optometry');
    await page.getByRole('link', { name: 'Open today’s diary' }).click();
    await expect(page).toHaveURL(/#\/optometry\/diary$/);
    await page.goto('#/optometry');
    const first = page.getByTestId('attention-list').locator('li').first();
    const title = (await first.locator('b').textContent())!;
    await first.click({ position: { x: 8, y: 8 } }); // the whole row is the link
    await expect(page).toHaveURL(/#\/optometry\/(orders|claims|exams|stock)\/.+/);
    expect(title.length).toBeGreaterThan(3);
    await page.goto('#/optometry');
    await page.getByTestId('recent-patients').getByRole('link').first().click();
    await expect(page).toHaveURL(/#\/optometry\/patients\/.+/);
  });

  test('each simulated user only gets links to modules in their own menu', async ({ page }) => {
    await page.goto('#/optometry');
    for (const id of ['u_owner', 'u_opt', 'u_disp', 'u_fd', 'u_mgr']) {
      await signInAs(page, id);
      await expect(page.locator('.od')).toBeVisible();
      for (const t of ['today-toggle', 'attention-toggle', 'stages-toggle']) if (await page.getByTestId(t).count()) await page.getByTestId(t).click();
      const allowed = await page.locator('.sidebar a.nav-item').evaluateAll((els) => els.map((a) => (a.getAttribute('href') ?? '').split('/')[2] ?? ''));
      const used = await page.locator('.od a').evaluateAll((els) => els.map((a) => (a.getAttribute('href') ?? '').split('/')[2] ?? ''));
      expect(used.length, `${id} has dashboard links`).toBeGreaterThan(0);
      for (const mod of used) expect(allowed, `${id}: link to "${mod}"`).toContain(mod);
      // Panels for modules the user lacks are not shown at all.
      if (!allowed.includes('orders')) await expect(page.getByRole('heading', { name: 'Optical orders' })).toHaveCount(0);
      if (!allowed.includes('recalls')) await expect(kpi(page, 'Recalls due')).toHaveCount(0);
    }
  });

  test('client branding still renames and recolours the dashboard and its navy shell', async ({ page }) => {
    await page.goto('#/optometry');
    const stroke = () => page.locator('.od-ring-seg.is-completed').evaluate((el) => getComputedStyle(el).stroke);
    const sidebar = () => page.locator('.sidebar').evaluate((el) => getComputedStyle(el).backgroundImage);
    const defaultStroke = await stroke();
    const defaultSidebar = await sidebar();
    await page.goto('?name=Zenith%20Optical&accent=e11d48#/optometry');
    await expect(page.locator('.od-sub')).toContainText('Zenith Optical');
    await expect(page.locator('.od')).not.toContainText('Northgate');
    expect(await stroke()).not.toBe(defaultStroke);
    expect(await sidebar()).not.toBe(defaultSidebar);
    // Still a dark sidebar with light text, whatever the brand colour.
    const navColour = await page.locator('.sidebar .nav-item').first().evaluate((el) => getComputedStyle(el).color);
    expect(navColour).toBe('rgb(255, 255, 255)');
  });

  test('other industries keep their own look', async ({ page }) => {
    for (const id of ['mining', 'cleaning']) {
      await page.goto(`#/${id}`);
      await expect(page.locator('.dash-hero')).toBeVisible();
      await expect(page.locator('.od')).toHaveCount(0);
      expect(await page.locator('.sidebar').evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
      expect(await page.locator('.sidebar').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    }
  });

  for (const width of [1440, 1024, 768, 390, 360]) {
    test(`layout at ${width}px: no sideways scroll, nothing clipped, touch targets`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('#/optometry');
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      // No KPI value or label spills out of its card.
      const spills = await page.locator('.od-kpi').evaluateAll((cards) => cards.filter((c) => Array.from(c.querySelectorAll('.od-kpi-value, .od-kpi-label')).some((el) => el.getBoundingClientRect().right > c.getBoundingClientRect().right + 0.5)).length);
      expect(spills).toBe(0);
      for (const t of ['today-toggle', 'attention-toggle', 'more-toggle']) {
        const b = (await page.getByTestId(t).boundingBox())!;
        expect(b.height, `${t} height`).toBeGreaterThanOrEqual(44);
      }
      await page.getByTestId('today-toggle').click();
      await page.getByTestId('more-toggle').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
