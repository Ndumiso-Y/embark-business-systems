import { expect, test, type Page } from '@playwright/test';

// TreadRight Tyre & Fitment: the journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage). Today's jobs have fixed ids (jobs_today_N) and
// odometer readings are read off the screen, so nothing depends on the date or the time of day.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const toast = (page: Page) => page.locator('.toast').last();
const anyToast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text });
const panel = (page: Page, title: string) => page.locator('.panel', { has: page.getByRole('heading', { name: title, exact: true }) });
const workflow = (page: Page) => panel(page, 'Workflow');
const status = (page: Page) => workflow(page).locator('.panel-head .tag');
const step = (page: Page, name: string) => workflow(page).getByRole('button', { name, exact: true });
const today = (page: Page) => page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
const WHEELS = ['Left front', 'Right front', 'Left rear', 'Right rear'];
const tickQc = async (page: Page) => {
  for (const box of await page.getByTestId('qc-checklist').getByRole('checkbox').all()) await box.check();
};
/** Last recorded odometer shown in the arrival panel, so a valid reading can be typed on any day. */
const lastOdometer = async (page: Page) => Number((await panel(page, 'Arrival, bay & technician').textContent())!.match(/Last recorded ([\d\s,.]+) km/)![1].replace(/\D/g, ''));
const fillTreads = async (page: Page, values: string[]) => {
  for (const [i, w] of WHEELS.entries()) await page.getByLabel(`${w} tread depth (mm)`).fill(values[i]);
};

// Optional: E2E_FAKE_NOW=2026-11-16T06:10:00 runs the journeys on another day / time of day.
const FAKE_NOW = process.env.E2E_FAKE_NOW;

test.describe('Tyre & fitment journeys', () => {
  test.beforeEach(async ({ page }) => {
    if (FAKE_NOW) await page.clock.install({ time: new Date(FAKE_NOW) });
  });

  test('fitment job: arrival → inspection → quote → approval → fitting → balancing → alignment → torque check → ready → paid → collected', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/tyres/jobs');
    await signInAs(page, 'u_adv');

    // New arrival at the counter: a retail Suzuki Swift on 175/65R14.
    await page.getByTestId('new-record').click();
    await page.getByLabel('Vehicle', { exact: true }).selectOption('vehicles_3');
    await page.getByLabel('Date', { exact: true }).fill(await today(page));
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText(/Fitment job JOB-\d{4} created/);
    await expect(status(page)).toHaveText('Arrived');
    const jobUrl = page.url();
    const jobRef = (await page.locator('.page-kicker').first().textContent())!.match(/JOB-\d{4}/)![0];
    const setup = panel(page, 'Arrival, bay & technician');
    await expect(setup).toContainText('Still needed: the odometer reading');

    // Odometer and technician are captured on the job itself; a reading below the last one is refused.
    const km = (await lastOdometer(page)) + 320;
    await page.getByTestId('job-odometer').fill('100');
    await page.getByTestId('save-setup').click();
    await expect(setup).toContainText('is below the last recorded');
    await page.getByTestId('job-odometer').fill(String(km));
    await page.getByTestId('job-technician').selectOption('md');
    await page.getByTestId('save-setup').click();
    await expect(toast(page)).toContainText('Arrival details saved');

    // Inspection (fitment technician): every wheel needs a tread depth.
    await signInAs(page, 'u_fit');
    await page.getByTestId('complete-inspection').click();
    await expect(toast(page)).toContainText('missing LF, RF, LR, RR');
    await fillTreads(page, ['0.8', '4.2', '5', '5.1']);
    await expect(panel(page, 'Wheel positions')).toContainText('LF below 1.0 mm');
    await page.getByTestId('complete-inspection').click();
    await expect(status(page)).toHaveText('Inspected');

    // Quote (counter): a tyre below the demo legal minimum must be quoted (or the refusal recorded).
    await signInAs(page, 'u_adv');
    await step(page, 'Send quote').click();
    await expect(toast(page)).toContainText('LF 0.8 mm below the 1.0 mm legal minimum');
    await page.getByLabel('Left front quote replacement').check();
    await page.getByTestId('save-wheels').click();
    await page.getByTestId('quote-tyres').click();
    await expect(toast(page)).toContainText('Tyres added to the quote');
    await page.getByLabel('Wheel balancing').check();
    await page.getByLabel('Wheel alignment').check();
    const quote = panel(page, 'Services & quote');
    await expect(quote.getByTestId('lines-table')).toContainText('Wheel alignment');
    await step(page, 'Send quote').click();
    await expect(status(page)).toHaveText('Quoted');

    // Approval (retail): how the customer approved is chosen right under the quote.
    await page.getByTestId('approve-submit').click();
    await expect(page.getByTestId('approve-quote')).toContainText('Record how the customer approved the quote');
    await expect(status(page)).toHaveText('Quoted');
    await page.getByTestId('approve-channel').selectOption('counter');
    await page.getByTestId('approve-submit').click();
    await expect(status(page)).toHaveText('Approved');

    // Fitting needs a free bay. All four are busy; the job says which one is nearest to finishing.
    await signInAs(page, 'u_fit');
    await step(page, 'Start fitting').click();
    await expect(toast(page)).toContainText('Allocate a fitment bay');
    await expect(setup).toContainText('All four fitment bays are occupied');
    await signInAs(page, 'u_align'); // senior technician holds the QC permission
    await setup.getByRole('link', { name: /JOB-\d{4}/ }).click();
    await expect(status(page)).toHaveText('Torque check');
    await tickQc(page);
    await step(page, 'Pass QC — ready').click();
    await expect(status(page)).toHaveText('Ready');

    await page.goto(jobUrl);
    await signInAs(page, 'u_fit');
    await page.getByTestId('job-bay').selectOption('b1');
    await page.getByTestId('save-setup').click();
    await step(page, 'Start fitting').click();
    await expect(status(page)).toHaveText('Fitting');
    await expect(anyToast(page, '1 × 175/65R14 issued from stock — 11 left')).toBeVisible(); // stock deducted

    await step(page, 'Fitting done — balance wheels').click();
    await expect(status(page)).toHaveText('Balancing');
    await step(page, 'Start torque check').click(); // alignment was sold, so it cannot be skipped
    await expect(toast(page)).toContainText('Alignment was sold');
    await step(page, 'Send to alignment bay').click();
    await expect(status(page)).toHaveText('Alignment');

    // Alignment (alignment technician): before/after readings, inside tolerance.
    await signInAs(page, 'u_align');
    await step(page, 'Alignment done — torque check').click();
    await expect(toast(page)).toContainText('Record all alignment readings');
    const readings: Record<string, [string, string]> = { 'Front toe': ['2.4', '0.1'], 'Front camber': ['-1.9', '-0.6'], 'Rear toe': ['1.2', '0.2'], 'Rear camber': ['-1.7', '-1.0'] };
    for (const [name, [before, after]] of Object.entries(readings)) {
      await page.getByLabel(`${name} before`).fill(before);
      await page.getByLabel(`${name} after`).fill(after);
    }
    await page.getByRole('button', { name: 'Save readings' }).click();
    await expect(panel(page, 'Alignment readings').locator('.tag', { hasText: 'In tolerance' })).toHaveCount(4);

    // Torque check is blocked until a calibrated wrench is checked out to this job's technician.
    await step(page, 'Alignment done — torque check').click();
    await expect(toast(page)).toContainText('No torque wrench is checked out to Musa Dlamini');
    const torque = panel(page, 'Torque check & QC');
    await expect(torque).toContainText('Torque check blocked');
    await torque.getByRole('link', { name: 'Open the tool board →' }).click();
    await page.getByTestId('checkout-TR-TW-03').selectOption('md'); // calibration expired
    await expect(toast(page)).toContainText('TR-TW-03 calibration expired');
    await expect(page.locator('section[aria-label="Musa Dlamini tools"]')).not.toContainText('TR-TW-03');
    await page.getByTestId('checkout-TR-TW-05').selectOption('md');
    await expect(toast(page)).toContainText('TR-TW-05 checked out to Musa Dlamini');
    await expect(page.locator('section[aria-label="Musa Dlamini tools"]')).toContainText('TR-TW-05');

    await page.goto(jobUrl);
    await step(page, 'Alignment done — torque check').click();
    await expect(status(page)).toHaveText('Torque check');
    await expect(torque).toContainText('TR-TW-05 checked out to Musa Dlamini');

    // Every wheel needs a torque value inside the vehicle's spec before QC can pass.
    await step(page, 'Pass QC — ready').click();
    await expect(toast(page)).toContainText('Record the torque value for every wheel');
    for (const [i, w] of WHEELS.entries()) await page.getByLabel(`${w} torque (Nm)`).fill(i === 2 ? '98' : '115');
    await page.getByTestId('save-wheels').click();
    await tickQc(page);
    await step(page, 'Pass QC — ready').click();
    await expect(toast(page)).toContainText('LR 98 Nm outside the 110–120 Nm spec');
    await page.getByLabel('Left rear torque (Nm)').fill('116');
    await page.getByTestId('save-wheels').click();
    await step(page, 'Pass QC — ready').click();
    await expect(status(page)).toHaveText('Ready');
    await expect(torque).toContainText('Torqued with TR-TW-05');
    await expect(panel(page, 'Invoice')).toContainText(/INV-\d{4}/);

    // Counter: retail pays before the vehicle leaves.
    await signInAs(page, 'u_adv');
    await step(page, 'Hand over to customer').click();
    await expect(toast(page)).toContainText('Retail customers pay before the vehicle leaves');
    await page.getByTestId('open-invoice').click();
    await page.getByTestId('record-payment').click(); // amount defaults to the balance
    await expect(status(page)).toHaveText('Paid');
    await page.goto(jobUrl);
    await step(page, 'Hand over to customer').click();
    await expect(status(page)).toHaveText('Collected');

    // The wrench goes back on the board, and it remembers which job it torqued.
    await page.goto('#/tyres/tools');
    await signInAs(page, 'u_fit');
    await page.locator('section[aria-label="Musa Dlamini tools"] .board-card', { hasText: 'TR-TW-05' }).getByRole('button', { name: 'Check in' }).click();
    await expect(page.locator('section[aria-label="Available tools"]')).toContainText('TR-TW-05');
    await page.locator('section[aria-label="Available tools"]').getByRole('link', { name: 'TR-TW-05' }).click();
    await expect(panel(page, 'Jobs torqued with this wrench')).toContainText(jobRef);

    await page.reload(); // stored in this browser only
    await expect(panel(page, 'Jobs torqued with this wrench')).toContainText(jobRef);
    expect(errors).toEqual([]);
  });

  test('guide: every step opens the right screen as the right user and really works', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number, heading: RegExp, user: string) => {
      await page.goto('#/tyres');
      await page.getByTestId(`guide-step-${n}`).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.getByTestId('user-switcher')).toContainText(user);
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    };
    await page.goto('#/tyres');
    await expect(page.getByTestId('guide-step-6')).toBeVisible();
    await expect(page.getByTestId('guide-step-7')).toHaveCount(0);

    // 1. Sign off a torque check (senior technician with QC).
    await open(1, /^DEMO \d{3} [A-Z]{2} · /, 'Lerato Molefe');
    await expect(status(page)).toHaveText('Torque check');
    await expect(panel(page, 'Torque check & QC')).toContainText('TR-TW-01 checked out to Sipho Khumalo');
    await tickQc(page);
    await step(page, 'Pass QC — ready').click();
    await expect(status(page)).toHaveText('Ready');
    await expect(panel(page, 'Invoice')).toContainText(/INV-\d{4}/);

    // 2. Unblock a torque check: expired wrench refused, calibrated wrench issued.
    await open(2, /^DEMO \d{3} [A-Z]{2} · /, 'Sipho Khumalo');
    const torque = panel(page, 'Torque check & QC');
    await expect(torque).toContainText('No torque wrench is checked out to Musa Dlamini');
    await torque.getByRole('link', { name: 'Open the tool board →' }).click();
    await page.getByTestId('checkout-TR-TW-03').selectOption('md');
    await expect(toast(page)).toContainText('calibration expired');
    await page.getByTestId('checkout-TR-TW-05').selectOption('md');
    await expect(toast(page)).toContainText('checked out to Musa Dlamini');
    await page.goBack();
    await expect(torque).toContainText('TR-TW-05 checked out to Musa Dlamini');

    // 3. Inspect every wheel (fitment technician).
    await open(3, /^DEMO \d{3} [A-Z]{2} · /, 'Sipho Khumalo');
    await expect(status(page)).toHaveText('Arrived');
    await page.getByTestId('job-odometer').fill(String((await lastOdometer(page)) + 150));
    await page.getByTestId('save-setup').click();
    await fillTreads(page, ['0.8', '3.4', '5.2', '5.0']);
    await page.getByTestId('complete-inspection').click();
    await expect(status(page)).toHaveText('Inspected');

    // 4. Quote a tyre below the legal minimum (counter).
    await open(4, /^DEMO \d{3} [A-Z]{2} · /, 'Zanele Mthembu');
    await step(page, 'Send quote').click();
    await expect(toast(page)).toContainText('below the 1.0 mm legal minimum');
    await page.getByLabel('Left front quote replacement').check();
    await page.getByTestId('save-wheels').click();
    await page.getByTestId('quote-tyres').click();
    await step(page, 'Send quote').click();
    await expect(status(page)).toHaveText('Quoted');

    // 5. Fleet job: no purchase order, no approval.
    await open(5, /^DEMO \d{3} [A-Z]{2} · /, 'Zanele Mthembu');
    await page.getByTestId('approve-submit').click();
    await expect(page.getByTestId('approve-quote')).toContainText('requires a fleet purchase order number');
    await expect(status(page)).toHaveText('Quoted');
    await page.getByTestId('approve-po').fill('PO-DEMO-1042');
    await page.getByTestId('approve-submit').click();
    await expect(status(page)).toHaveText('Approved');
    await expect(panel(page, 'Fleet account')).toContainText('PO-DEMO-1042');

    // 6. Tyre size search (stock controller).
    await open(6, /Tyre stock/, 'Kevin Naidoo');
    await page.getByTestId('size-search').fill('205/55R16');
    await expect(page.getByTestId('size-exact').locator('tbody tr').first()).toContainText('205/55R16');
    await expect(page.getByTestId('size-alternatives').locator('tbody tr').first()).toBeVisible();
    await page.getByTestId('size-search').fill('999');
    await expect(panel(page, 'Size search')).toContainText('Enter a size like 205/55R16');
    expect(errors).toEqual([]);
  });

  test('below-legal tyre the customer will not replace: the refusal must be recorded before the quote goes out', async ({ page }) => {
    await page.goto('#/tyres/jobs/jobs_today_13'); // inspected, LF at 0.8 mm
    await signInAs(page, 'u_adv');
    await page.getByLabel('Wheel balancing').check();
    await step(page, 'Send quote').click();
    await expect(toast(page)).toContainText('legal minimum');
    await page.getByLabel('Customer refusal note').fill('ok thanks');
    await page.getByTestId('quote-with-refusal').click();
    await expect(panel(page, 'Services & quote')).toContainText('Say that the customer refused or declined');
    await page.getByLabel('Customer refusal note').fill('Mr Nel declined the LF replacement in person — advised it is below the legal minimum');
    await page.getByTestId('quote-with-refusal').click();
    await expect(status(page)).toHaveText('Quoted');
    await expect(panel(page, 'Services & quote')).toContainText('Mr Nel declined the LF replacement');
  });

  test('warranty claim: casing inspection decides whether the supplier can be claimed from', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/tyres/claims/claims_1'); // logged, not yet inspected
    await signInAs(page, 'u_stock');
    await expect(status(page)).toHaveText('Logged');
    await step(page, 'Record casing inspection').click();
    await expect(toast(page)).toContainText('tread remaining');
    await page.getByTestId('claim-tread').fill('5.5');
    await page.getByTestId('claim-damage').selectOption('impact'); // road hazard: not a manufacturing defect
    await page.getByTestId('claim-inspect').click();
    await expect(status(page)).toHaveText('Inspected');
    await step(page, 'Send to supplier (simulated)').click();
    await expect(toast(page)).toContainText('not a manufacturing defect');
    await step(page, 'Reject claim').click();
    await page.getByLabel('Transition note').fill('Impact break on the sidewall — road hazard, not a defect.');
    await page.getByTestId('confirm-transition').click();
    await expect(status(page)).toHaveText('Rejected');

    // A claim already with the supplier: record the credit they approve (pro-rata suggestion pre-filled).
    await page.goto('#/tyres/claims/claims_5');
    await expect(status(page)).toHaveText('Sent to supplier');
    await page.getByTestId('claim-credit').fill('0');
    await page.getByTestId('claim-credit-submit').click();
    await expect(panel(page, 'Supplier decision')).toContainText('1–100');
    await page.getByTestId('claim-credit').fill('60');
    await page.getByTestId('claim-credit-submit').click();
    await expect(status(page)).toHaveText('Approved (credit)');
    await expect(panel(page, 'Casing assessment')).toContainText('60% credit');
    expect(errors).toEqual([]);
  });

  test('roles: each simulated user lands on a sensible menu and is told what they cannot do', async ({ page }) => {
    await page.goto('#/tyres');
    const nav = page.getByLabel('Main navigation');

    // Fitment technician: bay queue and tools, no invoices; cannot send quotes or sign off QC.
    await signInAs(page, 'u_fit');
    await expect(nav.getByRole('link', { name: 'Tools & equipment' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Invoices' })).toHaveCount(0);
    await page.goto('#/tyres/invoices');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await page.goto('#/tyres/jobs/jobs_today_13');
    await expect(step(page, 'Send quote')).toBeDisabled();
    await page.goto('#/tyres/jobs/jobs_today_5');
    await expect(step(page, 'Pass QC — ready')).toBeDisabled();
    await expect(panel(page, 'Torque check & QC')).toContainText('only a user with the QC permission');

    // Counter: runs quotes, approvals and payments, but cannot issue tools.
    await signInAs(page, 'u_adv');
    await page.goto('#/tyres/tools/tools_5');
    await expect(panel(page, 'Check out')).toContainText('cannot issue tools');
    await page.goto('#/tyres/invoices/invoices_today_4'); // ready retail job, unpaid
    await expect(page.getByTestId('record-payment')).toBeVisible();

    // Fleet accounts clerk: fleets and invoices, no tools or stock.
    await signInAs(page, 'u_fleet');
    await expect(nav.getByRole('link', { name: 'Fleet accounts' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Tyre stock' })).toHaveCount(0);
    await page.goto('#/tyres/tools');
    await expect(page.getByTestId('no-access')).toBeVisible();

    // Stock controller: tools, stock and warranty claims.
    await signInAs(page, 'u_stock');
    await page.goto('#/tyres/tools/tools_3'); // expired wrench
    await expect(panel(page, 'Check out')).toContainText('Cannot be issued');
    await expect(page.getByTestId('checkout-submit')).toBeDisabled();
    await expect(step(page, 'Send for calibration / repair')).toBeEnabled();

    // Branch manager sees everything, including Users & permissions.
    await signInAs(page, 'u_mgr');
    await expect(nav.getByRole('link', { name: 'Users & permissions' })).toBeVisible();
  });

  test('mobile: dashboard, job and tool board fit a 390px screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/tyres', '#/tyres/jobs/jobs_today_14', '#/tyres/jobs/jobs_today_11', '#/tyres/jobs', '#/tyres/tools', '#/tyres/stock']) {
      await page.goto(path);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.goto('#/tyres/jobs/jobs_today_14');
    await expect(page.getByTestId('job-odometer')).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByLabel('Main navigation').getByRole('link', { name: 'Tools & equipment' }).click();
    await expect(page.getByRole('heading', { name: 'Tools & equipment', level: 1 })).toBeVisible();
  });
});
