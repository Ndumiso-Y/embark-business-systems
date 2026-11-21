import { expect, test, type Page } from '@playwright/test';

// Fynbos Talent Partners: the journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage). The walkthrough's records (jobs_1, jobs_2,
// submissions_4/5, placements_1, timesheets_1) have fixed ids and states on every weekday, and
// dates are computed from the browser's today, so nothing here depends on the date or time of day.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const anyToast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text });
const panel = (page: Page, title: string) => page.locator('.panel', { has: page.getByRole('heading', { name: title, exact: true }) });
const workflow = (page: Page) => panel(page, 'Workflow');
const status = (page: Page) => workflow(page).locator('.panel-head .tag');
const step = (page: Page, name: string) => workflow(page).getByRole('button', { name, exact: true });
const modal = (page: Page) => page.locator('.modal');
const withNote = async (page: Page, name: string, note: string) => {
  await step(page, name).click();
  await modal(page).getByLabel('Transition note').fill(note);
  await page.getByTestId('confirm-transition').click();
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const browserToday = async (page: Page) => page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
const addDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + n); return iso(d); };
/** Same as the seed's workday(): `n` working days after `day`. */
const workday = (day: string, n: number) => {
  const weekend = (x: string) => [0, 6].includes(new Date(`${x}T00:00:00`).getDay());
  let d = day; while (weekend(d)) d = addDays(d, 1);
  let left = n; while (left > 0) { d = addDays(d, 1); if (!weekend(d)) left--; }
  return d;
};
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T00:00:00`).getDay() + 6) % 7));

// Optional: E2E_FAKE_NOW=2026-11-21T22:10:00 runs the journeys on another day / time of day.
const FAKE_NOW = process.env.E2E_FAKE_NOW;

test.describe('Recruitment agency journeys', () => {
  test.beforeEach(async ({ page }) => {
    if (FAKE_NOW) await page.clock.install({ time: new Date(FAKE_NOW) });
  });

  test('guide: all six steps open the right screen as the right person and work on a fresh seed', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number) => { await page.goto('#/recruitment'); await page.getByTestId(`guide-step-${n}`).click(); };
    const today = await (async () => { await page.goto('#/recruitment'); return browserToday(page); })();

    // 1. A job order cannot open until the client's terms are signed — the fix is on the job itself.
    await open(1);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_senior');
    await expect(status(page)).toHaveText('Draft — not open');
    await step(page, 'Open job order').click();
    await expect(anyToast(page, 'has not signed the terms of business yet')).toBeVisible();
    await page.getByTestId('record-terms').click();
    await expect(anyToast(page, 'terms of business signed')).toBeVisible();
    await step(page, 'Open job order').click();
    await expect(status(page)).toHaveText('Open');

    // 2. Pipeline board: consent and ownership blocks are explained on the cards.
    await open(2);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_cons');
    await expect(page.getByTestId('reasons-submissions_1')).toContainText('consent expired');
    await page.getByTestId('send-cv-submissions_1').click();
    await expect(anyToast(page, 'consent expired')).toBeVisible();
    await page.getByTestId('card-submissions_1').getByRole('button', { name: 'Record consent' }).click();
    await page.getByTestId('save-consent').click();
    await expect(anyToast(page, 'consent recorded until')).toBeVisible();
    await page.getByTestId('send-cv-submissions_1').click();
    await expect(anyToast(page, 'Kevin Naidoo: CV recorded as sent')).toBeVisible();
    await expect(page.getByTestId('reasons-submissions_2')).toContainText(/Ownership rule\..*already sent to Kalahari Byte Labs by Ayesha Patel on/);
    await page.getByTestId('send-cv-submissions_2').click();
    await expect(anyToast(page, 'ownership rule')).toBeVisible();
    await page.getByTestId('send-cv-submissions_3').click();
    await expect(page.getByTestId('stage-submitted')).toContainText('3');
    await expect(page.getByTestId('stage-longlist')).toContainText('1');

    // 3. Booking an interview at the candidate's other interview time is refused as a clash.
    await open(3);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_res');
    await expect(page.getByTestId('other-interviews').first()).toContainText('INT-0001');
    const form = page.getByTestId('book-interview');
    await form.getByLabel('Interview date').fill(workday(today, 2));
    await form.getByLabel('Interview time').fill('10:00');
    await form.getByLabel('Client interviewer').fill('Fiona Mthembu');
    await page.getByTestId('save-interview').click();
    await expect(page.getByTestId('book-error')).toContainText('Tshepo Mabena already has an interview at 10:00');
    await form.getByLabel('Interview time').fill('14:00');
    await page.getByTestId('save-interview').click();
    await expect(anyToast(page, /booked .* the candidate moves to Interview/)).toBeVisible();
    await expect(status(page)).toHaveText('Interview');

    // 4. An offer needs a package and start date; acceptance creates the placement and fills the job.
    await open(4);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_cons');
    await step(page, 'Make offer').click();
    await expect(anyToast(page, 'Enter the offered annual package')).toBeVisible();
    await page.getByTestId('save-offer').click();
    await step(page, 'Make offer').click();
    await expect(status(page)).toHaveText('Offer');
    await step(page, 'Offer accepted').click();
    await expect(status(page)).toHaveText('Offer accepted');
    await expect(anyToast(page, /Placement PLC-\d{4} created · JOB-0003 is filled/)).toBeVisible();
    await page.getByRole('link', { name: /Data Engineer · JOB-0003/ }).click();
    await expect(status(page)).toHaveText('Filled');

    // 5. A fall-off inside the guarantee under refund terms raises a pro-rata credit note.
    await open(5);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_senior');
    await step(page, 'Fell off in guarantee').click();
    await expect(anyToast(page, 'Record the date the candidate left')).toBeVisible();
    await page.getByTestId('record-leaving').click();
    await expect(panel(page, 'If the candidate leaves')).toContainText(/Pro-rata refund: .* a credit note for R/);
    await withNote(page, 'Fell off in guarantee', 'Resigned for a role closer to home.');
    await expect(status(page)).toHaveText('Fell off');
    await expect(page.getByTestId('placement-links')).toContainText(/Credit note INV-\d{4}/);

    // 6. A timesheet is only invoiced once the client's approval is logged.
    await open(6);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_contracts');
    await expect(panel(page, 'Details')).toContainText('above the 45 h weekly cap');
    await step(page, 'Invoice timesheet').click();
    await expect(anyToast(page, 'Only a client-approved timesheet can be invoiced')).toBeVisible();
    await withNote(page, 'Log client approval (simulated)', 'Kyle Fortuin approved by email, overtime agreed.');
    await expect(status(page)).toHaveText('Client approved (simulated)');
    await step(page, 'Invoice timesheet').click();
    await expect(status(page)).toHaveText('Invoiced');
    await expect(anyToast(page, /Invoice INV-\d{4} raised: 48 h × R680/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('core journey: offer starting today → placement started → fee invoice issued and paid by Finance', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/recruitment/pipeline/submissions_4');
    await signInAs(page, 'u_cons');
    const today = await browserToday(page);
    await expect(status(page)).toHaveText('Final interview');
    await page.getByLabel('Start date').fill(today);
    await page.getByTestId('save-offer').click();
    await expect(panel(page, 'Offer details')).toContainText('Fee on acceptance: 18% of R850,000 = R153,000 excl. VAT');
    await step(page, 'Make offer').click();
    await step(page, 'Offer accepted').click();
    await expect(status(page)).toHaveText('Offer accepted');
    // The placement is listed and can start today.
    await page.goto('#/recruitment/placements');
    await page.getByTestId('table-placements').locator('tbody tr', { hasText: 'Naledi Pillay' }).click();
    await expect(status(page)).toHaveText('Offer accepted — not started');
    await step(page, 'Candidate started').click();
    await expect(status(page)).toHaveText('Started — in guarantee');
    await expect(anyToast(page, /Fee invoice INV-\d{4} raised as a draft/)).toBeVisible();
    // A senior consultant can open the invoice but not issue it; Finance can.
    await signInAs(page, 'u_senior');
    await page.getByTestId('placement-links').getByRole('link', { name: /Fee invoice/ }).click();
    await expect(page.getByTestId('invoice-total')).toHaveText('R175,950.00');
    await expect(step(page, 'Issue (simulated)')).toBeDisabled();
    await signInAs(page, 'u_fin');
    await step(page, 'Issue (simulated)').click();
    await expect(status(page)).toHaveText('Issued (simulated)');
    await step(page, 'Record payment').click();
    await expect(status(page)).toHaveText('Paid / settled');
    await page.reload();
    await expect(status(page)).toHaveText('Paid / settled');
    expect(errors).toEqual([]);
  });

  test('clients: a new job cannot be opened for a client without terms until they are recorded', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/recruitment/clients/clients_11');
    await signInAs(page, 'u_senior');
    await expect(status(page)).toHaveText('Terms: draft');
    await expect(page.getByTestId('client-new-job')).toBeDisabled();
    await expect(page.getByTestId('client-job-blocked')).toContainText('has no terms of business yet');
    await page.getByTestId('record-terms').click();
    await expect(status(page)).toHaveText('Terms signed');
    await page.getByTestId('client-new-job').click();
    await modal(page).getByLabel('Role').fill('Welding Inspector');
    await modal(page).getByLabel('Discipline').selectOption('engineering');
    await modal(page).getByLabel('Annual package (CTC)').fill('560000');
    await modal(page).getByLabel('Owner consultant').selectOption({ label: 'Marelize Botha · CON-0004' });
    await page.getByTestId('save-record').click();
    await expect(anyToast(page, /JOB-\d{4} opened on Highveld Arc Fabrication’s terms/)).toBeVisible();
    await expect(status(page)).toHaveText('Open');
    await expect(panel(page, 'Job order')).toContainText('20% · R112,000');
    expect(errors).toEqual([]);
  });

  test('candidates: duplicate warning, POPIA consent and screening before activation', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/recruitment/candidates');
    await signInAs(page, 'u_res');
    await page.getByLabel('Search Candidates').fill('Thandi');
    await expect(page.getByTestId('table-candidates')).toContainText(/Possible duplicate of CAN-\d{4}/);
    await page.getByLabel('Search Candidates').fill('');
    await page.goto('#/recruitment/candidates/candidates_1');
    const phone = (await page.locator('.kv').getByText(/^0\d{2} 555 \d{4}$/).first().textContent())!;
    await page.goto('#/recruitment/candidates');
    await page.getByTestId('new-record').click();
    await modal(page).getByLabel('First name').fill('Kev');
    await modal(page).getByLabel('Surname').fill('Naidoo');
    await modal(page).getByLabel('Email (fictional)').fill('kev.naidoo@example.com');
    await modal(page).getByLabel('Mobile (fictional)').fill(phone);
    await modal(page).getByLabel('Discipline').selectOption('it');
    await modal(page).getByLabel('Current role').fill('Full-stack Developer');
    await modal(page).getByLabel('Location').selectOption('cpt');
    await modal(page).getByLabel('Source').selectOption('referral');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('note').filter({ hasText: 'Possible duplicate' })).toContainText('Kevin Naidoo (CAN-0001) has the same mobile number');
    await expect(status(page)).toHaveText('New');
    await step(page, 'Mark screened').click();
    await expect(anyToast(page, 'Record the candidate’s POPIA consent')).toBeVisible();
    await panel(page, 'POPIA consent (illustrative)').getByRole('button', { name: 'Record consent' }).click();
    await page.getByTestId('save-consent').click();
    await step(page, 'Mark screened').click();
    await expect(anyToast(page, 'expected package')).toBeVisible();
    await page.getByLabel('Expected package').fill('740000');
    await page.getByLabel('Notice period').selectOption('1m');
    await page.getByTestId('save-screening').click();
    await step(page, 'Mark screened').click();
    await expect(status(page)).toHaveText('Screened');
    await step(page, 'Activate').click();
    await expect(status(page)).toHaveText('Active — can be submitted');
    expect(errors).toEqual([]);
  });

  test('roles: each user lands on a useful dashboard with their own menu; resourcers longlist but cannot send CVs', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/recruitment');
    const nav = page.getByLabel('Main navigation');
    const menus: Record<string, { has: string[]; hasNot: string[]; hero: RegExp }> = {
      u_dir: { has: ['Job orders', 'Pipeline', 'Timesheets', 'Invoices', 'Consultants & reports'], hasNot: [], hero: /billed/ },
      u_senior: { has: ['Job orders', 'Pipeline', 'Clients & terms', 'Contractors'], hasNot: ['Timesheets'], hero: /billed/ },
      u_cons: { has: ['Job orders', 'Pipeline', 'Placements', 'Consultants & reports'], hasNot: ['Contractors', 'Invoices', 'Timesheets'], hero: /billed/ },
      u_res: { has: ['Job orders', 'Pipeline', 'Candidates', 'Interviews'], hasNot: ['Clients & terms', 'Placements', 'Invoices', 'Consultants & reports'], hero: /in play/ },
      u_contracts: { has: ['Contractors', 'Timesheets', 'Invoices'], hasNot: ['Pipeline', 'Job orders', 'Placements'], hero: /awaiting client approval/ },
      u_fin: { has: ['Invoices', 'Placements', 'Timesheets', 'Consultants & reports'], hasNot: ['Pipeline', 'Job orders', 'Candidates'], hero: /billed/ },
    };
    for (const [id, menu] of Object.entries(menus)) {
      await page.goto('#/recruitment');
      await signInAs(page, id);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');
      await expect(page.locator('.dash-hero h2')).toHaveText(menu.hero);
      await expect(page.locator('.stat')).toHaveCount(8);
      for (const label of menu.has) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
      for (const label of menu.hasNot) await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }

    // The resourcer longlists, sees no “Send CV” button and is told who can send; fees are hidden.
    await signInAs(page, 'u_res');
    await page.goto('#/recruitment/jobs/jobs_2');
    await expect(panel(page, 'Job order')).not.toContainText('Fee');
    await expect(page.getByTestId('send-cv-submissions_3')).toHaveCount(0);
    await expect(page.getByTestId('card-submissions_3')).toContainText(/Send CVs & manage offers.*Ayesha Patel/);
    await page.getByLabel('Find a candidate').fill('Developer');
    await expect(page.getByLabel('Candidate to add').locator('option')).not.toHaveCount(1);
    await page.getByLabel('Candidate to add').selectOption({ index: 1 });
    await page.getByTestId('add-longlist').click();
    await expect(anyToast(page, 'added to the longlist')).toBeVisible();
    await expect(page.getByTestId('stage-longlist')).toContainText('4');
    await expect(page.getByTestId('add-and-send')).toHaveCount(0);
    // Finance has no pipeline; the contracts administrator cannot see fee figures.
    await signInAs(page, 'u_fin');
    await page.goto('#/recruitment/pipeline');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await signInAs(page, 'u_contracts');
    await page.goto('#/recruitment');
    await expect(page.locator('.stat', { hasText: 'Weighted pipeline' })).toContainText('—');
    expect(errors).toEqual([]);
  });

  test('interviews: the diary, a reminder logged as not sent and feedback before completion', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/recruitment/interviews');
    await signInAs(page, 'u_res');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Interviews');
    await page.getByTestId('table-interviews').locator('tbody tr', { hasText: 'Tshepo Mabena' }).first().click();
    await expect(status(page)).toHaveText('Scheduled');
    await expect(page.getByTestId('reminder-candidate')).toContainText('Fynbos Talent Partners');
    await page.getByTestId('log-reminder').click();
    await expect(anyToast(page, 'Reminder logged as not sent')).toBeVisible();
    await expect(panel(page, 'History')).toContainText('Reminder logged — not sent (preview only)');
    await step(page, 'Complete with feedback').click();
    await expect(anyToast(page, 'The interview is only on')).toBeVisible();
    // The diary's own booking dialog runs the same clash check.
    await page.goto('#/recruitment/interviews');
    await page.getByTestId('new-interview').click();
    await modal(page).getByLabel('Candidate and job').selectOption({ label: 'Tshepo Mabena · Key Account Manager — FMCG · Sable Lane Retail' });
    await expect(modal(page).getByTestId('other-interviews')).toContainText('INT-0001');
    expect(errors).toEqual([]);
  });

  test('timesheets: hours outside the assignment are refused with the days named', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/recruitment/contractors/assignments_1');
    await signInAs(page, 'u_contracts');
    const today = await browserToday(page);
    await expect(panel(page, 'Rates & margin')).toContainText('R160/h · 23.5%');
    const week = addDays(mondayOf(addDays(today, -75)), -7); // a week before the assignment began
    await page.getByLabel('Week starting').fill(week);
    await page.getByTestId('add-timesheet').click();
    await expect(status(page)).toHaveText('Draft');
    await expect(page.getByTestId('hours-form')).toContainText('outside');
    await page.getByLabel('Mon hours').fill('8');
    await page.getByTestId('save-hours').click();
    await step(page, 'Submit timesheet').click();
    await expect(anyToast(page, 'Hours are logged outside the assignment')).toBeVisible();
    await expect(panel(page, 'Hours')).toContainText('Cannot be submitted yet');
    // An ordinary week inside the assignment goes through.
    await page.goto('#/recruitment/timesheets');
    await page.getByTestId('table-timesheets').locator('tbody tr').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('week of');
    expect(errors).toEqual([]);
  });

  test('invoices and reports: overdue flags, issuing drafts, credit notes and fees against target', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/recruitment/invoices');
    await signInAs(page, 'u_fin');
    await expect(page.locator('.stat', { hasText: 'Overdue' })).toContainText('2 invoices past the due date');
    await page.getByLabel('Filter by status').selectOption('issued');
    await expect(page.getByTestId('table-invoices')).toContainText(/Overdue \d+ days/);
    await page.getByLabel('Filter by status').selectOption('');
    await page.getByLabel('Search Invoices & credit notes').fill('Credit note');
    await page.getByTestId('table-invoices').locator('tbody tr').first().click();
    await expect(page.getByRole('heading', { name: 'Credit note', exact: true })).toBeVisible();
    await expect(page.getByTestId('invoice-total')).toHaveText(/^-R/);
    await page.goto('#/recruitment/reports');
    await expect(page.getByTestId('league')).toContainText('Ayesha Patel');
    await page.getByRole('button', { name: /^Q\d \d{4}$/ }).click();
    await expect(page.locator('.stat', { hasText: 'Fees billed' }).locator('.metric-label')).toContainText(/Q\d/);
    await expect(panel(page, 'Funnel · last six months')).toContainText('CVs sent');
    expect(errors).toEqual([]);
  });

  test('mobile: dashboard, pipeline board and the key screens are usable with no sideways page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/recruitment', '#/recruitment/jobs/jobs_2', '#/recruitment/pipeline', '#/recruitment/pipeline/submissions_5', '#/recruitment/candidates/candidates_1',
      '#/recruitment/interviews', '#/recruitment/clients/clients_1', '#/recruitment/placements/placements_1', '#/recruitment/timesheets/timesheets_1', '#/recruitment/invoices', '#/recruitment/reports']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
    // The board's buttons are on screen with a thumb, not in a scrolled-off column.
    await page.goto('#/recruitment/jobs/jobs_2');
    const send = page.getByTestId('send-cv-submissions_3');
    await send.scrollIntoViewIfNeeded();
    const box = (await send.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await send.click();
    await expect(anyToast(page, 'CV recorded as sent')).toBeVisible();
  });
});
