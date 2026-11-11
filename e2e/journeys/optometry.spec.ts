import { expect, test, type Page } from '@playwright/test';

/**
 * Northgate Optometry — one patient end to end, the claim side, and the guided
 * walkthrough. Complements e2e/optometry.spec.ts (rules and single screens).
 * Every test starts from a fresh seed and books "today" at a fixed diary slot,
 * so nothing depends on the time of day.
 */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
/** A toast with this text is on screen (several can be stacked, so match by text). */
const sawToast = (page: Page, text: string) => expect(page.locator('.toast', { hasText: text }).last()).toBeVisible();
const workflow = (page: Page) => page.locator('.panel', { hasText: 'Steps enforce the demo' });
const status = (page: Page, label: string) => expect(workflow(page).locator('.panel-head .tag')).toHaveText(label);
const step = (page: Page, name: string) => workflow(page).getByRole('button', { name, exact: true });
/** Today as the app sees it (browser clock, local time). */
const today = (page: Page) => page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

test.describe('Optometry journey', () => {
  test('new patient: book → exam → prescription → lab with a remake → collected → claim settled', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/optometry');

    await test.step('front desk registers a new patient', async () => {
      await signInAs(page, 'u_fd');
      await page.goto('#/optometry/patients');
      await page.getByTestId('new-record').click();
      await page.getByTestId('save-record').click(); // empty form: required fields are named
      await expect(page.locator('.modal')).toContainText('First name is required.');
      await page.getByLabel('First name').fill('Thandi');
      await page.getByLabel('Surname').fill('Journey');
      await page.getByLabel('Date of birth').fill('1988-04-12');
      await page.getByLabel('Mobile (fictional)').fill('082 555 0199');
      await page.getByLabel('Medical aid').selectOption('meridian');
      await page.getByLabel('Membership no. (fictional)').fill('MER-900100');
      await page.getByTestId('save-record').click();
      await sawToast(page, 'Patient PT-0027 created');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thandi Journey');
      await expect(page.getByText('the recall date is set automatically')).toBeVisible();
      // Reminder consent is recorded right where it is missed, not in the full edit form.
      await page.getByTestId('record-consent').click();
      await expect(page.getByTestId('consent-note')).toHaveCount(0);
    });

    await test.step('books them for today; a taken slot is refused', async () => {
      await page.getByTestId('book-patient').click();
      await page.getByLabel('Date', { exact: true }).fill(await today(page));
      await page.getByTestId('save-record').click(); // Dr Khumalo 09:00 is taken in the seed
      await sawToast(page, 'already booked');
      await page.getByLabel('Time', { exact: true }).fill('14:00');
      await page.getByTestId('save-record').click();
      await sawToast(page, 'Appointment booked');
      await page.getByTestId('patient-timeline').getByRole('link', { name: 'Comprehensive eye exam' }).click();
      await status(page, 'Booked');
    });

    await test.step('front desk checks in but cannot call into the room', async () => {
      await step(page, 'Check in').click();
      await status(page, 'Checked in');
      await expect(step(page, 'Call into room')).toBeDisabled();
      await expect(page.getByText('Exams are recorded by optometrists')).toBeVisible();
    });

    await test.step('optometrist starts the exam from the appointment', async () => {
      await signInAs(page, 'u_opt');
      await step(page, 'Start pre-test').click();
      await step(page, 'Call into room').click();
      await status(page, 'In consulting room');
      await page.getByTestId('start-exam').click();
      await sawToast(page, 'Exam EX-0062 started');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thandi Journey');
    });

    await test.step('an empty refraction cannot be finalised; a complete one issues the prescription and drafts the claim', async () => {
      await page.getByRole('button', { name: 'Finalise exam & issue Rx' }).click();
      await sawToast(page, 'Sphere is required');
      await page.getByLabel('Reason for visit').fill('Blurred distance vision when driving at night.');
      await page.getByLabel('Right VA unaided').fill('6/12');
      await page.getByLabel('Right sphere').fill('-1.25');
      await page.getByLabel('Right cylinder').fill('-0.5');
      await page.getByLabel('Right axis').fill('180');
      await page.getByLabel('Right VA corrected').fill('6/6');
      await page.getByLabel('Left VA unaided').fill('6/9');
      await page.getByLabel('Left sphere').fill('-1');
      await page.getByLabel('Left VA corrected').fill('6/6');
      await page.getByLabel('PD (mm)').fill('62');
      await expect(page.getByTestId('exam-problems')).toContainText('diagnosis');
      await page.getByLabel('Diagnosis (ICD-10 sample)').selectOption('H52.1');
      await page.getByTestId('save-exam').click();
      await page.getByRole('button', { name: 'Finalise exam & issue Rx' }).click();
      await sawToast(page, 'draft claim CLM-0062 created');
      await expect(page.locator('.panel', { hasText: 'Exam status' }).getByText('Finalised')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Prescription RX-0062' })).toBeVisible();
      await expect(page.getByTestId('rx-card').first()).toContainText('−1.25 / −0.50 × 180');
    });

    await test.step('patient goes to dispensing; the optometrist is pointed at the dispenser', async () => {
      await page.getByTestId('exam-links').getByRole('link', { name: /Appointment AP-/ }).click();
      await step(page, 'Send to dispensing').click();
      await status(page, 'Dispensing');
      await page.getByTestId('open-rx').click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thandi Journey');
      await expect(page.getByTestId('rx-next')).toContainText('optical dispenser');
      await expect(page.getByTestId('order-from-rx')).toHaveCount(0);
    });

    await test.step('dispenser starts the order from the prescription; no frame → blocked, fixed on the same screen', async () => {
      await signInAs(page, 'u_disp');
      await page.getByTestId('order-from-rx').click();
      await page.getByTestId('save-record').click();
      await sawToast(page, 'Order JOB-0041 created');
      await status(page, 'Quoted');
      await step(page, 'Send to lab').click();
      await sawToast(page, 'Select a frame from stock');
      await expect(page.getByTestId('order-problems')).toContainText('Select a frame from stock');
      await page.getByLabel('Choose frame').selectOption('stock_1');
      await page.getByTestId('use-frame').click();
      await expect(page.getByTestId('order-problems')).toHaveCount(0);
      await expect(page.locator('.panel', { hasText: 'Job sheet' })).toContainText('Arden 210 rectangle');
      await step(page, 'Send to lab').click();
      await status(page, 'At lab');
    });

    await test.step('lab loop: receive → fail QC (note required) → resend → receive → pass', async () => {
      await step(page, 'Receive from lab').click();
      await status(page, 'Received');
      await step(page, 'Fail quality check').click();
      await page.getByTestId('confirm-transition').click();
      await expect(page.locator('.modal')).toContainText('A note is required for this step.');
      await page.getByLabel('Transition note').fill('Right lens axis 10° off the ordered value.');
      await page.getByTestId('confirm-transition').click();
      await status(page, 'Remake');
      await step(page, 'Resend to lab').click();
      await step(page, 'Receive from lab').click();
      await step(page, 'Pass quality check').click();
      await status(page, 'Ready to collect');
      await expect(page.locator('.panel', { hasText: 'Collection' })).toContainText('Ready since');
    });

    await test.step('“ready” message is previewed and logged, never sent; collection adds the eyewear to the claim', async () => {
      await page.getByRole('button', { name: /Preview/ }).click();
      await expect(page.locator('.sms-preview')).toContainText('Hi Thandi');
      await expect(page.locator('.sms-preview')).toContainText('Northgate Optometry');
      await page.getByRole('button', { name: 'Log as sent (demo)' }).click();
      await sawToast(page, 'no message was sent');
      await step(page, 'Mark collected').click();
      await status(page, 'Collected');
      await sawToast(page, 'Eyewear added to draft claim CLM-0062');
      await expect(page.locator('.panel', { hasText: 'Billing' }).last()).toContainText('CLM-0062');
      // Sending to the lab reserved one frame from stock (4 → 3).
      await page.goto('#/optometry/stock/stock_1');
      await expect(page.locator('.kv div', { hasText: 'On hand' }).locator('dd')).toHaveText('3');
    });

    await test.step('the visit is completed from the diary', async () => {
      await page.goto('#/optometry/diary');
      await page.getByTestId('appt').filter({ hasText: 'Thandi Journey' }).click();
      await step(page, 'Complete visit').click();
      await status(page, 'Completed');
    });

    await test.step('manager submits the claim, records a part payment and settles the patient balance', async () => {
      await signInAs(page, 'u_mgr');
      await page.goto('#/optometry/claims');
      await page.getByLabel('Filter by status').selectOption('draft');
      await page.getByTestId('table-claims').locator('tbody tr', { hasText: 'Thandi Journey' }).click();
      const account = page.locator('.panel', { hasText: 'Tariff codes are invented' });
      for (const code of ['DEMO-EX1', 'DEMO-FR1', 'DEMO-LN1']) await expect(account).toContainText(code);
      await step(page, 'Submit to scheme (simulated)').click();
      await status(page, 'Submitted');
      // The generic step explains itself and points at the focused control on this page.
      await step(page, 'Record full remittance').click();
      await sawToast(page, 'Scheme remittance');
      await page.getByLabel('Scheme paid amount').fill('2500');
      await expect(page.getByTestId('remittance-outcome')).toContainText('Part payment');
      await page.getByTestId('record-remittance').click();
      await expect(page.getByTestId('remittance')).toBeVisible(); // still here: a part payment needs a note
      await page.getByLabel('Remittance note').fill('Paid at scheme rate.');
      await page.getByTestId('record-remittance').click();
      await status(page, 'Part paid');
      await expect(page.getByTestId('patient-balance-note')).toContainText('due from the patient');
      await expect(page.getByTestId('claim-balance')).not.toHaveText('R0.00');
      await step(page, 'Patient balance settled').click();
      await status(page, 'Settled');
      await expect(page.getByTestId('claim-balance')).toHaveText('R0.00');
    });
    expect(errors).toEqual([]);
  });

  test('claim: draft → submitted → full remittance → paid', async ({ page }) => {
    await page.goto('#/optometry');
    await signInAs(page, 'u_mgr');
    await page.goto('#/optometry/claims/claims_59');
    await status(page, 'Draft');
    await step(page, 'Submit to scheme (simulated)').click();
    await status(page, 'Submitted');
    await expect(page.locator('.kv div', { hasText: 'Submitted on' }).locator('dd')).not.toHaveText('—');
    await expect(page.getByLabel('Scheme paid amount')).toHaveValue('483'); // defaults to the claim total
    await page.getByTestId('record-remittance').click();
    await status(page, 'Paid');
    await expect(page.getByTestId('claim-balance')).toHaveText('R0.00');
    await expect(workflow(page)).toContainText('final state');
  });

  test('blocked quote: an expired prescription says why and where to fix it', async ({ page }) => {
    await page.goto('#/optometry');
    await signInAs(page, 'u_disp');
    await page.goto('#/optometry/orders/orders_40');
    await step(page, 'Send to lab').click();
    await sawToast(page, 'expired');
    await expect(page.getByTestId('order-problems')).toContainText('Re-examine first');
    await page.getByRole('link', { name: 'Open the patient to book the exam' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Annelie Pretorius');
  });

  test('roles: each lands on a dashboard and read-only screens say so', async ({ page }) => {
    await page.goto('#/optometry');
    for (const [id, first] of [['u_owner', 'Lerato'], ['u_opt', 'Sipho'], ['u_disp', 'Megan'], ['u_fd', 'Ayesha'], ['u_mgr', 'Johan']]) {
      await signInAs(page, id);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Good day, ${first}`);
    }
    // Optometrist can follow the lab board but not move jobs.
    await signInAs(page, 'u_opt');
    await page.goto('#/optometry/orders');
    await expect(page.getByTestId('orders-readonly')).toContainText('Dispense permission');
    await expect(page.locator('section[aria-label="Received column"]').getByRole('button', { name: 'Pass quality check' }).first()).toBeDisabled();
    // Manager sees recalls for oversight; chasing them is a front-desk job.
    await signInAs(page, 'u_mgr');
    await page.goto('#/optometry/recalls');
    await expect(page.getByTestId('recalls-readonly')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remind' })).toHaveCount(0);
    // Dispenser has no clinical module.
    await signInAs(page, 'u_disp');
    await page.goto('#/optometry/exams');
    await expect(page.getByTestId('no-access')).toBeVisible();
  });

  test('guided walkthrough: every step opens a screen where the described action works', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number, user: string, heading: string | RegExp) => {
      await page.goto('#/optometry');
      await page.getByTestId(`guide-step-${n}`).click();
      await expect(page.getByTestId('user-switcher')).toHaveValue(user);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    };
    await open(1, 'u_fd', 'Diary & patient flow');
    await page.getByRole('button', { name: 'Patient flow' }).click();
    const booked = page.locator('section[aria-label="Booked column"]');
    const name = (await booked.locator('.board-card strong').first().textContent())!;
    await booked.getByRole('button', { name: 'Check in' }).first().click();
    await expect(page.locator('section[aria-label="Checked in column"]')).toContainText(name);

    await open(2, 'u_opt', 'Chloe Adams');
    await expect(page.getByTestId('exam-problems')).toContainText('diagnosis');
    await page.getByLabel('Diagnosis (ICD-10 sample)').selectOption('H52.1');
    await page.getByTestId('save-exam').click();
    await page.getByRole('button', { name: 'Finalise exam & issue Rx' }).click();
    await expect(page.locator('.panel', { hasText: 'Exam status' }).getByText('Finalised')).toBeVisible();

    await open(3, 'u_disp', 'Optical orders');
    await page.locator('section[aria-label="Quoted column"]').getByRole('button', { name: 'Send to lab' }).first().click();
    await sawToast(page, 'expired');
    await page.locator('section[aria-label="Received column"]').getByRole('button', { name: 'Pass quality check' }).first().click();
    await sawToast(page, 'Pass quality check');

    await open(4, 'u_mgr', 'Billing & claims');
    await page.getByLabel('Filter by status').selectOption('draft');
    await page.getByTestId('table-claims').locator('tbody tr').first().click();
    await step(page, 'Submit to scheme (simulated)').click();
    await page.getByTestId('record-remittance').click();
    await status(page, 'Paid');

    await open(5, 'u_fd', 'Recalls');
    await page.getByRole('button', { name: 'Remind' }).first().click();
    await expect(page.locator('.sms-preview')).toBeVisible();
    await page.getByTestId('log-reminder').click();
    await sawToast(page, 'no message was sent');

    await open(6, 'u_owner', 'Users & permissions');
    expect(errors).toEqual([]);
  });

  test('mobile: the working screens of the journey fit a 390px phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/optometry', '#/optometry/diary/appointments_66', '#/optometry/exams/exams_61', '#/optometry/orders/orders_40', '#/optometry/claims/claims_59']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
  });
});
