import { expect, test, type Locator, type Page } from '@playwright/test';

// Marula Ridge Academy: the journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage). The guided records (applications_1, leave_1,
// assessments_1 and _2, reports_1 and _2, payments_1–3) keep their ids on every weekday, today always
// has school, and nothing is matched against the date or the time of day.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const anyToast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text });
const panel = (page: Page, title: string | RegExp) => page.locator('.panel', { has: page.getByRole('heading', { name: title, exact: typeof title === 'string' }) });
const workflow = (page: Page) => panel(page, 'Workflow');
const status = (page: Page) => workflow(page).locator('.panel-head .tag');
const step = (page: Page, name: string) => workflow(page).getByRole('button', { name, exact: true });
const modal = (page: Page) => page.locator('.modal');
const feedback = (scope: Page | Locator) => scope.getByTestId('feedback');
const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

// Optional: E2E_FAKE_NOW=2026-11-14T06:10:00 runs the journeys on another day (a Saturday) or time of day.
const FAKE_NOW = process.env.E2E_FAKE_NOW;

test.describe('School management journeys', () => {
  test.beforeEach(async ({ page }) => {
    if (FAKE_NOW) await page.clock.install({ time: new Date(FAKE_NOW) });
  });

  test('guide: the six walkthrough steps open the right screen as the right person', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number) => { await page.goto('#/education'); await page.getByTestId(`guide-step-${n}`).click(); };
    await page.goto('#/education');
    await expect(page.getByTestId('guide')).toContainText('Try these 6 things');

    await open(1);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_teacher');
    await expect(h1(page)).toHaveText('Daily attendance');
    await expect(panel(page, 'Grade 4 register')).toContainText('0/12 marked');
    await expect(page.getByTestId('mark-all-present')).toBeEnabled();
    await expect(page.getByTestId('register-list')).toContainText('absent the last 2 school days');

    await open(2);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_secretary');
    await expect(h1(page)).toHaveText('Lulama Mkhize');
    await expect(status(page)).toHaveText('New application');
    await expect(workflow(page)).toContainText('Still outstanding: immunisation card');

    await open(3);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_deputy');
    await expect(h1(page)).toContainText('Sipho Ndlovu');
    await expect(status(page)).toHaveText('Cover needed');
    await expect(page.getByTestId('cover-picker')).toContainText('Not eligible');
    await expect(page.getByTestId('auto-cover')).toBeVisible();

    await open(4);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_teacher');
    await expect(h1(page)).toHaveText('English — Term test');
    await expect(status(page)).toHaveText('Draft — capturing');
    await expect(panel(page, 'Mark grid')).toContainText('2 not marked');

    await open(5);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_principal');
    await expect(status(page)).toHaveText('Teacher commented');
    await expect(panel(page, 'Before sign-off')).toContainText('Ready for sign-off');
    await expect(step(page, 'Principal sign-off')).toBeEnabled();
    await expect(page.getByTestId('watermark')).toHaveText('DEMONSTRATION');

    await open(6);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_bursar');
    await expect(h1(page)).toHaveText('Fees & accounts');
    await expect(page.getByTestId('raise-invoices')).toBeEnabled();
    await expect(page.getByTestId('ageing').locator('tbody tr').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('daily attendance: mark a class in one tap each → an absence needs a reason → submit locks the register', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/education/attendance');
    await signInAs(page, 'u_teacher');
    const sheet = panel(page, 'Grade 4 register');
    await expect(sheet).toContainText('0/12 marked');

    // Nothing marked, then only some: both refused with the reason on the screen.
    await page.getByTestId('submit-register').click();
    await expect(feedback(sheet)).toContainText('No learner is marked yet');
    const rows = page.getByTestId('register-list').locator('li');
    await rows.first().getByRole('button', { name: 'Late' }).click();
    await expect(sheet).toContainText('1/12 marked');
    await page.getByTestId('submit-register').click();
    await expect(feedback(sheet)).toContainText('11 learners are not marked yet');

    await page.getByTestId('mark-all-present').click();
    await expect(sheet).toContainText('12/12 marked');
    // The learner who was away the last two days is absent again: flagged as three in a row.
    const away = rows.filter({ hasText: 'absent the last 2 school days' });
    await expect(away).toHaveCount(1);
    await away.getByRole('button', { name: 'Absent' }).click();
    await expect(away).toContainText('Absent 3 school days in a row');
    await page.getByTestId('submit-register').click();
    await expect(feedback(sheet)).toContainText('Choose a reason for each absence');
    await away.getByRole('combobox').selectOption('unexplained');

    // The message a parent would get is previewed, never sent.
    const preview = page.getByTestId('absence-preview');
    await expect(preview).toContainText('was marked absent from Grade 4');
    await expect(preview).toContainText('No reason has been given yet');
    await expect(preview).toContainText('Marula Ridge Academy');
    await expect(panel(page, 'Absence message to the parent')).toContainText('Preview only — no message is sent');

    await page.getByTestId('submit-register').click();
    await expect(anyToast(page, 'Grade 4 register submitted — 11 present, 1 absent')).toBeVisible();
    await expect(sheet.locator('.panel-head .tag')).toHaveText('Submitted · locked');
    await expect(sheet).toContainText('Submitted by Zanele Khumalo and locked');
    await expect(page.getByTestId('submit-register')).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Absent' })).toHaveCount(0);
    await expect(page.getByTestId('register-status').locator('li', { hasText: 'Grade 4' })).toContainText('Submitted');

    // A future date cannot be taken; a past one is there, locked.
    const iso = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    await page.getByLabel('Register date').fill(iso);
    await expect(sheet).toContainText('This date is still to come');
    await expect(page.getByTestId('submit-register')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to today' }).click();
    await page.reload();
    await expect(panel(page, 'Grade 4 register').locator('.panel-head .tag')).toHaveText('Submitted · locked');

    // The dashboard now has one register fewer outstanding and a third chronic-absence alert.
    await page.goto('#/education');
    await expect(page.locator('.dash-hero')).toContainText('9 of 14 registers in');
    await expect(page.getByTestId('attention-list')).toContainText('absent 3 school days in a row');
    expect(errors).toEqual([]);
  });

  test('admissions: application → documents → assessment → offer → deposit → enrolled learner with a class place and a fee account', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/education/admissions/applications_1');
    await signInAs(page, 'u_secretary');
    await expect(status(page)).toHaveText('New application');
    await expect(panel(page, 'Places in Grade 2')).toContainText('11 enrolled of 12 places');

    await step(page, 'Documents received').click();
    await expect(anyToast(page, 'Still outstanding: immunisation card')).toBeVisible();
    await page.getByTestId('documents').getByLabel('Immunisation card').check();
    await expect(panel(page, 'Documents')).toContainText('3/3 received');
    await step(page, 'Documents received').click();
    await expect(status(page)).toHaveText('Documents received');

    // The assessment has its own form; saving it moves the application on.
    await page.getByTestId('record-assessment').click();
    await expect(feedback(page)).toContainText('Choose the outcome of the assessment');
    await page.getByLabel('Assessment outcome').selectOption('ready');
    await page.getByLabel('Assessment note').fill('Reads at grade level; settled quickly with the class.');
    await page.getByTestId('record-assessment').click();
    await expect(status(page)).toHaveText('Assessed');

    await step(page, 'Make offer').click();
    await expect(anyToast(page, 'Offer made — a place is held in Grade 2')).toBeVisible();
    await expect(status(page)).toHaveText('Offer made');
    await expect(panel(page, 'Places in Grade 2')).toContainText('Full');

    // Accepting needs the deposit, recorded right here.
    await step(page, 'Accept offer & enrol').click();
    await expect(anyToast(page, 'Record the enrolment deposit of R2,500.00 first')).toBeVisible();
    await expect(page.getByLabel('Deposit amount')).toHaveValue('2500');
    await page.getByLabel('Deposit method').selectOption('card');
    await page.getByTestId('record-deposit').click();
    await expect(panel(page, 'Enrolment deposit').locator('.panel-head .tag')).toHaveText('Deposit in');
    await step(page, 'Accept offer & enrol').click();
    await expect(anyToast(page, /Lulama Mkhize enrolled in Grade 2 \(LR-0151\) — fee account FA-0096 opened/)).toBeVisible();
    await expect(status(page)).toHaveText('Enrolled');

    // The learner, the class place and the fee account all exist.
    await page.getByTestId('enrolled-links').getByRole('link', { name: /Lulama Mkhize/ }).click();
    await expect(h1(page)).toHaveText('Lulama Mkhize');
    await expect(page.locator('.subtitle')).toContainText('Grade 2 · Mkhize family');
    await expect(panel(page, 'Fee account')).toContainText('only shown to the bursar’s office');
    await page.goto('#/education/classes');
    await page.getByTestId('table-classes').locator('tr', { hasText: 'Grade 2' }).click();
    await expect(page.getByTestId('class-list')).toContainText('Lulama Mkhize');
    await expect(page.getByTestId('class-list').locator('tbody tr')).toHaveCount(12);

    await signInAs(page, 'u_bursar');
    await page.goto('#/education/fees');
    await page.getByLabel('Search Fee accounts').fill('Mkhize');
    await page.getByTestId('table-accounts').locator('tbody tr').first().click();
    await expect(h1(page)).toHaveText('Mkhize family account');
    await expect(page.getByTestId('balance')).toHaveText('-R2,500.00');
    await expect(page.getByTestId('statement')).toContainText('Enrolment deposit — Card');
    await expect(page.getByTestId('family-fees')).toContainText('Lulama Mkhize');
    await expect(page.getByTestId('family-fees')).toContainText('R3,900.00');
    expect(errors).toEqual([]);
  });

  test('admissions: a full grade refuses the offer and leads to the waiting list; a new application can be captured', async ({ page }) => {
    await page.goto('#/education/admissions/applications_2');
    await signInAs(page, 'u_secretary');
    await expect(status(page)).toHaveText('Assessed');
    await expect(workflow(page)).toContainText('Grade 4 is full: 12 enrolled out of 12 places');
    await step(page, 'Make offer').click();
    await expect(anyToast(page, 'Grade 4 is full')).toBeVisible();
    await step(page, 'Add to waiting list').click();
    await expect(status(page)).toHaveText('Waiting list');
    await expect(page.getByTestId('waitlist').locator('li')).toHaveCount(3);
    await expect(panel(page, 'Places in Grade 4')).toContainText('Position #3 on the waiting list');

    // New application from the board.
    await page.goto('#/education/admissions');
    await expect(page.getByTestId('board-applications')).toBeVisible();
    await page.getByTestId('new-record').click();
    await modal(page).getByLabel('Child’s first name').fill('Testa');
    await modal(page).getByLabel('Surname').fill('Demo');
    await modal(page).getByLabel('Date of birth').fill('2019-03-04');
    await modal(page).getByLabel('Parent / guardian').fill('Parent Demo');
    await page.getByTestId('save-record').click();
    await expect(modal(page)).toContainText('Phone (fictional) is required');
    await modal(page).getByLabel('Phone (fictional)').fill('082 555 0100');
    await page.getByTestId('save-record').click();
    await expect(h1(page)).toHaveText('Testa Demo');
    await expect(status(page)).toHaveText('New application');
    await expect(workflow(page)).toContainText('Still outstanding: birth certificate, previous school report, immunisation card');
  });

  test('marks: capture (no gaps, nothing above the total) → moderated by a second person → published; weightings must reach 100%', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/education/assessments/assessments_1');
    await signInAs(page, 'u_teacher');
    await expect(status(page)).toHaveText('Draft — capturing');
    await step(page, 'Submit marks for moderation').click();
    await expect(anyToast(page, '2 learners have no mark')).toBeVisible();

    // The two learners without a mark: one gets a mark above the total (refused), the other is absent.
    const grid = page.getByTestId('mark-grid');
    const refs = await grid.locator('tbody tr').evaluateAll((rows) => rows.filter((r) => (r.querySelector('input[type="number"]') as HTMLInputElement).value === '').map((r) => r.getAttribute('data-testid')!));
    expect(refs).toHaveLength(2);
    const [one, two] = refs.map((ref) => page.getByTestId(ref));
    await one.getByRole('spinbutton').fill('60');
    await expect(one).toContainText('Not a mark out of 50');
    await step(page, 'Submit marks for moderation').click();
    await expect(anyToast(page, /60 is not a mark out of 50\. Marks cannot exceed the total/)).toBeVisible();
    await one.getByRole('spinbutton').fill('41');
    await expect(one).toContainText('82%');
    await two.getByRole('checkbox').check();
    await expect(panel(page, 'Mark grid').locator('.panel-head .tag')).toHaveText('All marked');
    await step(page, 'Submit marks for moderation').click();
    await expect(status(page)).toHaveText('Captured — to moderate');
    await expect(panel(page, 'Results so far')).toContainText('Captured byZanele Khumalo');

    // The capturer cannot moderate her own marks; the deputy can, and publishes.
    await step(page, 'Moderate marks').click();
    await expect(anyToast(page, /moderated by someone other than the person who captured them \(Zanele Khumalo\)/)).toBeVisible();
    await expect(step(page, 'Publish marks')).toHaveCount(0);
    await signInAs(page, 'u_deputy');
    await step(page, 'Moderate marks').click();
    await expect(status(page)).toHaveText('Moderated');
    await step(page, 'Publish marks').click();
    await expect(anyToast(page, 'English marks published')).toBeVisible();
    await expect(status(page)).toHaveText('Published');

    // Mathematics: the term's weightings add up to 90%, so the last task cannot be published until that is fixed here.
    await page.goto('#/education/assessments/assessments_2');
    await expect(panel(page, 'Weighting').locator('.panel-head .tag')).toHaveText('Adds up to 90% — must be 100%');
    await step(page, 'Publish marks').click();
    await expect(anyToast(page, /add up to 90%, not 100%/)).toBeVisible();
    await page.getByLabel('Weighting (%)').fill('50');
    await page.getByTestId('save-weight').click();
    await expect(panel(page, 'Weighting').locator('.panel-head .tag')).toHaveText('Adds up to 100%');
    await step(page, 'Publish marks').click();
    await expect(status(page)).toHaveText('Published');

    // With both Grade 4 tasks published, the report card that was held up can be signed.
    await signInAs(page, 'u_principal');
    await page.goto('#/education/reportcards/reports_2');
    await expect(panel(page, 'Before sign-off')).toContainText('Ready for sign-off');
    await step(page, 'Principal sign-off').click();
    await expect(status(page)).toHaveText('Principal signed');
    await page.goto('#/education/assessments');
    await expect(page.getByTestId('moderation-queue').locator('li')).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  test('report cards: comment → sign-off (refused while marks are unpublished) → release, with the watermarked sheet', async ({ page }) => {
    const errors = watchErrors(page);
    // A draft needs the class teacher's comment.
    await page.goto('#/education/reportcards/reports_16');
    await signInAs(page, 'u_teacher');
    await expect(status(page)).toHaveText('Draft');
    await page.getByTestId('submit-comment').click();
    await expect(anyToast(page, 'Write the class teacher’s comment first')).toBeVisible();
    await page.getByLabel('Teacher comment').fill('A cheerful, hard-working term. Keep practising the times tables.');
    await page.getByTestId('submit-comment').click();
    await expect(status(page)).toHaveText('Teacher commented');
    // The teacher cannot sign; the screen says who can.
    await expect(step(page, 'Principal sign-off')).toBeDisabled();
    await expect(workflow(page)).toContainText(/Sign off reports.*Dr Nomvula Mokoena/);

    // Unpublished marks hold a report up, with links to the tasks.
    await signInAs(page, 'u_principal');
    await page.goto('#/education/reportcards/reports_2');
    await expect(page.getByTestId('sign-checklist')).toContainText('English — Term test is not published yet');
    await step(page, 'Principal sign-off').click();
    await expect(anyToast(page, /Cannot sign yet — 2 subject marks are not final/)).toBeVisible();
    await page.getByTestId('sign-checklist').getByRole('link', { name: 'Mathematics — Term test is not published yet' }).click();
    await expect(h1(page)).toHaveText('Mathematics — Term test');

    // A ready report: sign (figures freeze), then release (logged, never sent).
    await page.goto('#/education/reportcards/reports_1');
    const sheet = page.getByTestId('report-sheet');
    await expect(page.getByTestId('report-results').locator('tbody tr')).toHaveCount(5);
    await expect(sheet).toContainText('Marula Ridge Academy');
    await expect(sheet).toContainText(/Present \d+ of \d+ school days/);
    await expect(sheet).toContainText('Not signed yet');
    await expect(step(page, 'Release to parents (simulated)')).toHaveCount(0);
    await step(page, 'Principal sign-off').click();
    await expect(status(page)).toHaveText('Principal signed');
    await expect(sheet).toContainText('Dr Nomvula Mokoena · signed');
    await expect(panel(page, 'Sign-off').locator('.panel-head .tag')).toHaveText('Figures frozen');
    await expect(page.getByTestId('release-preview')).toContainText('report card is ready');
    await step(page, 'Release to parents (simulated)').click();
    await expect(anyToast(page, /report card released — logged only, nothing was sent/)).toBeVisible();
    await expect(status(page)).toHaveText('Released to parents');
    await expect(page.getByTestId('watermark')).toHaveText('DEMONSTRATION');
    await expect(page.getByTestId('print-report')).toBeVisible();

    // The class run signs and releases the rest of Grade 7 in two clicks, and generates another class's drafts.
    await page.goto('#/education/reportcards');
    await page.getByLabel('Class for the report run').selectOption({ label: 'Grade 7' });
    await expect(page.getByTestId('sign-ready')).toHaveText('Sign the 10 that are ready');
    await page.getByTestId('sign-ready').click();
    await expect(anyToast(page, '10 report cards signed')).toBeVisible();
    await page.getByTestId('release-signed').click();
    await expect(page.getByTestId('run-summary')).toContainText('11 released');
    await page.getByLabel('Class for the report run').selectOption({ label: 'Grade 4' });
    await expect(page.getByTestId('run-blocked')).toContainText('cannot be signed yet because marks are not published');
    await page.getByLabel('Class for the report run').selectOption({ label: 'Grade 5' });
    await page.getByTestId('generate-reports').click();
    await expect(anyToast(page, '11 draft report cards generated for Grade 5')).toBeVisible();
    await expect(page.getByTestId('generate-reports')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('fees: raise the month’s invoices → record a payment (not above the balance) → allocate bank deposits → approve an arrangement', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/education/payments');
    await signInAs(page, 'u_bursar');
    await expect(page.getByTestId('table-payments').locator('tbody tr')).toHaveCount(3);
    // A bank deposit for more than the family owes: split off the surplus, then allocate.
    await page.goto('#/education/payments/payments_2');
    await expect(status(page)).toHaveText('To allocate');
    await step(page, 'Allocate to account').click();
    await expect(anyToast(page, /A payment cannot exceed the balance/)).toBeVisible();
    await page.getByTestId('split-payment').click();
    await expect(feedback(page)).toContainText('is held as PY-0004');
    await step(page, 'Allocate to account').click();
    await expect(status(page)).toHaveText('Allocated');

    // A deposit with no account: find the family by the bank reference.
    await page.goto('#/education/payments/payments_3');
    await expect(workflow(page)).toContainText('Choose the family account');
    const hint = (await panel(page, 'Allocate to').locator('.field-hint').textContent())!;
    const surname = /“(.+) ARREARS”/.exec(hint)![1];
    await page.getByLabel('Find a family').fill(surname);
    const options = page.getByLabel('Allocate to account').locator('option');
    const target = await options.evaluateAll((els, name) => (els as HTMLOptionElement[]).filter((o) => o.value && o.textContent!.toLowerCase().includes(name.toLowerCase()) && !o.textContent!.includes('owes R0.00')).sort((a, b) => Number(b.textContent!.split('owes R')[1].replace(/,/g, '')) - Number(a.textContent!.split('owes R')[1].replace(/,/g, '')))[0].value, surname);
    await page.getByLabel('Allocate to account').selectOption(target);
    await expect(panel(page, 'Allocate to').locator('.panel-head .tag')).toHaveText('Ready to allocate');
    await step(page, 'Allocate to account').click();
    await expect(status(page)).toHaveText('Allocated');

    await page.goto('#/education/fees');
    // Every family on the 12-month plan is billed each month; the 10-month plan skips December and January.
    await expect(page.getByTestId('raise-invoices')).toHaveText(/Raise \w+ \d{4} invoices \(\d+\)/);
    const billed = Number(/\((\d+)\)/.exec((await page.getByTestId('raise-invoices').textContent())!)![1]);
    expect(billed).toBeGreaterThanOrEqual(60);
    expect(billed).toBeLessThanOrEqual(95);
    await page.getByTestId('raise-invoices').click();
    await expect(anyToast(page, new RegExp(`${billed} invoices raised for \\w+ \\d{4} — R[\\d,]+\\.\\d\\d billed`))).toBeVisible();
    await expect(page.getByTestId('raise-invoices')).toBeDisabled();
    await expect(page.getByTestId('invoice-runs').locator('li').first()).toContainText(`${billed} accounts`);

    // The account most in arrears: a payment above the balance is refused, a real one lands on the statement.
    await page.getByTestId('ageing').locator('tbody tr').first().getByRole('link').click();
    await expect(h1(page)).toContainText('family account');
    const owing = await page.getByTestId('balance').textContent();
    await page.getByLabel('Payment amount').fill('999999');
    await page.getByTestId('record-payment').click();
    await expect(feedback(panel(page, 'Record a payment'))).toContainText('A payment cannot exceed the balance');
    await page.getByLabel('Payment amount').fill('1500');
    await page.getByLabel('Payment method').selectOption('cash');
    await page.getByLabel('Payment reference').fill('Receipt DEMO-0042');
    await page.getByTestId('record-payment').click();
    await expect(anyToast(page, 'R1,500.00 recorded (PY-0005)')).toBeVisible();
    await expect(page.getByTestId('statement')).toContainText('Payment — Cash (PY-0005)');
    await expect(page.getByTestId('balance')).not.toHaveText(owing!);
    await expect(page.getByTestId('statement').locator('tbody tr').last()).toContainText('Payment — Cash');

    // The proposed payment arrangement is approved on the family's account.
    await page.goto('#/education/fees');
    await page.getByTestId('arrangements').locator('li').filter({ has: page.locator('.tag', { hasText: /^Proposed$/ }) }).getByRole('link').click();
    const arrangement = page.getByTestId('arrangement');
    await arrangement.getByRole('button', { name: 'Approve arrangement' }).click();
    await expect(panel(page, 'Payment arrangement').locator('.panel-head .tag')).toHaveText('Approved by bursar');
    await arrangement.getByRole('button', { name: 'Parent accepted — start' }).click();
    await expect(panel(page, 'Payment arrangement').locator('.panel-head .tag')).toHaveText('Active');
    expect(errors).toEqual([]);
  });

  test('substitute cover: every candidate is eligible or not with a reason → assign → fill the rest; a timetable clash is refused', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/education/cover/leave_1');
    await signInAs(page, 'u_deputy');
    await expect(status(page)).toHaveText('Cover needed');
    await expect(workflow(page)).toContainText('No substitute yet for period');
    const picker = page.getByTestId('cover-picker');
    await expect(picker).toContainText(/\d+ of 17 teaching staff are free in period \d/);
    await expect(picker).toContainText(/is teaching [\w &]+ to Grade \w+ in period \d/);
    await expect(picker).toContainText('Refilwe is absent that day (training / workshop)');
    await expect(picker.locator('li', { hasText: 'Not eligible' }).first()).toBeVisible();
    const periods = page.getByTestId('cover-periods').locator(':scope > li');
    const total = await periods.count();
    expect(total).toBeGreaterThanOrEqual(4);

    // Assign the first eligible teacher to the first period, then let the rest be filled with free teachers.
    await picker.getByRole('button', { name: /^Assign / }).first().click();
    await expect(periods.first()).toContainText('Covered by');
    await expect(panel(page, 'Absence').locator('.panel-head .tag')).toHaveText(`1/${total} covered`);
    await page.getByTestId('auto-cover').click();
    await expect(status(page)).toHaveText('Covered');
    await expect(anyToast(page, new RegExp(`all ${total} periods covered`))).toBeVisible();
    await expect(page.getByTestId('cover-periods').locator(':scope > li', { hasText: 'Needs cover' })).toHaveCount(0);
    await step(page, 'Reopen cover').click();
    await expect(status(page)).toHaveText('Cover needed');
    await periods.first().getByRole('button', { name: /^Remove/ }).click();
    await expect(periods.first()).toContainText('No substitute yet');

    // Timetable: a teacher who is in another class that period is refused; a free one is accepted.
    await page.goto('#/education/timetable');
    await page.getByLabel('Class', { exact: true }).selectOption({ label: 'Grade 5' });
    await expect(page.locator('.toolbar')).toContainText('No teacher is double-booked');
    await page.getByTestId('slot-2').click();
    const busy = await modal(page).getByLabel('Lesson teacher').locator('option', { hasText: 'teaching another class' }).first().getAttribute('value');
    await modal(page).getByLabel('Lesson teacher').selectOption(busy!);
    await page.getByTestId('save-lesson').click();
    await expect(page.getByTestId('lesson-error')).toContainText('a teacher cannot be in two classes in the same period');
    await modal(page).getByLabel('Lesson subject').selectOption('LOR');
    await modal(page).getByLabel('Lesson teacher').selectOption({ label: 'Refilwe Tau' });
    await page.getByTestId('save-lesson').click();
    await expect(anyToast(page, /Grade 5 · Mon period 3 saved/)).toBeVisible();
    await expect(page.getByTestId('slot-2')).toContainText('Refilwe Tau');
    await page.getByRole('button', { name: 'By teacher' }).click();
    await page.getByLabel('Teacher', { exact: true }).selectOption({ label: 'Refilwe Tau · Learning support' });
    await expect(panel(page, /Refilwe Tau — week/)).toContainText('1 lessons a week');

    // The secretary records an absence from the staff record and is told who arranges the cover.
    await signInAs(page, 'u_secretary');
    await page.goto('#/education/staff');
    await page.getByTestId('table-staff').locator('tr', { hasText: 'Megan Abrahams' }).click();
    await page.getByTestId('record-absence').click();
    await expect(anyToast(page, /Megan Abrahams marked absent today — \d periods need a substitute/)).toBeVisible();
    await expect(status(page)).toHaveText('Cover needed');
    await expect(page.getByTestId('who-can')).toContainText(/Timetable & cover.*Pieter van der Merwe/);
    await expect(page.getByTestId('auto-cover')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('discipline and notices: parent contact before an outcome, serious incidents for the deputy, notices approved then logged as sent', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/education/discipline/discipline_2');
    await signInAs(page, 'u_teacher');
    await expect(status(page)).toHaveText('Logged');
    await step(page, 'Resolve').click();
    await expect(anyToast(page, 'Contact the parent before resolving an incident')).toBeVisible();
    await page.getByLabel('Parent contact note').fill('Phoned the father at 14:10; the phone stays at home from tomorrow.');
    await page.getByTestId('save-contact').click();
    await expect(status(page)).toHaveText('Parent contacted');
    await step(page, 'Resolve').click();
    await expect(anyToast(page, 'Record the outcome first')).toBeVisible();
    await page.getByLabel('Outcome', { exact: true }).fill('Verbal warning; phone returned at home time.');
    await page.getByTestId('save-outcome').click();
    await step(page, 'Resolve').click();
    await expect(status(page)).toHaveText('Resolved');

    // A serious incident is not the teacher's to resolve.
    await page.goto('#/education/discipline/discipline_1');
    await step(page, 'Resolve').click();
    await expect(anyToast(page, /serious incident is resolved by the deputy or the principal/)).toBeVisible();
    await signInAs(page, 'u_deputy');
    await page.getByLabel('Outcome', { exact: true }).fill('Meeting held with both families; restorative session booked with the counsellor.');
    await page.getByTestId('save-outcome').click();
    await step(page, 'Resolve').click();
    await expect(status(page)).toHaveText('Resolved');
    await page.goto('#/education/discipline');
    await expect(page.getByTestId('detention-list').locator('li').first()).toBeVisible();
    await expect(page.getByTestId('points-table').locator('li').first()).toContainText('+');

    // Notices: the secretary drafts, the deputy approves, and "sent" is only a log entry.
    await signInAs(page, 'u_secretary');
    await page.goto('#/education/notices/notices_1');
    await expect(step(page, 'Approve notice')).toBeDisabled();
    await expect(workflow(page)).toContainText(/Approve notices.*Pieter van der Merwe/);
    await expect(page.getByTestId('notice-recipients')).toContainText(/Would go to \d+ families \(11 learners · Grade 7\)/);
    await page.getByLabel('Send to').selectOption('school');
    await page.getByTestId('save-notice').click();
    await expect(page.getByTestId('notice-recipients')).toContainText(/Would go to 9\d families \(150 learners · Whole school\)/);
    await signInAs(page, 'u_deputy');
    await step(page, 'Approve notice').click();
    await expect(status(page)).toHaveText('Approved');
    await signInAs(page, 'u_secretary');
    await step(page, 'Log as sent (simulated)').click();
    await expect(anyToast(page, /Logged as sent to 9\d families \(Whole school\) — preview only, nothing left this browser/)).toBeVisible();
    await expect(status(page)).toHaveText('Logged as sent');
    await expect(page.getByTestId('notice-preview')).toContainText('Marula Ridge Academy');
    await expect(panel(page, 'Preview')).toContainText('no SMS or email is sent from this demo');

    // The calendar takes a new entry.
    await page.goto('#/education/calendar');
    await page.getByTestId('new-record').click();
    await modal(page).getByLabel('What').fill('Demo open day');
    await page.getByTestId('save-record').click();
    await expect(h1(page)).toHaveText('Demo open day');
    expect(errors).toEqual([]);
  });

  test('roles: every simulated user lands on a useful dashboard, sees their own menu and is told what they cannot do', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/education');
    const nav = page.getByLabel('Main navigation');
    const menus: Record<string, { has: string[]; hasNot: string[]; action: RegExp }> = {
      u_principal: { has: ['Admissions', 'Daily attendance', 'Fees & accounts', 'Staff', 'Reports'], hasNot: [], action: /Sign \d+ report cards/ },
      u_deputy: { has: ['Admissions', 'Timetable', 'Staff absence & cover', 'Assessments & marks', 'Reports'], hasNot: ['Fees & accounts', 'Payments received'], action: /Take the Grade 12 register/ },
      u_teacher: { has: ['Daily attendance', 'Assessments & marks', 'Report cards', 'Discipline & merits'], hasNot: ['Admissions', 'Fees & accounts', 'Staff', 'Reports'], action: /Take the Grade 4 register/ },
      u_subject: { has: ['Timetable', 'Assessments & marks', 'Learners'], hasNot: ['Daily attendance', 'Report cards', 'Fees & accounts', 'Admissions'], action: /Capture and moderate marks/ },
      u_secretary: { has: ['Admissions', 'Learners', 'Daily attendance', 'Staff', 'Notices'], hasNot: ['Fees & accounts', 'Assessments & marks', 'Timetable'], action: /Open admissions/ },
      u_bursar: { has: ['Fees & accounts', 'Payments received', 'Learners', 'Reports'], hasNot: ['Daily attendance', 'Admissions', 'Assessments & marks', 'Discipline & merits'], action: /Raise \w+ \d{4} invoices/ },
      u_liaison: { has: ['Learners', 'Daily attendance', 'Discipline & merits', 'Notices'], hasNot: ['Fees & accounts', 'Assessments & marks', 'Staff'], action: /Follow up today’s absences/ },
    };
    for (const [id, menu] of Object.entries(menus)) {
      await page.goto('#/education');
      await signInAs(page, id);
      await expect(h1(page)).toContainText('Good day');
      await expect(page.getByTestId('primary-action')).toHaveText(menu.action);
      await expect(page.locator('.dash-hero a')).toHaveCount(1);
      for (const label of menu.has) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
      for (const label of menu.hasNot) await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }

    // The primary action really is the first job of the day.
    await signInAs(page, 'u_teacher');
    await page.getByTestId('primary-action').click();
    await expect(panel(page, 'Grade 4 register')).toBeVisible();

    // Fee balances are for the bursar's office; medical notes for staff who need them.
    const learner = '#/education/learners/learners_1';
    await page.goto(learner);
    await expect(panel(page, 'Fee account')).toContainText('only shown to the bursar’s office');
    await expect(page.getByTestId('fee-balance')).toHaveCount(0);
    await expect(panel(page, 'Medical')).toContainText('Allergies');
    await signInAs(page, 'u_bursar');
    await expect(page.getByTestId('fee-balance')).toHaveText(/R[\d,]+\.\d\d/);
    await expect(panel(page, 'Medical')).toContainText('hidden for your simulated role');
    await expect(panel(page, 'Details')).toContainText('hidden for your simulated role');
    await page.goto('#/education/attendance');
    await expect(page.getByTestId('no-access')).toBeVisible();

    // The liaison follows absences but cannot take a register; the subject teacher cannot publish.
    await signInAs(page, 'u_liaison');
    await page.goto('#/education/attendance');
    await expect(page.getByTestId('submit-register')).toHaveCount(0);
    await expect(page.getByTestId('who-can')).toContainText(/Take registers.*switch to/);
    await signInAs(page, 'u_subject');
    await page.goto('#/education/assessments/assessments_2');
    await expect(step(page, 'Publish marks')).toBeDisabled();
    await expect(workflow(page)).toContainText(/Publish marks.*Pieter van der Merwe/);
    expect(errors).toEqual([]);
  });

  test('mobile: dashboard, the register, an application and the mark grid are usable with no sideways page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const paths = ['#/education', '#/education/attendance', '#/education/admissions', '#/education/admissions/applications_1', '#/education/assessments/assessments_1', '#/education/reportcards/reports_1',
      '#/education/cover/leave_1', '#/education/timetable', '#/education/fees', '#/education/fees/accounts_5', '#/education/learners/learners_1', '#/education/reports'];
    for (const path of paths) {
      await page.goto(path);
      await expect(h1(page)).toBeVisible();
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
    // The register works with a thumb: the three buttons for a learner are on screen, not in a scrolled table.
    await page.goto('#/education/attendance');
    await page.getByTestId('user-switcher').selectOption('u_teacher');
    const absent = page.getByTestId('register-list').locator('li').first().getByRole('button', { name: 'Absent' });
    await absent.scrollIntoViewIfNeeded();
    const box = (await absent.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await absent.click();
    await expect(panel(page, 'Grade 4 register')).toContainText('1/12 marked');
    const submit = page.getByTestId('submit-register');
    await submit.scrollIntoViewIfNeeded();
    const sb = (await submit.boundingBox())!;
    expect(sb.x + sb.width).toBeLessThanOrEqual(390);
  });

  test('honesty: the business name follows branding and nothing claims to send, verify or comply', async ({ page }) => {
    await page.goto('#/education/settings');
    const main = page.locator('main');
    await expect(main).toContainText('no POPIA or child-data controls');
    await expect(main).toContainText('Not connected to SA-SAMS');
    await expect(main).toContainText('not CAPS assessment or promotion policy');
    await expect(main).toContainText('No messages are sent');
    await expect(main).toContainText('No payment processing');
    await page.goto('#/education/staff');
    await expect(page.getByTestId('table-staff')).toContainText('SACE registration expired');
    await page.getByTestId('table-staff').locator('tr', { hasText: 'Kagiso Mabena' }).click();
    await expect(panel(page, 'Details')).toContainText('DEMO-SACE-');
    await expect(panel(page, 'Compliance')).toContainText('no documents are stored or verified');
    await page.goto('#/education/fees');
    await expect(panel(page, /^Month-end/)).toContainText('without VAT as a demo simplification');
    await page.goto('#/education/reportcards/reports_1');
    await expect(page.getByTestId('report-sheet')).toContainText('not an official school report');
  });
});
