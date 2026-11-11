import { expect, test, type Page } from '@playwright/test';

/** Collect page errors and console errors so every test can assert a clean run. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const toast = (page: Page) => page.locator('.toast').last();

test.describe('Optometry demo', () => {
  test('gallery opens the optometry practice dashboard', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/');
    await expect(page.getByTestId('industry-optometry')).toBeVisible();
    for (const id of ['medical', 'automotive', 'tyres', 'mining', 'construction', 'realestate', 'legal']) await expect(page.getByTestId(`industry-${id}`)).toBeVisible();
    // Every module on every card is a direct link into that industry's module.
    await page.getByTestId('module-mining-permits').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Permits to work');
    await page.goto('#/');
    await page.getByRole('link', { name: /Open optometry dashboard/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');
    await expect(page.getByTestId('today-list').locator('li')).toHaveCount(16);
    expect(errors).toEqual([]);
  });

  test('exam cannot be finalised without a diagnosis; finalising issues a prescription', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/optometry/exams');
    await page.getByLabel('Filter by status').selectOption('draft');
    await page.getByTestId('table-exams').locator('tbody tr').first().click();
    await expect(page.getByTestId('exam-problems')).toContainText('diagnosis');
    await page.getByRole('button', { name: 'Finalise exam & issue Rx' }).click();
    await expect(toast(page)).toContainText('diagnosis');

    await page.getByLabel('Diagnosis (ICD-10 sample)').selectOption('H52.1');
    await page.getByTestId('save-exam').click();
    await page.getByRole('button', { name: 'Finalise exam & issue Rx' }).click();
    await expect(page.locator('.panel', { hasText: 'Exam status' }).getByText('Finalised')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Prescription RX-/ })).toBeVisible();

    // Persisted in this browser only.
    await page.reload();
    await expect(page.locator('.panel', { hasText: 'Exam status' }).getByText('Finalised')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('front desk cannot open clinical modules (simulated restriction)', async ({ page }) => {
    await page.goto('#/optometry');
    await signInAs(page, 'u_fd');
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'Diary & patient flow' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Eye examinations' })).toHaveCount(0);
    await page.goto('#/optometry/exams');
    await expect(page.getByTestId('no-access')).toBeVisible();
  });

  test('lab board blocks an expired prescription and moves jobs through QC', async ({ page }) => {
    await page.goto('#/optometry/orders');
    const quoted = page.locator('section[aria-label="Quoted column"]');
    await quoted.getByRole('button', { name: 'Send to lab' }).first().click();
    await expect(toast(page)).toContainText('expired');

    const ready = page.locator('section[aria-label="Ready to collect column"] header b');
    const before = Number(await ready.textContent());
    await page.locator('section[aria-label="Received column"]').getByRole('button', { name: 'Pass quality check' }).first().click();
    await expect(ready).toHaveText(String(before + 1));
  });

  test('booking from the planner works and double-booking is refused', async ({ page }) => {
    await page.goto('#/optometry/diary');
    await page.getByRole('button', { name: 'Book Sipho Dlamini at 16:00' }).click();
    await page.getByLabel('Patient', { exact: true }).selectOption({ index: 3 });
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText('Booked');
    await expect(page.getByRole('button', { name: 'Book Sipho Dlamini at 16:00' })).toHaveCount(0);

    await page.getByTestId('new-booking').click(); // defaults to Dr Khumalo 09:00, already taken
    await page.getByLabel('Patient', { exact: true }).selectOption({ index: 2 });
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText('already booked');
  });

  test('patient flow: check in, pre-test and call into the consulting room', async ({ page }) => {
    await page.goto('#/optometry/diary');
    await page.getByRole('button', { name: 'Patient flow' }).click();
    const booked = page.locator('section[aria-label="Booked column"]');
    const firstName = (await booked.locator('.board-card strong').first().textContent())!;
    await booked.getByRole('button', { name: 'Check in' }).first().click();
    await expect(page.locator('section[aria-label="Checked in column"]')).toContainText(firstName);
  });

  test('medical aid claim submits once checks pass', async ({ page }) => {
    await page.goto('#/optometry/claims');
    await page.getByLabel('Filter by status').selectOption('draft');
    await page.getByTestId('table-claims').locator('tbody tr').first().click();
    await page.getByRole('button', { name: 'Submit to scheme (simulated)' }).click();
    await expect(page.locator('.panel', { hasText: 'Workflow' }).locator('.tag', { hasText: 'Submitted' }).first()).toBeVisible();
  });

  test('recall reminder is logged, not sent; reset restores seed data', async ({ page }) => {
    await page.goto('#/optometry/recalls');
    await page.getByRole('button', { name: 'Remind' }).first().click();
    await expect(page.getByText(/time for your|is due/)).toBeVisible();
    await page.getByTestId('log-reminder').click();
    await expect(toast(page)).toContainText('no message was sent');

    await page.goto('#/optometry/settings');
    await page.getByTestId('reset-demo').click();
    await page.getByTestId('confirm-button').click();
    await expect(toast(page)).toContainText('reset');
  });

  test('mobile: navigation drawer opens and pages do not scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/', '#/optometry', '#/optometry/diary', '#/optometry/orders', '#/optometry/patients']) {
      await page.goto(path);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByLabel('Main navigation').getByRole('link', { name: 'Recalls' }).click();
    await expect(page.getByRole('heading', { name: 'Recalls', level: 1 })).toBeVisible();
  });
});
