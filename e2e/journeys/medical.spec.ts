import { expect, test, type Page } from '@playwright/test';

/**
 * Acacia Family Practice — one visit from booking to check-out through every
 * role, plus blocked steps, role checks, the guided walkthrough and mobile.
 * Every test starts from a fresh seed; the visit is booked for "today" at a
 * fixed time, so nothing depends on the time of day.
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
const column = (page: Page, name: string) => page.locator(`section[aria-label="${name} column"]`);
const card = (page: Page, patient: string) => page.getByTestId('queue-card').filter({ hasText: patient });
const panel = (page: Page, title: string) => page.locator('.panel', { has: page.getByRole('heading', { name: title, exact: true }) });

async function captureVitals(page: Page, temp = '36.8') {
  await page.getByLabel('BP systolic (mmHg)').fill('128');
  await page.getByLabel('BP diastolic (mmHg)').fill('82');
  await page.getByLabel('Pulse (bpm)').fill('88');
  await page.getByLabel('Temperature (°C)').fill(temp);
  await page.getByLabel('SpO2 (%)').fill('97');
  await page.getByLabel('Weight (kg)').fill('71');
  await page.getByTestId('save-triage').click();
}

test.describe('Medical practice journey', () => {
  test('visit: booked → checked in → triaged → consultation signed → script → result → billing → claim paid → done', async ({ page }) => {
    const errors = watchErrors(page);
    const patient = 'Dineo Letsoalo'; // recorded allergy: Penicillin
    await page.goto('#/medical');

    await test.step('reception books a visit for today (a clash is refused) and checks the patient in', async () => {
      await signInAs(page, 'u_rec');
      await page.goto('#/medical/waiting');
      await page.getByTestId('new-visit').click();
      await page.getByLabel('Patient', { exact: true }).selectOption({ label: `${patient} · PT-0024` });
      await page.getByLabel('With', { exact: true }).selectOption('tm');
      await page.getByLabel('Time', { exact: true }).fill('10:45'); // Dr Mabaso already has a 10:45 in the seed
      await page.getByLabel('Reason (as told to reception)').fill('Sore throat for three days');
      await page.getByTestId('save-record').click();
      await sawToast(page, 'already has a visit');
      await page.getByLabel('Time', { exact: true }).fill('12:00');
      await page.getByTestId('save-record').click();
      await sawToast(page, `Booked ${patient} at 12:00`);
      await expect(column(page, 'Booked')).toContainText(patient);
      await card(page, patient).getByRole('button', { name: 'Check in' }).click();
      await expect(column(page, 'Arrived')).toContainText(patient);
      // Reception sees the next step but cannot take it.
      await expect(card(page, patient).getByRole('button', { name: 'Record triage' })).toBeDisabled();
    });

    await test.step('nurse cannot triage without vitals; a raised temperature is flagged for the doctor', async () => {
      await signInAs(page, 'u_nurse');
      await card(page, patient).getByTestId('open-triage').click();
      await page.getByTestId('save-triage').click();
      await expect(page.locator('.modal')).toContainText('Capture vitals before triage — missing');
      await captureVitals(page, '38.2');
      await expect(column(page, 'Triaged')).toContainText(patient);
      await expect(card(page, patient)).toContainText('Temp 38.2 °C — for doctor review (demo rule)');
      await expect(card(page, patient)).toContainText('Allergy: Penicillin');
      await expect(card(page, patient).getByRole('button', { name: 'Call in to doctor' })).toBeDisabled();
    });

    await test.step('doctor calls the patient in; billing is blocked until a consultation is signed', async () => {
      await signInAs(page, 'u_gp');
      await card(page, patient).getByRole('button', { name: 'Call in to doctor' }).click();
      await expect(column(page, 'With doctor')).toContainText(patient);
      await card(page, patient).getByRole('link', { name: patient }).click();
      await status(page, 'With doctor');
      await step(page, 'Send to billing').click();
      await sawToast(page, 'Start and sign a consultation for this visit first.');
      await page.getByTestId('start-consult').click();
      await sawToast(page, 'Consultation CN-0062 started');
    });

    await test.step('SOAP note: cannot be signed without assessment, plan and ICD-10', async () => {
      await expect(page.getByTestId('consult-problems')).toContainText('ICD-10');
      await page.getByRole('button', { name: 'Sign consultation' }).click();
      await sawToast(page, 'Record an assessment (A) before signing.');
      await expect(page.getByLabel('S — Subjective')).toHaveValue('Sore throat for three days'); // carried over from reception
      await page.getByLabel('O — Objective').fill('Tonsils enlarged with exudate. Temp as triaged.');
      await page.getByLabel('A — Assessment').fill('Acute pharyngitis (demo note).');
      await page.getByLabel('P — Plan').fill('Antibiotic course, fluids, review in 48 hours if no better.');
      await page.getByLabel('ICD-10 code').selectOption('J02.9');
      await page.getByLabel('Sick note days').fill('2');
      await expect(page.getByTestId('sick-note')).toContainText('Acacia Family Practice (fictional)');
      await page.getByTestId('save-consult').click();
      await expect(page.getByTestId('consult-problems')).toHaveCount(0);
    });

    await test.step('script: amoxicillin is blocked by the recorded allergy; a safe medicine is issued', async () => {
      await page.getByTestId('add-script').click();
      await page.getByLabel('Medicine (generic)').selectOption('amoxicillin');
      await page.getByTestId('save-record').click();
      await sawToast(page, 'allergy match');
      await panel(page, 'Scripts').getByRole('link', { name: /Amoxicillin/ }).click();
      await status(page, 'Draft');
      await step(page, 'Sign & issue').click();
      await sawToast(page, 'Recorded allergy: "Penicillin"');
      await status(page, 'Draft');
      await page.getByLabel('Alternative medicine').selectOption('azithromycin');
      await page.getByTestId('swap-medicine-save').click();
      await expect(page.getByTestId('script-sheet')).toContainText('Azithromycin 500 mg tablet');
      await expect(page.getByTestId('swap-medicine')).toHaveCount(0);
      await step(page, 'Sign & issue').click();
      await status(page, 'Issued');
      await page.getByTestId('back-to-consult').click();
      await expect(panel(page, 'Scripts')).toContainText('Azithromycin');
    });

    await test.step('a test is requested; signing drafts the claim and the patient goes to billing', async () => {
      await page.getByTestId('request-test').click();
      await page.getByLabel('Test', { exact: true }).selectOption('crp');
      await page.getByTestId('save-record').click();
      await sawToast(page, 'no lab order is sent');
      await page.getByRole('button', { name: 'Sign consultation' }).click();
      await sawToast(page, 'Draft claim CLM-0079 created (DEMO-GP1)');
      await expect(panel(page, 'Status').locator('.panel-head .tag')).toHaveText('Signed');
      await expect(page.getByLabel('A — Assessment')).toBeDisabled(); // signed notes are locked
      await page.getByTestId('send-to-billing').click();
      await expect(panel(page, 'Visit').locator('.panel-head .tag')).toHaveText('Billing');
    });

    await test.step('result: received only once captured, reviewed by a doctor, patient informed with a note', async () => {
      await panel(page, 'Tests requested').getByRole('link', { name: 'CRP' }).click();
      await status(page, 'Requested');
      await step(page, 'Record result received').click();
      await sawToast(page, 'Capture the result first');
      await page.getByLabel('Result summary').fill('CRP 12 mg/L (demo value).');
      await page.getByTestId('save-result').click();
      await status(page, 'Received');
      await expect(page.getByTestId('result-summary')).toContainText('CRP 12 mg/L');
      await page.getByLabel('Doctor’s action').fill('Mildly raised; continue the course.');
      await page.getByTestId('save-review-result').click();
      await status(page, 'Reviewed');
      await step(page, 'Patient informed').click();
      await page.getByTestId('confirm-transition').click();
      await expect(page.locator('.modal')).toContainText('A note is required for this step.');
      await page.getByLabel('Transition note').fill('Phoned the patient.');
      await page.getByTestId('confirm-transition').click();
      await status(page, 'Patient informed');
    });

    await test.step('billing submits the drafted claim and records the remittance', async () => {
      await signInAs(page, 'u_bill');
      await page.goto('#/medical/claims');
      await page.getByLabel('Filter by status').selectOption('draft');
      await page.getByTestId('table-claims').locator('tbody tr', { hasText: patient }).click();
      await expect(page.locator('.panel', { hasText: 'Tariff codes are invented' })).toContainText('DEMO-GP1');
      await step(page, 'Submit to scheme (simulated)').click();
      await status(page, 'Submitted');
      await expect(page.locator('.kv div', { hasText: 'Submitted on' }).locator('dd')).not.toHaveText('—');
      await step(page, 'Record full remittance').click(); // generic step points at the focused control
      await sawToast(page, 'Scheme remittance');
      await expect(page.getByLabel('Scheme paid amount')).toHaveValue('598'); // R520 + 15% VAT
      await page.getByTestId('record-remittance').click();
      await status(page, 'Paid');
      await expect(page.getByTestId('claim-balance')).toHaveText('R0.00');
    });

    await test.step('reception checks the patient out', async () => {
      await signInAs(page, 'u_rec');
      await page.goto('#/medical/waiting');
      await card(page, patient).getByRole('link', { name: patient }).click();
      await expect(page.getByTestId('visit-account')).toContainText('CLM-0079');
      await step(page, 'Check out').click();
      await status(page, 'Done');
      await expect(workflow(page)).toContainText('final state');
      await page.goto('#/medical/waiting');
      await expect(column(page, 'Done')).toContainText(patient);
    });
    expect(errors).toEqual([]);
  });

  test('claim: a part payment leaves a patient balance that is then settled', async ({ page }) => {
    await page.goto('#/medical');
    await signInAs(page, 'u_bill');
    await page.goto('#/medical/claims/claims_76');
    await step(page, 'Submit to scheme (simulated)').click();
    await status(page, 'Submitted');
    await page.getByLabel('Scheme paid amount').fill('400');
    await page.getByTestId('record-remittance').click();
    await expect(page.getByTestId('remittance')).toBeVisible(); // a part payment needs a note
    await page.getByLabel('Remittance note').fill('Paid at scheme rate.');
    await page.getByTestId('record-remittance').click();
    await status(page, 'Part paid');
    await expect(page.getByTestId('patient-balance-note')).toContainText('due from the patient');
    await step(page, 'Patient balance settled').click();
    await status(page, 'Settled');
    await expect(page.getByTestId('claim-balance')).toHaveText('R0.00');
  });

  test('nurse-only visit: completes without a doctor and drafts its own account; a doctor visit cannot', async ({ page }) => {
    await page.goto('#/medical');
    await signInAs(page, 'u_nurse');
    await page.goto('#/medical/waiting');
    await card(page, 'Nadia Pillay').getByRole('button', { name: 'Nurse visit complete' }).click(); // acute consultation
    await sawToast(page, 'This visit type needs a doctor consultation before billing.');
    await expect(column(page, 'Triaged')).toContainText('Nadia Pillay');
    await card(page, 'Zodwa Shabalala').getByRole('button', { name: 'Nurse visit complete' }).click(); // BP check (nurse)
    await sawToast(page, 'Draft claim CLM-0079 created (DEMO-NS3)');
    await expect(column(page, 'Billing')).toContainText('Zodwa Shabalala');
  });

  test('roles: each lands on a dashboard; restricted screens explain themselves', async ({ page }) => {
    await page.goto('#/medical');
    for (const [id, first] of [['u_partner', 'Thandeka'], ['u_gp', 'Ruan'], ['u_locum', 'Aisha'], ['u_nurse', 'Nokuthula'], ['u_rec', 'Michelle'], ['u_bill', 'Sizwe']]) {
      await signInAs(page, id);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Good day, ${first}`);
    }
    // Reception: no clinical notes, and vitals are hidden on a visit.
    await signInAs(page, 'u_rec');
    await expect(page.getByLabel('Main navigation').getByRole('link', { name: 'Consultations' })).toHaveCount(0);
    await page.goto('#/medical/consults');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await page.goto('#/medical/waiting/visits_93');
    await expect(page.getByText('Vitals are hidden for your simulated role.')).toBeVisible();
    // Nurse: sees the blocked script but cannot prescribe or swap the medicine.
    await signInAs(page, 'u_nurse');
    await page.goto('#/medical/scripts/scripts_49');
    await expect(step(page, 'Sign & issue')).toBeDisabled();
    await expect(page.getByText('A prescriber (Prescribe permission) must change the medicine.')).toBeVisible();
    // Locum: chronic register is view only, and says so.
    await signInAs(page, 'u_locum');
    await page.goto('#/medical/chronic');
    await expect(page.getByTestId('chronic-readonly')).toBeVisible();
    // Billing: no waiting room.
    await signInAs(page, 'u_bill');
    await page.goto('#/medical/waiting');
    await expect(page.getByTestId('no-access')).toBeVisible();
  });

  test('guided walkthrough: every step opens a screen where the described action works', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number, user: string, heading: string) => {
      await page.goto('#/medical');
      await page.getByTestId(`guide-step-${n}`).click();
      await expect(page.getByTestId('user-switcher')).toHaveValue(user);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    };
    await open(1, 'u_rec', 'Waiting room & visits');
    const booked = (await column(page, 'Booked').locator('.board-card strong').first().textContent())!;
    await column(page, 'Booked').getByRole('button', { name: 'Check in' }).first().click();
    await expect(column(page, 'Arrived')).toContainText(booked);

    await open(2, 'u_nurse', 'Waiting room & visits');
    const arrived = (await column(page, 'Arrived').locator('.board-card strong').first().textContent())!;
    await column(page, 'Arrived').getByTestId('open-triage').first().click();
    await captureVitals(page);
    await expect(column(page, 'Triaged')).toContainText(arrived);

    await open(3, 'u_locum', 'Amina Hassan');
    await expect(page.getByTestId('consult-problems')).toContainText('ICD-10');
    await page.getByLabel('ICD-10 code').selectOption('J02.9');
    await page.getByTestId('save-consult').click();
    await page.getByRole('button', { name: 'Sign consultation' }).click();
    await expect(panel(page, 'Status').locator('.panel-head .tag')).toHaveText('Signed');
    await page.getByTestId('send-to-billing').click();
    await expect(panel(page, 'Visit').locator('.panel-head .tag')).toHaveText('Billing');

    await open(4, 'u_locum', 'Amina Hassan');
    await expect(panel(page, 'Allergy check')).toContainText('Penicillin (hives)');
    await page.getByLabel('Alternative medicine').selectOption('azithromycin');
    await page.getByTestId('swap-medicine-save').click();
    await step(page, 'Sign & issue').click();
    await status(page, 'Issued');

    await open(5, 'u_gp', 'Results inbox');
    await page.getByTestId('results-attention').getByRole('link').first().click();
    await expect(page.getByText('Flagged abnormal', { exact: true })).toBeVisible();
    await page.getByTestId('save-review-result').click();
    await status(page, 'Reviewed');
    await step(page, 'Patient informed').click();
    await page.getByLabel('Transition note').fill('Phoned the patient; follow-up booked.');
    await page.getByTestId('confirm-transition').click();
    await status(page, 'Patient informed');

    await open(6, 'u_bill', 'Billing & claims');
    await page.getByLabel('Filter by status').selectOption('draft');
    await page.getByTestId('table-claims').locator('tbody tr').first().click();
    await step(page, 'Submit to scheme (simulated)').click();
    await page.getByTestId('record-remittance').click();
    await status(page, 'Paid');
    expect(errors).toEqual([]);
  });

  test('mobile: dashboard, waiting room and the working screens fit a 390px phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/medical', '#/medical/waiting', '#/medical/waiting/visits_92', '#/medical/consults/consults_61', '#/medical/scripts/scripts_49', '#/medical/claims/claims_75']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.goto('#/medical');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByLabel('Main navigation').getByRole('link', { name: 'Waiting room & visits' }).click();
    await expect(page.getByRole('heading', { name: 'Waiting room & visits', level: 1 })).toBeVisible();
  });
});
