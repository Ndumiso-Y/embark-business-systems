import { expect, test, type Page } from '@playwright/test';

// BrightPath Cleaning Services: the journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage). Today's shifts (shifts_1–16), the guided inspection,
// the three open stock requests and the quotes have fixed ids on every weekday, and clock-in times are
// only matched by pattern, so nothing here depends on the date or the time of day.

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
const column = (page: Page, name: string) => page.locator(`section[aria-label="${name} column"]`);
const modal = (page: Page) => page.locator('.modal');
const today = (page: Page) => page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
/** Number shown in a register table cell for the row that contains `text`. */
const cell = async (page: Page, table: string, text: string, index: number) =>
  Number((await page.getByTestId(table).locator('tbody tr', { hasText: text }).first().locator('td').nth(index).textContent())!.replace(/\D/g, ''));

// Optional: E2E_FAKE_NOW=2026-11-16T03:10:00 runs the journeys on another day / time of day.
const FAKE_NOW = process.env.E2E_FAKE_NOW;

test.describe('Cleaning services journeys', () => {
  test.beforeEach(async ({ page }) => {
    if (FAKE_NOW) await page.clock.install({ time: new Date(FAKE_NOW) });
  });

  test('today’s schedule: clock a team in → log an absence with a note → relief (ineligible cleaners explained) → checklist → complete', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/cleaning/schedule');
    await signInAs(page, 'u_sup');

    // Meridian Block B has not started: clocking the first cleaner in starts the shift.
    const card = page.getByTestId('shift-card-shifts_3');
    await expect(card).toContainText('3/3 rostered');
    await card.getByRole('button', { name: 'Clock in Sizwe Gumede' }).click();
    await expect(toast(page)).toContainText(/Sizwe Gumede clocked in at \d\d:\d\d/);
    await expect(card).toContainText('1/3 present');
    await expect(card).toContainText('On site');
    await expect(card).toContainText(/(In|Late) · \d\d:\d\d/);

    // An absence needs a note; with it the site is flagged as needing relief.
    await card.getByRole('button', { name: 'Mark Dimakatso Daniels absent' }).click();
    await page.getByTestId('confirm-absence').click();
    await expect(modal(page)).toContainText('A note is required');
    await page.getByLabel('Absence note').fill('Phoned in sick at 14:10; client informed.');
    await page.getByTestId('confirm-absence').click();
    await expect(toast(page)).toContainText('Dimakatso Daniels marked absent');
    await expect(card).toContainText('Absent — relief needed');
    await card.getByRole('button', { name: 'Clock in Mpho Sithole' }).click();
    await expect(card).toContainText('2/3 present');

    // The shift page explains who can cover and why the others cannot.
    await card.getByRole('link', { name: /Assign a relief cleaner/ }).click();
    await expect(status(page)).toHaveText('Absent — relief needed');
    await expect(page.getByTestId('relief-pointer')).toContainText('Relief cover');
    const picker = page.getByTestId('relief-picker');
    await expect(picker.locator('li', { hasText: 'Not eligible' }).first()).toBeVisible();
    await expect(picker).toContainText(/has not completed the site induction for Meridian Office Park — Block B/);
    // Any other cleaner is run through the same checks and the refusal says why.
    await page.getByLabel('Choose a cleaner').selectOption({ label: 'Nokuthula Nkosi · Team leader' });
    await page.getByRole('button', { name: 'Assign as relief' }).click();
    await expect(toast(page)).toContainText(/Nokuthula Nkosi (is already on an overlapping shift|has not completed the site induction)/);
    await picker.locator('li', { hasText: 'Eligible' }).filter({ hasNotText: 'Not eligible' }).first().getByRole('button', { name: /^Assign / }).click();
    await expect(status(page)).toHaveText('Relief assigned');
    const roster = page.getByTestId('roster-table');
    await expect(roster).toContainText('relief cover on this shift');
    await roster.getByRole('button', { name: /^Clock in / }).click();
    await expect(panel(page, 'Roster & attendance').locator('.panel-head .tag')).toHaveText('3/3 present');

    // Completing needs the daily checklist (or a note saying what was missed).
    await step(page, 'Complete shift').click();
    await expect(toast(page)).toContainText('daily tasks not ticked');
    const checklist = panel(page, 'Daily checklist');
    for (const box of await checklist.getByRole('checkbox').all()) await box.check();
    await expect(checklist.locator('.panel-head .tag')).toHaveText('6/6 done');
    await step(page, 'Complete shift').click();
    await expect(status(page)).toHaveText('Completed');
    await expect(panel(page, 'History')).toContainText('Dimakatso Daniels absent — Phoned in sick');

    await page.reload();
    await expect(status(page)).toHaveText('Completed');
    expect(errors).toEqual([]);
  });

  test('clinic relief: only the eligible relief cleaner can be assigned and each refusal is explained', async ({ page }) => {
    await page.goto('#/cleaning/schedule/shifts_1');
    await signInAs(page, 'u_sup');
    await expect(status(page)).toHaveText('Absent — relief needed');
    const picker = page.getByTestId('relief-picker');
    await expect(picker).toContainText('1 of 7 can cover this shift');
    await expect(picker).toContainText('is already on an overlapping shift at Highveld College — Main Campus');
    await expect(picker).toContainText('has not completed the site induction for Umthombo Day Clinic');
    await expect(picker).toContainText(/infection-control training expired on .* — it must be in date for healthcare sites/);
    await expect(picker.getByRole('button', { name: /^Assign / })).toHaveCount(1);
    await picker.getByRole('button', { name: 'Assign Gift Mthembu as relief' }).click();
    await expect(toast(page)).toContainText('Gift Mthembu assigned as relief at Umthombo Day Clinic');
    await expect(panel(page, 'Staffing')).toContainText('Rostered3');
  });

  test('inspection: a low area needs a corrective action → submit → below SLA schedules a re-inspection', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/cleaning/inspections');
    await signInAs(page, 'u_sup');
    // A new inspection is scored area by area on its own sheet; the form opens with today's date.
    await page.getByTestId('new-record').click();
    await expect(modal(page).getByLabel('Inspection date')).toHaveValue(await today(page));
    await modal(page).getByLabel('Site', { exact: true }).selectOption({ label: 'Sedibeng Logistics Offices · ST-0013' });
    await modal(page).getByLabel('Inspected by', { exact: true }).selectOption({ label: 'Sibusiso Ndlovu · EMP-0002' });
    await page.getByTestId('save-record').click();
    await expect(status(page)).toHaveText('Draft');
    await step(page, 'Submit inspection').click();
    await expect(toast(page)).toContainText('Score every area from 1 to 5');
    const scores: Record<string, string> = { 'Reception & entrance': '4', Ablutions: '2', 'Kitchens & canteens': '3', Floors: '3', 'Bins & waste': '4', 'Glass & windows': '3' };
    for (const [area, n] of Object.entries(scores)) await page.getByRole('group', { name: `${area} score` }).getByRole('button', { name: n, exact: true }).click();
    const sheet = panel(page, 'Area scores');
    await expect(sheet.locator('.panel-head .tag')).toHaveText('63% · SLA 80%');

    // Ablutions scored 2: a corrective action and a due date are required, right on the sheet.
    await step(page, 'Submit inspection').click();
    await expect(toast(page)).toContainText('record a corrective action before submitting');
    await page.getByLabel('Corrective action', { exact: true }).fill('Re-brief the team on the ablution method; supervisor spot check daily for a week.');
    await page.getByTestId('save-corrective').click();
    await step(page, 'Submit inspection').click();
    await expect(toast(page)).toContainText('needs a due date');
    await page.getByLabel('Corrective action due').fill(await today(page));
    await page.getByTestId('save-corrective').click();
    await expect(sheet).toContainText('Submitting it will schedule a re-inspection within 7 days');
    await step(page, 'Submit inspection').click();
    await expect(anyToast(page, /Below SLA — re-inspection QI-\d{4} scheduled/)).toBeVisible();
    await expect(status(page)).toHaveText('Submitted');

    // The re-inspection exists as its own draft, linked back to this one.
    await panel(page, 'Result').getByRole('link', { name: /^QI-\d{4}/ }).last().click();
    await expect(status(page)).toHaveText('Draft');
    await expect(panel(page, 'Details')).toContainText('Re-inspection');
    await expect(panel(page, 'Result')).toContainText('63%');
    expect(errors).toEqual([]);
  });

  test('complaint: log → acknowledge → assign → resolve → client confirms', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/cleaning/complaints');
    await signInAs(page, 'u_liaison');
    await page.getByTestId('new-record').click();
    // Date, time and priority are prefilled, so only what the client said has to be typed.
    await expect(modal(page).getByLabel('Logged on')).toHaveValue(await today(page));
    await expect(modal(page).getByLabel('Logged at')).toHaveValue(/^\d\d:\d\d$/);
    await modal(page).getByLabel('Site', { exact: true }).selectOption({ label: 'Karoo Mutual Head Office · ST-0004' });
    await modal(page).getByLabel('Category').selectOption('missed');
    await modal(page).getByLabel('Priority').selectOption('high');
    await modal(page).getByLabel('Reported by').fill('Elmarie Botha');
    await modal(page).getByLabel('What the client reported').fill('Level 2 kitchen was not cleaned this morning.');
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText(/Complaint \/ request CR-\d{4} created/);
    await expect(status(page)).toHaveText('Logged');
    await expect(panel(page, 'Response clock')).toContainText('Within target');
    await expect(page.getByTestId('ack-preview')).toContainText('Dear Elmarie Botha');
    await expect(panel(page, 'Acknowledgement to the client')).toContainText('no message is sent');

    await step(page, 'Acknowledge').click();
    await expect(status(page)).toHaveText('Acknowledged');
    await expect(panel(page, 'Response clock')).toContainText('Target met');

    // Work cannot start, or the record be closed, until somebody is assigned and the resolution is written.
    await step(page, 'Start work').click();
    await expect(toast(page)).toContainText('Assign a supervisor or team leader first');
    const assign = panel(page, 'Assign & resolve');
    await expect(assign.locator('.panel-head .tag')).toHaveText('Not assigned');
    await page.getByTestId('save-assign').click(); // the site's own area supervisor is suggested
    await expect(assign.locator('.panel-head .tag')).toHaveText('Thandeka Mokoena');
    await step(page, 'Start work').click();
    await expect(status(page)).toHaveText('In progress');
    await step(page, 'Mark resolved').click();
    await expect(toast(page)).toContainText('Record what was done');
    await page.getByLabel('Resolution').fill('Kitchen cleaned by 09:30; added to the first task of the shift.');
    await page.getByTestId('save-resolution').click();
    await step(page, 'Mark resolved').click();
    await expect(status(page)).toHaveText('Resolved');
    await expect(panel(page, 'Response clock')).toContainText('Same day');
    await step(page, 'Client confirmed (simulated)').click();
    await expect(status(page)).toHaveText('Client confirmed');
    expect(errors).toEqual([]);
  });

  test('stores: over-stock and hazardous issues are refused, a valid issue deducts stock, a purchase order is received', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/cleaning/stock');
    await signInAs(page, 'u_stores');
    const soapBefore = await cell(page, 'table-stock', 'Hand soap', 3);
    const paperBefore = await cell(page, 'table-stock', 'Toilet paper 2-ply', 3);

    await page.goto('#/cleaning/issues');
    const requested = column(page, 'Requested');
    await requested.locator('.board-card', { hasText: 'Bleach' }).getByRole('button', { name: 'Issue from store' }).click();
    await expect(toast(page)).toContainText('no cleaner based at Sedibeng Logistics Offices holds in-date chemical-handling training');
    await requested.locator('.board-card', { hasText: 'Toilet paper 2-ply' }).getByRole('button', { name: 'Issue from store' }).click();
    await expect(toast(page)).toContainText(`Only ${paperBefore} × Toilet paper 2-ply in store — 40 cannot be issued`);
    await requested.locator('.board-card', { hasText: 'Hand soap' }).getByRole('button', { name: 'Issue from store' }).click();
    await expect(anyToast(page, `4 × Hand soap issued to Umthombo Day Clinic — ${soapBefore - 4} left in store`)).toBeVisible();
    await expect(column(page, 'Issued')).toContainText('Hand soap → Umthombo Day Clinic');
    await expect(requested.locator('.board-card')).toHaveCount(2);

    // The refused request says how to fix it: the delivery on order is one click away.
    await requested.getByRole('link', { name: /Toilet paper 2-ply/ }).click();
    await expect(page.getByTestId('issue-checks')).toContainText('Blocked');
    await page.getByTestId('issue-fix').getByRole('link', { name: /Receive into store/ }).click();
    await expect(status(page)).toHaveText('Ordered');
    await step(page, 'Receive into store').click();
    await expect(anyToast(page, '60 × Toilet paper 2-ply added to stock')).toBeVisible();
    await expect(status(page)).toHaveText('Received');

    await page.goto('#/cleaning/issues/issues_2');
    await expect(panel(page, 'Issue checks').locator('.panel-head .tag')).toHaveText('Ready to issue');
    await step(page, 'Issue from store').click();
    await expect(status(page)).toHaveText('Issued');
    await step(page, 'Confirm received on site').click();
    await expect(status(page)).toHaveText('Received on site');

    await page.goto('#/cleaning/stock');
    expect(await cell(page, 'table-stock', 'Hand soap', 3)).toBe(soapBefore - 4);
    expect(await cell(page, 'table-stock', 'Toilet paper 2-ply', 3)).toBe(paperBefore + 60 - 40);
    expect(errors).toEqual([]);
  });

  test('quote: build → needs approval above the threshold → approved by operations → accept → schedule → complete → invoice issued and paid', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/cleaning/quotes');
    await signInAs(page, 'u_liaison');
    await page.getByTestId('new-record').click();
    await modal(page).getByLabel('Client (fictional)').fill('Greenside Lofts Body Corporate');
    await modal(page).getByLabel('Job type').selectOption('postconstruction');
    await modal(page).getByLabel('Estimated cost (internal)').fill('11000');
    await modal(page).getByRole('button', { name: 'Add line' }).click();
    await modal(page).getByLabel('Line 1 description').fill('Cleaning labour (hours)');
    await modal(page).getByLabel('Line 1 quantity').fill('120');
    await modal(page).getByLabel('Line 1 unit price').fill('150');
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText(/Quote \/ job QT-\d{4} created/);
    await expect(page.locator('.page-kicker').first()).toContainText(/QT-\d{4}/);
    const ref = (await page.locator('.page-kicker').first().textContent())!.match(/QT-\d{4}/)![0];
    await expect(panel(page, 'Value & margin')).toContainText('R18,000.00');
    await expect(panel(page, 'Value & margin').locator('.panel-head .tag')).toHaveText('Approval needed');

    // R18,000 is above the R15,000 threshold: the client liaison is refused, the operations manager is not.
    await step(page, 'Send quote (simulated)').click();
    await expect(toast(page)).toContainText('Approval needed: the value of R18,000.00 excl. VAT is above the R15,000.00 threshold');
    await expect(status(page)).toHaveText('Draft');
    await signInAs(page, 'u_ops');
    await step(page, 'Send quote (simulated)').click();
    await expect(status(page)).toHaveText('Sent');
    await expect(panel(page, 'Value & margin')).toContainText('Approved byDeon Fortuin');
    await step(page, 'Client accepted').click();
    await expect(status(page)).toHaveText('Accepted');

    // Scheduling needs a date and a team, set on the quote itself.
    await step(page, 'Schedule job').click();
    await expect(toast(page)).toContainText('Set the job date before scheduling');
    await page.getByTestId('job-date').fill(await today(page));
    await page.getByTestId('save-job').click();
    await step(page, 'Schedule job').click();
    await expect(toast(page)).toContainText('Set the team size');
    await page.getByTestId('job-team-size').fill('6');
    await page.getByTestId('save-job').click();
    await step(page, 'Schedule job').click();
    await expect(status(page)).toHaveText('Scheduled');
    await step(page, 'Job completed').click();
    await expect(status(page)).toHaveText('Completed');

    // Invoicing belongs to accounts: operations is told who can, accounts raises, issues and settles it.
    await expect(panel(page, 'Job')).toContainText('switch to the accounts clerk');
    await expect(step(page, 'Raise invoice')).toBeDisabled();
    await signInAs(page, 'u_acc');
    await step(page, 'Raise invoice').click();
    await expect(anyToast(page, new RegExp(`Draft invoice INV-\\d{4} raised from ${ref}`))).toBeVisible();
    await expect(status(page)).toHaveText('Invoiced');
    await panel(page, 'Job').getByRole('link', { name: /^INV-\d{4}$/ }).click();
    await expect(page.getByTestId('lines-table')).toContainText('R20,700.00'); // R18,000 + 15% VAT
    await step(page, 'Issue invoice (simulated)').click();
    await expect(status(page)).toHaveText('Issued');
    await step(page, 'Record payment').click();
    await expect(status(page)).toHaveText('Paid');
    expect(errors).toEqual([]);
  });

  test('month end: contract invoices are drafted once per site, issued and paid', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/cleaning/invoices');
    await signInAs(page, 'u_acc');
    await expect(page.getByTestId('draft-invoices')).toHaveText('Draft contract invoices (16)');
    await page.getByTestId('draft-invoices').click();
    await expect(toast(page)).toContainText('16 draft contract invoices created');
    await expect(page.getByTestId('draft-invoices')).toBeDisabled(); // a second run would double-bill
    await expect(page.getByLabel('Filter by status')).toContainText('Draft (16)');

    // One draft shows how the amount is made up; a staffing credit, if any, comes off before VAT.
    await page.getByLabel('Filter by status').selectOption('draft');
    await page.getByTestId('table-invoices').locator('tbody tr', { hasText: 'Acacia Junction Mall' }).first().click();
    await expect(page.getByTestId('lines-table')).toContainText('Contract cleaning — Acacia Junction Mall');
    await expect(panel(page, 'Invoice')).toContainText('not a tax invoice');
    await step(page, 'Issue invoice (simulated)').click();
    await expect(status(page)).toHaveText('Issued');
    await step(page, 'Record payment').click();
    await expect(status(page)).toHaveText('Paid');
    await expect(panel(page, 'Summary')).not.toContainText('Paid on—');

    // The rest go out in one step.
    await page.goto('#/cleaning/invoices');
    await page.getByTestId('issue-drafts').click();
    await expect(toast(page)).toContainText('15 invoices issued');
    await expect(page.getByLabel('Filter by status')).toContainText('Draft (0)');
    expect(errors).toEqual([]);
  });

  test('periodic task: start → done → next due date set; working at heights is checked', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/cleaning/periodic/periodic_1');
    await signInAs(page, 'u_sup');
    await expect(status(page)).toHaveText('Planned');
    await expect(panel(page, 'Details')).toContainText('Overdue');
    await step(page, 'Start task').click();
    await expect(status(page)).toHaveText('In progress');
    await step(page, 'Mark done').click();
    await expect(anyToast(page, /Ablution deep clean done — next due/)).toBeVisible();
    await expect(status(page)).toHaveText('Done — awaiting sign-off');
    // Weekly task: last done today, next due in seven days, no longer overdue.
    const d = new Date(`${await today(page)}T12:00:00`);
    d.setDate(d.getDate() + 7);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await page.getByTestId('edit-record').click();
    await expect(modal(page).getByLabel('Next due')).toHaveValue(next);
    await expect(modal(page).getByLabel('Last done')).toHaveValue(await today(page));
    await modal(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(panel(page, 'Details')).not.toContainText('Overdue');
    // Client sign-off is somebody else's step, and the refusal says whose.
    await expect(workflow(page)).toContainText(/Client sign-off.*Karen van Niekerk/);

    // The Block A window clean is above ground level and its team leader's training has lapsed.
    await page.goto('#/cleaning/periodic/periodic_5');
    await step(page, 'Start task').click();
    await expect(toast(page)).toContainText('does not hold in-date working-at-heights training');
    await expect(status(page)).toHaveText('Planned');
    expect(errors).toEqual([]);
  });

  test('guide: all six steps open the right screen as the right person and work on a fresh seed', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number) => { await page.goto('#/cleaning'); await page.getByTestId(`guide-step-${n}`).click(); };

    await open(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daily schedule & attendance');
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_sup');
    await page.getByTestId('shift-card-shifts_3').getByRole('button', { name: /^Clock in / }).first().click();
    await expect(page.getByTestId('shift-card-shifts_3')).toContainText('1/3 present');

    await open(2);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Umthombo Day Clinic');
    await expect(page.getByTestId('relief-picker')).toContainText('1 of 7 can cover this shift');
    await page.getByTestId('relief-picker').getByRole('button', { name: /^Assign / }).click();
    await page.getByTestId('roster-table').getByRole('button', { name: /^Clock in / }).click();
    for (const box of await panel(page, 'Daily checklist').getByRole('checkbox').all()) await box.check();
    await step(page, 'Complete shift').click();
    await expect(status(page)).toHaveText('Completed');

    await open(3);
    await step(page, 'Submit inspection').click();
    await expect(toast(page)).toContainText('record a corrective action before submitting');
    await page.getByLabel('Corrective action', { exact: true }).fill('Restock hourly; supervisor to check at 10:00 and 13:00.');
    await page.getByLabel('Corrective action due').fill(await today(page));
    await page.getByTestId('save-corrective').click();
    await step(page, 'Submit inspection').click();
    await expect(anyToast(page, /re-inspection QI-\d{4} scheduled/)).toBeVisible();

    await open(4);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_stores');
    await expect(column(page, 'Requested').locator('.board-card')).toHaveCount(3);
    await column(page, 'Requested').locator('.board-card', { hasText: 'Hand soap' }).getByRole('button', { name: 'Issue from store' }).click();
    await expect(anyToast(page, /4 × Hand soap issued/)).toBeVisible();

    await open(5);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_liaison');
    await step(page, 'Send quote (simulated)').click();
    await expect(toast(page)).toContainText('Approval needed');
    await signInAs(page, 'u_ops');
    await step(page, 'Send quote (simulated)').click();
    await expect(status(page)).toHaveText('Sent');

    await open(6);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_acc');
    await page.getByTestId('draft-invoices').click();
    await expect(toast(page)).toContainText('16 draft contract invoices created');
    expect(errors).toEqual([]);
  });

  test('roles: every simulated user lands on a useful dashboard, sees their own menu and is told what they cannot do', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/cleaning');
    const nav = page.getByLabel('Main navigation');
    const menus: Record<string, { has: string[]; hasNot: string[] }> = {
      u_md: { has: ['Daily schedule & attendance', 'Invoicing', 'Purchase orders', 'Staff'], hasNot: [] },
      u_ops: { has: ['Daily schedule & attendance', 'Once-off jobs & quotes', 'Staff'], hasNot: ['Invoicing', 'Purchase orders'] },
      u_sup: { has: ['Daily schedule & attendance', 'Quality inspections', 'Issues to sites'], hasNot: ['Invoicing', 'Once-off jobs & quotes', 'Purchase orders'] },
      u_stores: { has: ['Consumables & chemicals', 'Issues to sites', 'Purchase orders'], hasNot: ['Daily schedule & attendance', 'Invoicing', 'Staff'] },
      u_acc: { has: ['Invoicing', 'Once-off jobs & quotes', 'Reports'], hasNot: ['Daily schedule & attendance', 'Issues to sites', 'Staff'] },
      u_liaison: { has: ['Complaints & requests', 'Once-off jobs & quotes', 'Quality inspections'], hasNot: ['Daily schedule & attendance', 'Invoicing', 'Staff'] },
    };
    for (const [id, menu] of Object.entries(menus)) {
      await page.goto('#/cleaning');
      await signInAs(page, id);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');
      await expect(page.getByTestId('today-list').locator('li')).toHaveCount(16);
      await expect(page.locator('.dash-hero a')).toHaveCount(1); // a way into their own work
      for (const label of menu.has) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
      for (const label of menu.hasNot) await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }

    // The stores clerk has no schedule; the accounts clerk can read a quote but not send it, and is told who can.
    await signInAs(page, 'u_stores');
    await page.goto('#/cleaning/schedule');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await signInAs(page, 'u_acc');
    await page.goto('#/cleaning/quotes/quotes_1');
    await expect(step(page, 'Send quote (simulated)')).toBeDisabled();
    await expect(workflow(page)).toContainText(/Quotes & jobs.*Karen van Niekerk/);
    // The client liaison follows inspections but cannot edit scores; HR notes stay with operations.
    await signInAs(page, 'u_liaison');
    await page.goto('#/cleaning/inspections/inspections_1');
    await expect(page.getByRole('group', { name: 'Ablutions score' })).toHaveCount(0);
    await expect(step(page, 'Submit inspection')).toBeDisabled();
    await signInAs(page, 'u_sup');
    await page.goto('#/cleaning/staff/staff_6');
    await expect(panel(page, 'Details')).toContainText('hidden for your simulated role');
    expect(errors).toEqual([]);
  });

  test('mobile: dashboard, today’s board and a shift are usable with no sideways page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/cleaning', '#/cleaning/schedule', '#/cleaning/schedule/shifts_1', '#/cleaning/inspections/inspections_1', '#/cleaning/issues', '#/cleaning/quotes/quotes_6', '#/cleaning/invoices']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
    // Attendance works with a thumb: the clock-in button and the relief reasons are on screen, not in a scrolled table.
    await page.goto('#/cleaning/schedule/shifts_3');
    const clockIn = page.getByRole('button', { name: 'Clock in Sizwe Gumede' });
    await clockIn.scrollIntoViewIfNeeded();
    const box = (await clockIn.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await clockIn.click();
    await expect(panel(page, 'Roster & attendance').locator('.panel-head .tag')).toHaveText('1/3 present');
  });

  test('honesty: the business name follows branding and nothing claims to send, sign or comply', async ({ page }) => {
    await page.goto('#/cleaning/settings');
    await expect(page.locator('main')).toContainText('No time-and-attendance hardware');
    await expect(page.locator('main')).toContainText('no email or SMS is sent');
    await page.goto('#/cleaning/complaints/complaints_1');
    await expect(page.getByTestId('ack-preview')).toContainText('BrightPath Cleaning Services has logged your complaint');
    await expect(panel(page, 'Acknowledgement to the client')).toContainText('Preview only — no message is sent');
    await page.goto('#/cleaning/schedule/shifts_1');
    await expect(panel(page, 'Staffing')).toContainText('no clocking hardware or GPS behind this demo');
  });
});
