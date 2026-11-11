import { expect, test, type Page } from '@playwright/test';

// Torque Lane Auto Services: the journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage). Dates are taken from the browser clock and no
// step depends on the time of day (new job cards are booked without a start time).

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const toast = (page: Page) => page.locator('.toast').last();
const panel = (page: Page, title: string) => page.locator('.panel', { has: page.getByRole('heading', { name: title, exact: true }) });
const workflow = (page: Page) => panel(page, 'Workflow');
const status = (page: Page) => workflow(page).locator('.panel-head .tag');
const step = (page: Page, name: string) => workflow(page).getByRole('button', { name, exact: true });
const estimateStep = (page: Page, name: string) => page.getByTestId('estimate-steps').getByRole('button', { name, exact: true });
const today = (page: Page) => page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
const tickQc = async (page: Page) => {
  for (const box of await page.getByTestId('qc-checklist').getByRole('checkbox').all()) await box.check();
};

// Optional: E2E_FAKE_NOW=2026-11-16T06:10:00 runs the journeys on another day / time of day.
const FAKE_NOW = process.env.E2E_FAKE_NOW;

test.describe('Automotive journeys', () => {
  test.beforeEach(async ({ page }) => {
    if (FAKE_NOW) await page.clock.install({ time: new Date(FAKE_NOW) });
  });

  test('job card: book → check in → diagnose → estimate → approval → work → QC → invoice → payment → collected', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/automotive/jobs');
    await signInAs(page, 'u_adv');

    // Book a job card for a customer's vehicle (a Kia Picanto that is not in the workshop).
    await page.getByTestId('new-record').click();
    await page.getByLabel('Customer vehicle').selectOption('vehicles_10');
    await page.getByLabel('Job type').selectOption('repair');
    await page.getByLabel('Customer complaint / request').fill('Grinding noise from the front when braking.');
    await page.getByLabel('Workshop date').fill(await today(page));
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText(/Job card JC-\d{4} created/);
    await expect(status(page)).toHaveText('Booked');
    const jobUrl = page.url();
    const jobRef = (await page.locator('.page-kicker, .kicker').first().textContent())!.match(/JC-\d{4}/)![0];
    const lastKm = Number((await panel(page, 'Check-in').textContent())!.match(/Last recorded ([\d,]+) km/)![1].replace(/,/g, ''));
    const newKm = lastKm + 740;
    const kmText = (n: number) => `${n.toLocaleString('en-US')} km`;

    // Check-in needs the odometer; a reading below the last recorded one is refused, on the job card itself.
    await step(page, 'Check in vehicle').click();
    await expect(toast(page)).toContainText('“Check-in” panel');
    await page.getByTestId('odometer-in').fill('100');
    await page.getByTestId('check-in').click();
    await expect(panel(page, 'Check-in')).toContainText(`below the last recorded reading of ${kmText(lastKm)}`);
    await expect(status(page)).toHaveText('Booked');
    await page.getByTestId('odometer-in').fill(String(newKm));
    await page.getByTestId('check-in').click();
    await expect(status(page)).toHaveText('Checked in');

    // Diagnosis is the technician's step and needs a bay and a technician, allocated on the job card.
    await signInAs(page, 'u_tech');
    await step(page, 'Start diagnosis').click();
    await expect(toast(page)).toContainText('Assign a technician first');
    await signInAs(page, 'u_adv');
    await expect(step(page, 'Start diagnosis')).toBeDisabled(); // advisor does not work on vehicles
    await page.getByLabel('Allocate bay').selectOption('b2');
    await page.getByLabel('Allocate technician').selectOption('ad');
    await page.getByTestId('save-allocation').click();
    await expect(panel(page, 'Job card')).toContainText('Bay 2 · Ahmed Davids');
    await signInAs(page, 'u_tech');
    await step(page, 'Start diagnosis').click();
    await expect(status(page)).toHaveText('Diagnosing');

    // The advisor prepares an estimate from a template and sends it; the job card follows to "Awaiting approval".
    await signInAs(page, 'u_adv');
    await page.getByLabel('Start from template').selectOption('brakes');
    await page.getByTestId('create-estimate').click();
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText(/Estimate EST-\d{4} created/);
    await expect(panel(page, 'Estimate').getByTestId('lines-grand')).toHaveText('R5,267.00');
    await estimateStep(page, 'Send to customer (simulated)').click();
    await expect(status(page)).toHaveText('Awaiting approval');

    // No work without approval — and the approval note must say how the customer approved.
    await signInAs(page, 'u_tech');
    await step(page, 'Start work').click();
    await expect(toast(page)).toContainText('Work can only start once the customer has approved it');
    await expect(status(page)).toHaveText('Awaiting approval');
    await signInAs(page, 'u_adv');
    await estimateStep(page, 'Record customer approval').click();
    await page.getByLabel('Transition note').fill('ok');
    await page.getByTestId('confirm-transition').click();
    await expect(page.locator('.modal')).toContainText('by phone, WhatsApp, in person or email');
    await page.getByLabel('Transition note').fill('Mr Moosa approved by phone at 10:15');
    await page.getByTestId('confirm-transition').click();
    await expect(panel(page, 'Estimate')).toContainText('approved: “Mr Moosa approved by phone at 10:15”');

    // Technician works the job and sends it to quality check.
    await signInAs(page, 'u_tech');
    await step(page, 'Start work').click();
    await expect(status(page)).toHaveText('In progress');
    await step(page, 'Send to quality check').click();
    await expect(status(page)).toHaveText('Quality check');
    await expect(step(page, 'Pass quality check')).toBeDisabled(); // foreman's step

    // Foreman: QC is blocked until the checklist is complete; passing raises the invoice.
    await signInAs(page, 'u_fore');
    await step(page, 'Pass quality check').click();
    await expect(toast(page)).toContainText('QC checklist incomplete');
    await tickQc(page);
    await step(page, 'Pass quality check').click();
    await expect(status(page)).toHaveText('Ready for collection');
    await expect(panel(page, 'Invoice')).toContainText(/INV-\d{4}/);
    await expect(panel(page, 'Invoice')).toContainText('balance R5,267.00');

    // Advisor: a private customer pays before the vehicle is released.
    await signInAs(page, 'u_adv');
    await step(page, 'Hand over to customer').click();
    await expect(toast(page)).toContainText('R5,267.00 outstanding');
    await page.getByTestId('open-invoice').click();
    await page.getByTestId('payment-amount').fill('6000');
    await page.getByTestId('record-payment').click();
    await expect(panel(page, 'Record payment')).toContainText('exceeds the outstanding balance');
    await page.getByTestId('payment-amount').fill('5267');
    await page.getByTestId('record-payment').click();
    await expect(status(page)).toHaveText('Paid');

    await page.goto(jobUrl);
    await step(page, 'Hand over to customer').click();
    await expect(status(page)).toHaveText('Collected');

    // The vehicle now carries the new odometer reading and the visit is in its service history.
    await page.goto('#/automotive/vehicles/vehicles_10');
    await expect(panel(page, 'Service history')).toContainText(jobRef);
    await expect(panel(page, 'Service history')).toContainText(kmText(newKm));

    // Stored in this browser only: still there after a reload.
    await page.reload();
    await expect(panel(page, 'Service history')).toContainText(jobRef);
    expect(errors).toEqual([]);
  });

  test('guide: every step opens the right screen as the right user and really works', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number, heading: RegExp, user: string) => {
      await page.goto('#/automotive');
      await page.getByTestId(`guide-step-${n}`).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.getByTestId('user-switcher')).toContainText(user);
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    };
    await page.goto('#/automotive');
    await expect(page.getByTestId('guide-step-6')).toBeVisible();
    await expect(page.getByTestId('guide-step-7')).toHaveCount(0);

    // 1. Check a vehicle in (service advisor).
    await open(1, /Suzuki Swift/, 'Naledi Mokoena');
    await page.getByTestId('odometer-in').fill('1');
    await page.getByTestId('check-in').click();
    await expect(panel(page, 'Check-in')).toContainText('below the last recorded reading');
    await page.getByTestId('odometer-in').fill('99000');
    await page.getByTestId('check-in').click();
    await expect(status(page)).toHaveText('Checked in');

    // 2. Start work without approval is refused (technician).
    await open(2, /Volkswagen Polo Vivo/, 'Sibusiso Ndaba');
    await step(page, 'Start work').click();
    await expect(toast(page)).toContainText('Work can only start once the customer has approved it');
    await expect(status(page)).toHaveText('Awaiting approval');

    // 3. Record the customer's approval (service advisor) — then the technician can start.
    await open(3, /Volkswagen Polo Vivo/, 'Naledi Mokoena');
    await estimateStep(page, 'Record customer approval').click();
    await page.getByLabel('Transition note').fill('Approved by phone — Ms Govender');
    await page.getByTestId('confirm-transition').click();
    await expect(toast(page)).toContainText('Record customer approval');
    await signInAs(page, 'u_tech');
    await step(page, 'Start work').click();
    await expect(status(page)).toHaveText('In progress');

    // 4. Pass a quality check (foreman) — the invoice is raised.
    await open(4, /Hyundai i20/, 'Deon Pretorius');
    await tickQc(page);
    await step(page, 'Pass quality check').click();
    await expect(status(page)).toHaveText('Ready for collection');
    await expect(panel(page, 'Invoice')).toContainText(/INV-\d{4}/);

    // 5. Take payment and hand over (service advisor).
    await open(5, /Renault Kwid/, 'Naledi Mokoena');
    await step(page, 'Hand over to customer').click();
    await expect(toast(page)).toContainText('outstanding');
    await page.getByTestId('open-invoice').click();
    await page.getByTestId('record-payment').click(); // amount defaults to the full balance
    await expect(status(page)).toHaveText('Paid');
    await page.goBack();
    await step(page, 'Hand over to customer').click();
    await expect(status(page)).toHaveText('Collected');

    // 6. Service reminders: preview (nothing is sent) and log.
    await open(6, /Service reminders/, 'Naledi Mokoena');
    await page.getByRole('button', { name: 'Remind' }).first().click();
    await expect(page.locator('.sms-preview')).toContainText('Torque Lane Auto Services');
    await page.getByTestId('log-reminder').click();
    await expect(toast(page)).toContainText('no message was sent');
    expect(errors).toEqual([]);
  });

  test('service reminder → book → schedule on the planner (bay clash refused)', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/automotive/reminders');
    await signInAs(page, 'u_adv');
    const row = page.getByTestId('reminder-table').locator('tbody tr', { has: page.getByRole('button', { name: 'Book', exact: true }) }).first();
    const reg = (await row.locator('strong').first().textContent())!;
    await row.getByRole('button', { name: 'Book', exact: true }).click();
    await page.getByLabel('Bay', { exact: true }).selectOption(''); // leave bay and technician for the planner
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText('booked from reminder');
    await expect(page.getByTestId('reminder-table').locator('tbody tr', { hasText: reg })).toContainText('Booked');

    // The reminder form books two days ahead at 08:00; the planner lists it under "Needs scheduling".
    await page.goto('#/automotive/planner');
    await page.getByRole('button', { name: 'Next day' }).click();
    await page.getByRole('button', { name: 'Next day' }).click();
    const waiting = page.getByTestId('unscheduled').locator('li', { hasText: reg });
    await expect(waiting).toBeVisible();
    await waiting.getByRole('button', { name: 'Schedule' }).click();
    await page.getByTestId('save-schedule').click(); // Bay 1 from 08:00 is taken by a seeded minor service
    await expect(toast(page)).toContainText('already occupies that bay');
    await page.getByLabel('Bay', { exact: true }).selectOption('b2');
    await page.getByLabel('Technician', { exact: true }).selectOption('ad');
    await page.getByTestId('save-schedule').click();
    await expect(toast(page)).toContainText('scheduled');
    await expect(page.getByTestId('planner')).toContainText(reg);
    expect(errors).toEqual([]);
  });

  test('roles: each simulated user lands on a sensible menu and is told what they cannot do', async ({ page }) => {
    await page.goto('#/automotive');
    const nav = page.getByLabel('Main navigation');

    // Parts & admin clerk: no workshop board, but parts and invoices.
    await signInAs(page, 'u_clerk');
    await expect(nav.getByRole('link', { name: 'Parts inventory' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Workshop board' })).toHaveCount(0);
    await page.goto('#/automotive/jobs');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await page.goto('#/automotive/invoices');
    await page.getByLabel('Filter by status').selectOption('issued');
    await page.getByTestId('table-invoices').locator('tbody tr').first().click();
    await expect(page.getByTestId('record-payment')).toBeVisible();

    // Technician: sees the board, cannot check vehicles in, cannot open estimates or invoices.
    await signInAs(page, 'u_tech');
    await expect(nav.getByRole('link', { name: 'Workshop board' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Invoices' })).toHaveCount(0);
    await page.goto('#/automotive/jobs/jobs_open_11');
    await expect(step(page, 'Check in vehicle')).toBeDisabled();
    await expect(panel(page, 'Check-in')).toContainText('service advisor or foreman');
    await page.goto('#/automotive/jobs/jobs_open_9');
    await expect(step(page, 'Start diagnosis')).toBeEnabled();

    // Foreman: quality check is theirs; no invoices module.
    await signInAs(page, 'u_fore');
    await page.goto('#/automotive/jobs/jobs_open_3');
    await expect(step(page, 'Pass quality check')).toBeEnabled();
    await expect(page.getByTestId('qc-checklist').getByRole('checkbox').first()).toBeEnabled();
    await page.goto('#/automotive/invoices');
    await expect(page.getByTestId('no-access')).toBeVisible();

    // Owner sees everything, including Users & permissions.
    await signInAs(page, 'u_owner');
    await expect(nav.getByRole('link', { name: 'Users & permissions' })).toBeVisible();
  });

  test('mobile: dashboard, job card and planner fit a 390px screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/automotive', '#/automotive/jobs/jobs_open_11', '#/automotive/jobs', '#/automotive/planner', '#/automotive/invoices/invoices_open_1']) {
      await page.goto(path);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.goto('#/automotive/jobs/jobs_open_11');
    await expect(page.getByTestId('check-in')).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByLabel('Main navigation').getByRole('link', { name: 'Service reminders' }).click();
    await expect(page.getByRole('heading', { name: 'Service reminders', level: 1 })).toBeVisible();
  });
});
