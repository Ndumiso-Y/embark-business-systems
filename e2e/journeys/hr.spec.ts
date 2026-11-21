import { expect, test, type Page } from '@playwright/test';

// Bluegum Distribution (Human resources): the journeys a first-time visitor would try, through the UI only.
// Every test starts from a fresh seed (empty storage). The walkthrough's records have fixed ids on every day
// (leave_1–5, employees_53, applicants_1, cases_1–2, reviews_1–2, courses_1, payruns_1, requisitions_1), and
// dates typed into forms are either computed from the browser's today or fixed far-future dates, so nothing
// here depends on the day of the week or the time of day.

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
const nav = (page: Page) => page.getByLabel('Main navigation');
const today = (page: Page) => page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
const plusDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const FAKE_NOW = process.env.E2E_FAKE_NOW;

test.describe('Human resources journeys', () => {
  test.beforeEach(async ({ page }) => {
    if (FAKE_NOW) await page.clock.install({ time: new Date(FAKE_NOW) });
  });

  test('self-service: an employee sees only their own leave, is refused beyond the balance and requests leave that the manager approves', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/hr');
    await signInAs(page, 'u_emp');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good day, Lerato');
    await expect(page.locator('.dash-hero')).toContainText('Your annual leave');
    for (const hidden of ['Employees', 'Leave requests', 'Who’s away', 'Payroll inputs', 'Reports']) await expect(nav(page).getByRole('link', { name: hidden, exact: true })).toHaveCount(0);
    await nav(page).getByRole('link', { name: 'My leave', exact: true }).click();
    await expect(page.getByTestId('balances')).toContainText('Annual leave');

    // Far more annual leave than the balance: refused, with unpaid leave offered instead.
    const form = page.getByTestId('request-form');
    const start = await form.getByLabel('First day').inputValue();
    await form.getByLabel('Last day').fill(plusDays(start, 60));
    await expect(page.getByTestId('request-preview')).toContainText(/Only .* days of annual leave available/);
    await page.getByTestId('submit-leave').click();
    await expect(toast(page)).toContainText('as unpaid leave');
    await expect(page.getByTestId('as-unpaid')).toBeVisible();

    // One day of annual leave goes through to the manager.
    await form.getByLabel('Last day').fill(start);
    await form.getByLabel('Reason').fill('Clinic appointment for my son');
    await page.getByTestId('submit-leave').click();
    await expect(anyToast(page, /sent for approval to Nokuthula Zungu \(notification previewed — not sent\)/)).toBeVisible();
    await expect(page.getByTestId('my-requests').locator('li').first()).toContainText('Awaiting approval');

    // Other people's leave is not reachable.
    await page.goto('#/hr/leave');
    await expect(page.getByTestId('no-access')).toBeVisible();

    // The depot manager approves it.
    await signInAs(page, 'u_mgr');
    await page.goto('#/hr/leave');
    await page.getByLabel('Filter by status').selectOption('requested');
    await page.getByTestId('table-leave').locator('tbody tr', { hasText: 'Lerato Dube' }).first().click();
    await expect(panel(page, 'Checks before approval')).toContainText('Nokuthula Zungu, Lerato Dube’s manager');
    if (await page.getByTestId('team-cover').count()) {
      await page.getByLabel('Cover note').fill('Kevin covers the shift.');
      await page.getByTestId('approve-with-note').click();
    } else await step(page, 'Approve').click();
    await expect(status(page)).toHaveText('Approved');
    await expect(page.getByTestId('leave-message')).toContainText('has been approved by Nokuthula Zungu');
    await expect(panel(page, 'Message to the employee')).toContainText('Preview only — not sent');

    await signInAs(page, 'u_emp');
    await page.goto('#/hr/myleave');
    await expect(page.getByTestId('my-requests').locator('li').first()).toContainText('Approved');
    expect(errors).toEqual([]);
  });

  test('leave approval: a team clash needs a cover note, and it shows on the who’s-away calendar', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/hr');
    await signInAs(page, 'u_mgr');
    await page.goto('#/hr/calendar');
    await expect(page.getByLabel('Site')).toHaveValue('dbn'); // a depot manager starts on their own depot
    await page.getByLabel('Site').selectOption('');
    const durban = page.getByTestId('team-warehouse|dbn');
    await expect(durban).toContainText('Warehouse · Durban');
    // The calendar opens on this week; the clash is next week (or in this window when today is a weekend).
    if (!(await page.getByRole('link', { name: /Priya Moodley · Annual \(awaiting approval\)/ }).count())) await page.getByRole('button', { name: 'Next two weeks' }).click();
    await expect(page.getByRole('link', { name: /Priya Moodley · Annual \(awaiting approval\)/ }).first()).toBeVisible();

    await page.goto('#/hr/leave/leave_1');
    await step(page, 'Approve').click();
    await expect(toast(page)).toContainText('Team cover: 2 of 6 in Warehouse · Durban are already away');
    await expect(status(page)).toHaveText('Awaiting approval');
    await page.getByTestId('approve-with-note').click();
    await expect(page.getByTestId('feedback')).toContainText('Write how the team’s work is covered');
    await page.getByLabel('Cover note').fill('Kevin moves from receiving to picking; Saturday overtime approved.');
    await page.getByTestId('approve-with-note').click();
    await expect(status(page)).toHaveText('Approved');
    await expect(panel(page, 'Message to the employee')).toContainText('Cover note: Kevin moves');

    await page.goto('#/hr/calendar');
    await page.getByLabel('Site').selectOption('dbn');
    if (!(await page.getByRole('link', { name: /Priya Moodley · Annual/ }).count())) await page.getByRole('button', { name: 'Next two weeks' }).click();
    await expect(page.locator('.hr-team-cell.over').first()).toHaveText('3');
    expect(errors).toEqual([]);
  });

  test('leave rules: nobody approves their own leave; long sick leave needs a medical certificate; beyond balance is refused', async ({ page }) => {
    await page.goto('#/hr/leave/leave_2');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Annelie van der Walt · Annual');
    await step(page, 'Approve').click();
    await expect(toast(page)).toContainText('Nobody approves their own leave — this goes to Sipho Mahlangu (your manager) or HR.');

    await signInAs(page, 'u_hro');
    await page.goto('#/hr/leave/leave_3');
    await step(page, 'Approve').click();
    await expect(toast(page)).toContainText('needs a medical certificate');
    await page.getByTestId('medical-cert').getByRole('checkbox').check();
    await step(page, 'Approve').click();
    await expect(status(page)).toHaveText('Approved');

    await page.goto('#/hr/leave/leave_4');
    await expect(page.getByTestId('leave-checks')).toContainText(/Only .* days of annual leave available — this request is 8 working days/);
    await step(page, 'Approve').click();
    await expect(toast(page)).toContainText('as unpaid leave');
    await expect(status(page)).toHaveText('Awaiting approval');
  });

  test('onboarding → probation → active: blocked steps point to the checklist and the probation review on the same page', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/hr/onboarding');
    await signInAs(page, 'u_hro');
    await page.getByTestId('hire-employees_53').getByRole('link', { name: 'Open checklist →' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xolani Biyela');
    await expect(status(page)).toHaveText('Onboarding');
    await step(page, 'Start employment').click();
    await expect(toast(page)).toContainText('3 required items still open: Banking details; PPE issued; Licence and PrDP checked');
    const list = page.getByTestId('onboarding-checklist');
    for (const item of ['Banking details captured', 'PPE issued (safety boots, hi-vis vest, gloves)', 'Driver’s licence (Code 14) and PrDP checked']) await list.getByLabel(item).check();
    await expect(panel(page, 'Onboarding checklist').locator('.panel-head .tag')).toHaveText('8/8 done');
    await step(page, 'Start employment').click();
    await expect(status(page)).toHaveText('Probation');

    await step(page, 'Confirm appointment').click();
    await expect(toast(page)).toContainText('Record the probation review first');
    await page.getByLabel('Probation outcome').selectOption('confirmed');
    await page.getByTestId('save-probation').click();
    await expect(page.getByTestId('feedback')).toContainText('Press “Confirm appointment” above');
    await step(page, 'Confirm appointment').click();
    await expect(status(page)).toHaveText('Active');
    await expect(panel(page, 'History')).toContainText('Probation review recorded: Confirmed');
    expect(errors).toEqual([]);
  });

  test('exit: notice needs a reason and last day; the exit needs the last day to pass and the checklist', async ({ page }) => {
    await page.goto('#/hr/employees/employees_24'); // on notice, last day still ahead
    await signInAs(page, 'u_hro');
    await expect(status(page)).toHaveText('On notice');
    await step(page, 'Complete exit').click();
    await expect(toast(page)).toContainText('can only be completed on or after it');
    const t = await today(page);
    await page.getByLabel('Last working day').fill(t);
    await page.getByTestId('save-leaving').click();
    await step(page, 'Complete exit').click();
    await expect(toast(page)).toContainText('equipment returned and access removed');
    await page.getByTestId('exit-checklist').getByRole('checkbox').first().check();
    await page.getByTestId('exit-checklist').getByRole('checkbox').last().check();
    await step(page, 'Complete exit').click();
    await expect(status(page)).toHaveText('Exited');

    // An active employee: notice needs the reason and last day first.
    await page.goto('#/hr/employees/employees_15');
    await step(page, 'Record notice').click();
    await expect(toast(page)).toContainText('Choose the reason for leaving first');
    await page.getByTestId('start-leaving').click();
    await page.getByLabel('Reason for leaving').selectOption('resignation');
    await page.getByLabel('Last working day').fill(plusDays(t, 30));
    await page.getByTestId('save-leaving').click();
    await step(page, 'Record notice').click();
    await expect(status(page)).toHaveText('On notice');
  });

  test('hiring: an unbudgeted post needs the MD; hiring an applicant creates the employee in Onboarding', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/hr/hiring/requisitions_1');
    await signInAs(page, 'u_hro');
    await step(page, 'Approve & open').click();
    await expect(toast(page)).toContainText('only the managing director can approve an unbudgeted requisition');
    await signInAs(page, 'u_md');
    await step(page, 'Approve & open').click();
    await expect(status(page)).toHaveText('Open');

    await signInAs(page, 'u_hro');
    await page.goto('#/hr/applicants/applicants_1');
    await expect(page.getByTestId('offer-letter')).toContainText('Dear Sizwe');
    await expect(panel(page, 'Offer')).toContainText('Preview only — not sent');
    await step(page, 'Mark as hired').click();
    await expect(anyToast(page, /Sizwe Nhlapo added to Onboarding · REQ-0002 filled/)).toBeVisible();
    await expect(status(page)).toHaveText('Hired');
    await panel(page, 'Hired').getByRole('link', { name: 'Open the checklist →' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sizwe Nhlapo');
    await expect(panel(page, 'Onboarding checklist').locator('.panel-head .tag')).toHaveText('1/8 done');

    // A shortlisted candidate cannot be moved on without an interview score.
    await page.goto('#/hr/applicants');
    await page.getByRole('link', { name: 'Jaco Visser' }).click();
    await step(page, 'Record interview').click();
    await expect(toast(page)).toContainText('Record the interview date and score first');
    await page.getByLabel('Interview score').selectOption('4');
    await page.getByTestId('save-interview').click();
    await step(page, 'Record interview').click();
    await expect(status(page)).toHaveText('Interviewed');
    expect(errors).toEqual([]);
  });

  test('discipline: hearing notice rule, outcome with an impartial chair, and the warning lands on the employee’s file', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/hr/cases/cases_1');
    await signInAs(page, 'u_hro');
    await step(page, 'Schedule hearing').click();
    await expect(toast(page)).toContainText('Set the hearing date');
    // Monday notice, Wednesday hearing: only Tuesday in between.
    await page.getByLabel('Notice given on').fill('2027-03-01');
    await page.getByLabel('Hearing date').fill('2027-03-03');
    await page.getByTestId('save-hearing').click();
    await expect(page.getByTestId('feedback')).toContainText('Only 1 working day between the notice and the hearing');
    await page.getByLabel('Hearing date').fill('2027-03-04');
    await page.getByTestId('save-hearing').click();
    await step(page, 'Schedule hearing').click();
    await expect(status(page)).toHaveText('Hearing scheduled');
    await expect(panel(page, 'History')).toContainText('previewed — not sent');

    // The forklift case's hearing has been held.
    await page.goto('#/hr/cases/cases_2');
    await step(page, 'Record outcome').click();
    await expect(toast(page)).toContainText('Record the chairperson first');
    await page.getByLabel('Chairperson').fill('Palesa Motaung'); // the investigator
    await page.getByLabel('Finding').selectOption('guilty');
    await page.getByLabel('Sanction').selectOption('written');
    await page.getByTestId('save-outcome').click();
    await step(page, 'Record outcome').click();
    await expect(toast(page)).toContainText('must not be the investigator');
    await page.getByLabel('Chairperson').fill('Lwazi Ntshona');
    await page.getByTestId('save-outcome').click();
    await step(page, 'Record outcome').click();
    await expect(status(page)).toHaveText('Outcome recorded');
    await expect(anyToast(page, /Written warning WRN-\d{4} placed on Bongani Zwane’s file/)).toBeVisible();
    await page.goto('#/hr/employees/employees_14');
    await expect(page.getByTestId('employee-warnings')).toContainText('Written warning');
    await page.goto('#/hr/cases');
    await expect(page.locator('main')).toContainText('not legal advice');
    expect(errors).toEqual([]);
  });

  test('payroll inputs: checked by payroll, blocked by unresolved items fixed from the pack, approved by a second person and exported', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/hr/payroll/payruns_1');
    await signInAs(page, 'u_pay');
    await expect(workflow(page)).toContainText('does not calculate salaries, PAYE, UIF or any tax');
    await step(page, 'Mark as checked').click();
    await expect(status(page)).toHaveText('Checked');
    await expect(step(page, 'Approve inputs')).toBeDisabled(); // payroll prepares, someone else approves

    await signInAs(page, 'u_md');
    await step(page, 'Approve inputs').click();
    await expect(toast(page)).toContainText('3 items are unresolved');
    const issues = page.getByTestId('pack-issues');
    await expect(issues).toContainText('12.5 h overtime');
    await issues.getByTestId('approve-overtime').click();
    await expect(issues).not.toContainText('12.5 h overtime');

    // The unpaid-leave request belongs to its manager or HR; the banking detail to HR.
    await signInAs(page, 'u_hro');
    await page.goto('#/hr/leave/leave_5');
    await step(page, 'Approve').click();
    await expect(status(page)).toHaveText('Approved');
    await signInAs(page, 'u_hrm');
    await page.goto('#/hr/payroll/payruns_1');
    await page.getByRole('button', { name: 'Mark banking details captured' }).click();
    await expect(panel(page, 'Must be resolved before approval').locator('.panel-head .tag')).toHaveText('All clear');

    await signInAs(page, 'u_md');
    await step(page, 'Approve inputs').click();
    await expect(status(page)).toHaveText('Approved · locked');
    await expect(panel(page, 'Approved pack (locked)')).toContainText('Unpaid leave days');
    const download = page.waitForEvent('download');
    await page.getByTestId('download-csv').click();
    expect((await download).suggestedFilename()).toMatch(/^payroll-inputs-\d{4}-\d{2}\.csv$/);

    await signInAs(page, 'u_pay');
    await step(page, 'Send to payroll (simulated)').click();
    await expect(status(page)).toHaveText('Sent to payroll');
    await expect(panel(page, 'History')).toContainText('simulated, nothing was transmitted');
    expect(errors).toEqual([]);
  });

  test('performance and training: a 2 needs an improvement plan, a 5 is moderated; completing a course renews certificates', async ({ page }) => {
    await page.goto('#/hr/reviews/reviews_1');
    await signInAs(page, 'u_mgr');
    await step(page, 'Sign off').click();
    await expect(toast(page)).toContainText('A rating of 2 needs an improvement plan');
    await page.getByLabel('Improvement plan actions').fill('Daily accuracy check with the supervisor for four weeks.');
    await page.getByLabel('Improvement plan review date').fill(plusDays(await today(page), 30));
    await page.getByTestId('save-pip').click();
    await step(page, 'Sign off').click();
    await expect(status(page)).toHaveText('Signed off');
    await page.goto('#/hr/reviews/reviews_2');
    await step(page, 'Sign off').click();
    await expect(toast(page)).toContainText('must be moderated before sign-off');
    await step(page, 'Send to moderation').click();
    await expect(status(page)).toHaveText('Moderation');

    await signInAs(page, 'u_hro');
    await page.goto('#/hr/training/courses_1');
    await step(page, 'Complete course').click();
    await expect(toast(page)).toContainText('Mark who attended first');
    await page.getByLabel('Zodwa Gumede attended').check();
    await page.getByLabel('Chantelle Arendse attended').check();
    await step(page, 'Complete course').click();
    await expect(anyToast(page, /2 × Forklift operator certificate issued, valid 24 months/)).toBeVisible();
    await page.goto('#/hr/employees/employees_35');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zodwa Gumede');
    await expect(page.getByTestId('employee-certs')).toContainText('Renewed');
  });

  test('roles: each simulated user has a different menu, lands somewhere useful and is told what they cannot do', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/hr');
    const menus: Record<string, { has: string[]; hasNot: string[] }> = {
      u_hrm: { has: ['Employees', 'Payroll inputs', 'Requisitions', 'Discipline & grievances', 'Reports'], hasNot: [] },
      u_hro: { has: ['Employees', 'Onboarding', 'Leave requests', 'Applicants', 'Training'], hasNot: ['Payroll inputs'] },
      u_pay: { has: ['Payroll inputs', 'Leave requests', 'Reports'], hasNot: ['Onboarding', 'Discipline & grievances', 'Applicants'] },
      u_mgr: { has: ['Leave requests', 'Who’s away', 'Performance reviews', 'Payroll inputs'], hasNot: ['Requisitions', 'Reports', 'Onboarding'] },
      u_md: { has: ['Reports', 'Requisitions', 'Payroll inputs', 'Performance reviews'], hasNot: ['Onboarding', 'Training'] },
      u_emp: { has: ['My leave'], hasNot: ['Employees', 'Leave requests', 'Who’s away', 'Payroll inputs'] },
    };
    for (const [id, menu] of Object.entries(menus)) {
      await page.goto('#/hr');
      await signInAs(page, id);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');
      await expect(page.locator('.dash-hero a')).toHaveCount(1);
      for (const label of menu.has) await expect(nav(page).getByRole('link', { name: label, exact: true })).toBeVisible();
      for (const label of menu.hasNot) await expect(nav(page).getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }
    // Salaries are hidden from the HR officer; the line manager sees the leave step but is told who decides.
    await signInAs(page, 'u_hro');
    await page.goto('#/hr/employees/employees_30');
    await expect(panel(page, 'Details')).toContainText('hidden for your simulated role');
    await expect(panel(page, 'Details')).not.toContainText('Monthly salary');
    await signInAs(page, 'u_pay');
    await page.goto('#/hr/employees/employees_30');
    await expect(panel(page, 'Details')).toContainText('Monthly salary');
    await page.goto('#/hr/leave/leave_1');
    await expect(step(page, 'Approve')).toBeDisabled();
    await expect(workflow(page)).toContainText(/Approve leave.*switch to/);
    await signInAs(page, 'u_mgr');
    await page.goto('#/hr/leave/leave_3');
    await expect(page.getByTestId('leave-checks')).toContainText('Only HR or Themba Mkhize’s own manager (Willem Swart)');
    expect(errors).toEqual([]);
  });

  test('guide: all six steps open the right screen as the right person', async ({ page }) => {
    const errors = watchErrors(page);
    const expected: Array<[string, string]> = [
      ['u_emp', 'My leave'], ['u_mgr', 'Priya Moodley · Annual'], ['u_hro', 'Xolani Biyela'],
      ['u_hro', 'Sizwe Nhlapo'], ['u_hro', 'Ricardo Februarie · Absent without leave'], ['u_pay', 'Nov 2026 payroll inputs'],
    ];
    for (let n = 1; n <= 6; n++) {
      await page.goto('#/hr');
      await page.getByTestId(`guide-step-${n}`).click();
      await expect(page.getByTestId('user-switcher')).toHaveValue(expected[n - 1][0]);
      if (n === 6) await expect(page.getByRole('heading', { level: 1 })).toContainText('payroll inputs');
      else await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected[n - 1][1]);
    }
    expect(errors).toEqual([]);
  });

  test('mobile 390 px: no page scrolls sideways; the calendar scrolls inside its own box', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/hr', '#/hr/calendar', '#/hr/leave', '#/hr/leave/leave_1', '#/hr/myleave', '#/hr/onboarding/employees_53', '#/hr/payroll/payruns_1', '#/hr/cases/cases_2', '#/hr/reviews/reviews_1', '#/hr/applicants', '#/hr/reports']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
    await page.goto('#/hr/calendar');
    const box = page.getByTestId('whos-away');
    expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await signInAs(page, 'u_emp');
    await page.goto('#/hr/myleave');
    const submit = page.getByTestId('submit-leave');
    await submit.scrollIntoViewIfNeeded();
    const b = (await submit.boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });

  test('honesty: boundaries say what is not done, and the business name follows branding', async ({ page }) => {
    await page.goto('#/hr/settings');
    await expect(page.locator('main')).toContainText('no salary, PAYE, UIF, SDL or tax is calculated');
    await expect(page.locator('main')).toContainText('not legal advice');
    await expect(page.locator('main')).toContainText('Employment-equity reporting');
    await page.goto('#/hr/applicants/applicants_1');
    await expect(page.getByTestId('offer-letter')).toContainText('Bluegum Distribution HR');
  });
});
