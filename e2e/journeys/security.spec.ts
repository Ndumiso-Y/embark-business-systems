import { expect, test, type Locator, type Page } from '@playwright/test';

// Sentinel Ridge Security: the journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage). The demo has no live clock — today's day shift is
// always "on duty" and tonight's is "upcoming" — and every time the tests type is fixed, so nothing here
// depends on the weekday or the time of day.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const anyToast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text }).last();
const panel = (page: Page, title: string) => page.locator('.panel', { has: page.getByRole('heading', { name: title, exact: true }) });
const workflow = (page: Page) => panel(page, 'Workflow');
const status = (page: Page) => workflow(page).locator('.panel-head .tag');
const step = (page: Page, name: string) => workflow(page).getByRole('button', { name, exact: true });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const nav = (page: Page) => page.getByLabel('Main navigation');
/** Select the first option whose text matches (option labels carry the officer's post, which varies by day). */
async function pick(select: Locator, text: RegExp) {
  await expect(select).toBeVisible();
  const labels = await select.locator('option').allInnerTexts();
  const label = labels.find((l) => text.test(l));
  expect(label, `an option matching ${text}`).toBeTruthy();
  await select.selectOption({ label: label! });
  return label!;
}
const search = (page: Page, q: string) => page.getByLabel('Search officers').fill(q);
const note = async (page: Page, text: string) => {
  await page.getByLabel('Transition note').fill(text);
  await page.getByTestId('confirm-transition').click();
};

// Optional: E2E_FAKE_NOW=2026-11-16T06:10:00 runs the journeys on another day / time of day.
const FAKE_NOW = process.env.E2E_FAKE_NOW;

test.describe('Security journeys', () => {
  test.beforeEach(async ({ page }) => {
    if (FAKE_NOW) await page.clock.install({ time: new Date(FAKE_NOW) });
  });

  test('duty roster: fill an unfilled post, book on, hand over, book off; absence with a note and a relief officer', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security');
    await signInAs(page, 'u_ctl');
    await nav(page).getByRole('link', { name: 'Duty roster' }).click();
    await expect(heading(page)).toHaveText('Duty roster');
    await expect(page.getByTestId('roster-unfilled')).toContainText('Officer absent — no relief');
    await expect(page.getByTestId('roster-unfilled')).toContainText('No officer posted');

    // Tomorrow's armed cash-office post is unfilled: the picker explains every officer it refuses.
    await page.getByLabel('Next day').click();
    const cashOffice = page.getByTestId('roster-unfilled').locator('li', { hasText: 'Kloofview Mall — Cash office escort' });
    await expect(cashOffice).toContainText('armed post');
    await cashOffice.getByRole('link', { name: 'Fill post' }).click();
    await expect(heading(page)).toHaveText('Kloofview Mall — Cash office escort');
    await expect(status(page)).toHaveText('Unfilled');
    const picker = panel(page, 'Post an officer');
    const blocked = page.getByTestId('blocked-list');
    await expect(blocked).toContainText(/PSIRA registration DEMO-PSIRA-\d{7} expired on/);
    await expect(blocked).toContainText('Grade too low');
    await expect(blocked).toContainText('has no firearm competency on record');
    await expect(blocked).toContainText('is already posted at');
    await expect(blocked).toContainText('Demo rest rule');

    await search(page, 'Johan Maseko');
    await page.getByTestId('candidate-blocked').getByRole('button', { name: 'Try to post' }).click();
    await expect(picker.getByRole('alert')).toContainText('Johan Maseko was refused.');
    await expect(picker.getByRole('alert')).toContainText('may not be posted');
    await expect(status(page)).toHaveText('Unfilled');
    await search(page, 'Dumisani Mofokeng');
    await page.getByTestId('candidate-blocked').getByRole('button', { name: 'Try to post' }).click();
    await expect(picker.getByRole('alert')).toContainText('Grade too low: Dumisani Mofokeng is Grade E; this post requires Grade C or higher.');
    await search(page, 'Faith Ndlovu');
    await page.getByTestId('candidate-blocked').getByRole('button', { name: 'Try to post' }).click();
    await expect(picker.getByRole('alert')).toContainText('Armed post: Faith Ndlovu has no firearm competency on record');

    await search(page, '');
    const chosen = page.getByTestId('candidate-eligible').first();
    const officer = (await chosen.getByRole('link').innerText()).trim();
    await chosen.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(anyToast(page, `${officer} posted`)).toBeVisible();
    await expect(status(page)).toHaveText('Posted');
    await expect(panel(page, 'Officer on this shift')).toContainText(officer);
    // Nobody books on before the day of the shift.
    await step(page, 'Book on').click();
    await expect(anyToast(page, 'officers book on on the day of their shift')).toBeVisible();
    await expect(status(page)).toHaveText('Posted');

    // Today: one officer is posted but has not booked on. Book on → handover → book off.
    await page.getByRole('link', { name: 'Duty roster' }).first().click();
    await page.getByRole('group', { name: 'Roster view' }).getByRole('button', { name: 'List with actions' }).click();
    await page.getByTestId('table-roster').locator('tr', { hasText: 'Not booked on' }).first().click();
    await expect(status(page)).toHaveText('Posted');
    await step(page, 'Book on').click();
    await expect(status(page)).toHaveText('On duty');
    await step(page, 'Book off').click();
    await expect(anyToast(page, 'No signed shift handover entry')).toBeVisible();
    await expect(workflow(page).locator('.blocked-list')).toContainText('the “Shift handover” panel on the shift page does both');
    await expect(status(page)).toHaveText('On duty');
    const handover = panel(page, 'Shift handover');
    await expect(handover).toContainText('Handover outstanding');
    await page.getByTestId('write-handover').click();
    await expect(anyToast(page, /OB-\d{4} signed — the officers on this shift can now book off/)).toBeVisible();
    await expect(handover).toContainText('Handover signed');
    await step(page, 'Book off').click();
    await expect(status(page)).toHaveText('Booked off');
    await expect(page.getByText('Final · locked')).toBeVisible();
    await expect(page.getByTestId('edit-record')).toHaveCount(0);

    // Tonight: an officer phones in sick. The absence needs a note; the relief runs through the same rules.
    await page.getByRole('link', { name: 'Duty roster' }).first().click();
    await page.getByRole('group', { name: 'Roster view' }).getByRole('button', { name: 'List with actions' }).click();
    const cctv = page.getByTestId('table-roster').locator('tr', { hasText: 'Kloofview Mall — CCTV control room' }).filter({ hasText: 'Night shift' });
    await cctv.getByRole('button', { name: 'Mark absent' }).click();
    await page.getByTestId('confirm-transition').click();
    await expect(anyToast(page, 'A note is required')).toBeVisible();
    await note(page, 'Phoned in sick at 16:30 — reported by the site supervisor.');
    await expect(cctv).toContainText('Absent — no relief');
    await expect(page.getByTestId('roster-unfilled')).toContainText('Kloofview Mall — CCTV control room');
    await page.getByTestId('roster-unfilled').locator('li', { hasText: 'Kloofview Mall — CCTV control room' }).getByRole('link', { name: 'Assign relief' }).click();
    await expect(status(page)).toHaveText('Absent');
    await expect(panel(page, 'History')).toContainText('Phoned in sick at 16:30');
    await step(page, 'Assign relief').click();
    await expect(anyToast(page, 'Choose a relief officer first')).toBeVisible();
    const relief = panel(page, 'Assign a relief officer').getByTestId('candidate-eligible').first();
    const reliefName = (await relief.getByRole('link').innerText()).trim();
    await relief.getByRole('button', { name: 'Assign as relief' }).click();
    await expect(status(page)).toHaveText('Relief assigned');
    await expect(panel(page, 'Officer on this shift')).toContainText(reliefName);
    expect(errors).toEqual([]);
  });

  test('occurrence book: write → sign → locked → follow-up entry; a handover written in the book unlocks book-off', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security/ob');
    await signInAs(page, 'u_ctl');
    const form = panel(page, 'Write an entry');

    // The form says what is missing.
    await page.getByTestId('ob-sign').click();
    await expect(form).toContainText('Choose the site whose occurrence book you are writing in.');
    await page.getByLabel('Entry site').selectOption({ label: 'Baobab Cold Store' });
    await page.getByTestId('ob-sign').click();
    await expect(form).toContainText('Write the entry.');

    // Draft → correct → sign → locked.
    await page.getByLabel('Entry type').selectOption('visitor');
    await page.getByLabel('Entry time').fill('09:40');
    await page.getByLabel('Entry text').fill('Journey test: auditor signed in at the gatehouse.');
    await page.getByTestId('ob-draft').click();
    await expect(anyToast(page, /OB-\d{4} saved as a draft — Baobab Cold Store/)).toBeVisible();
    const row = page.getByTestId('ob-list').locator('li', { hasText: 'Journey test: auditor signed in' });
    await expect(row).toContainText('Draft');
    await row.getByRole('link').click();
    await expect(heading(page)).toHaveText('Visitor — Baobab Cold Store');
    await page.getByTestId('edit-record').click();
    await page.locator('.modal').getByLabel('Entry', { exact: true }).fill('Journey test: auditor signed in at the gatehouse, escorted by the site officer.');
    await page.getByTestId('save-record').click();
    await expect(panel(page, 'Entry')).toContainText('escorted by the site officer');
    await page.getByRole('button', { name: 'Sign entry' }).click();
    await expect(panel(page, 'Entry status')).toContainText('This entry is signed and locked');
    await expect(page.getByTestId('edit-record')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign entry' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0);
    const parentUrl = page.url();

    // A correction is a new, numbered entry that points back at the locked one.
    await page.getByTestId('ob-followup').click();
    await page.locator('.modal').getByLabel('Entry', { exact: true }).fill('Follow-up: the auditor left site at 11:15.');
    await page.getByTestId('save-record').click();
    await expect(anyToast(page, /OB-\d{4} written as a follow-up to OB-\d{4}/)).toBeVisible();
    await expect(heading(page)).toHaveText('Follow-up entry — Baobab Cold Store');
    await expect(panel(page, 'Entry')).toContainText('Follows up');
    await page.getByRole('button', { name: 'Sign entry' }).click();
    await expect(panel(page, 'Entry status')).toContainText('signed and locked');
    await page.goto(parentUrl);
    await expect(panel(page, 'Follow-up entries')).toContainText('Follow-up: the auditor left site at 11:15.');

    // A shift handover written in the book counts for the shift on duty, whatever the wall clock says.
    await page.goto('#/security/ob');
    await page.getByLabel('Entry site').selectOption({ label: 'Kloofview Mall' });
    await page.getByLabel('Entry type').selectOption('handover');
    await expect(page.getByLabel('Entry shift')).toHaveValue('day');
    await page.getByLabel('Entry text').fill('Shift handed over to the night shift. Keys and radios counted, site in order.');
    await page.getByTestId('ob-sign').click();
    await expect(anyToast(page, /OB-\d{4} written and signed — Kloofview Mall/)).toBeVisible();
    await page.goto('#/security');
    await page.getByTestId('guide-step-2').click();
    await expect(heading(page)).toHaveText('Kloofview Mall — Main entrance');
    await expect(panel(page, 'Shift handover')).toContainText('Handover signed');
    await step(page, 'Book off').click();
    await expect(status(page)).toHaveText('Booked off');
    expect(errors).toEqual([]);
  });

  test('incident: report → respond → investigate → client report (root cause, DEMO-CAS for high severity) → closed by the director', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security/incidents');
    await signInAs(page, 'u_ctl');
    await page.getByTestId('new-record').click();
    const modal = page.locator('.modal');
    await page.getByTestId('save-record').click();
    await expect(modal).toContainText('Site is required.');
    await modal.getByLabel('Site', { exact: true }).selectOption({ label: 'Rooiberg Solar Farm · ST-0011' });
    await modal.getByLabel('Time', { exact: true }).fill('03:20');
    await modal.getByLabel('Type', { exact: true }).selectOption('theft');
    await modal.getByLabel('Severity', { exact: true }).selectOption('high');
    await modal.getByLabel('What happened (short)').fill('Journey test: inverter cabling stolen');
    await modal.getByLabel('Reported by').fill('Perimeter patrol officer');
    await page.getByTestId('save-record').click();
    await expect(anyToast(page, /Incident INC-\d{4} created/)).toBeVisible();
    await expect(heading(page)).toHaveText('Journey test: inverter cabling stolen');
    await expect(status(page)).toHaveText('Reported');
    const checklist = page.getByTestId('closeout-checklist');
    await expect(panel(page, 'Close-out checklist')).toContainText('5 outstanding');

    await step(page, 'Respond').click();
    await expect(status(page)).toHaveText('Responding');
    await step(page, 'Start investigation').click();
    await expect(status(page)).toHaveText('Investigating');

    // The client report needs a root cause, and a serious incident needs a (fictional) SAPS case number.
    await step(page, 'Log client report').click();
    await expect(anyToast(page, 'Record the root cause before the report goes to the client')).toBeVisible();
    await page.getByLabel('Root cause').fill('Perimeter beam on the east fence was bypassed for maintenance.');
    await page.getByTestId('save-closeout').click();
    await step(page, 'Log client report').click();
    await expect(anyToast(page, 'record the SAPS case number (DEMO-CAS …) or the reason no case was opened')).toBeVisible();
    await expect(status(page)).toHaveText('Investigating');
    await page.getByLabel('SAPS case number').fill('CAS 77/11/2026');
    await page.getByTestId('save-closeout').click();
    await expect(panel(page, 'Close-out details')).toContainText('Use the demo format DEMO-CAS 123/11/2026.');
    await page.getByLabel('SAPS case number').fill('DEMO-CAS 77/11/2026');
    await page.getByTestId('save-closeout').click();
    await expect(checklist).toContainText('DEMO-CAS 77/11/2026');
    await step(page, 'Log client report').click();
    await expect(anyToast(page, 'client report logged — nothing is actually sent in this demo')).toBeVisible();
    await expect(status(page)).toHaveText('Report to client');
    await expect(page.getByTestId('client-report')).toContainText('SAPS reference: DEMO-CAS 77/11/2026');

    // The control room cannot close — the screen says who can.
    await expect(step(page, 'Close incident')).toBeDisabled();
    await expect(workflow(page).locator('.blocked-list')).toContainText('switch to Thandeka Mabuza (Operations director)');

    await signInAs(page, 'u_dir');
    await step(page, 'Close incident').click();
    await expect(anyToast(page, 'The time the client was notified is not recorded')).toBeVisible();
    await page.getByLabel('Client notified at').fill('03:35');
    await page.getByTestId('save-closeout').click();
    await step(page, 'Close incident').click();
    await expect(anyToast(page, 'Outcome not recorded')).toBeVisible();
    await page.getByLabel('Outcome').fill('Cabling replaced by the client; beam re-armed and tested.');
    await page.getByTestId('save-closeout').click();
    await expect(panel(page, 'Close-out checklist')).toContainText('Ready to close');
    await step(page, 'Close incident').click();
    await expect(status(page)).toHaveText('Closed');
    await expect(page.getByText('Final · locked')).toBeVisible();
    await expect(page.getByTestId('edit-record')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('armed response: signal → dispatch (needs an available vehicle) → on scene → stood down, timed against the SLA', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security/callouts');
    await signInAs(page, 'u_ctl');
    const waiting = page.getByTestId('active-callouts').locator('li', { hasText: 'Protea Heights Estate — Panic button' });
    await expect(waiting).toContainText('Due on scene by 07:57');
    await waiting.getByTestId('dispatch-link').click();
    await expect(heading(page)).toHaveText('Panic button — Protea Heights Estate');
    await expect(status(page)).toHaveText('Signal received');
    const timeline = panel(page, 'Response timeline');
    await expect(timeline).toContainText('Due on scene by 07:57');

    // Dispatch needs a vehicle, and not one that is committed or in the workshop.
    const dispatch = panel(page, 'Dispatch a vehicle');
    await page.getByTestId('dispatch').click();
    await expect(anyToast(page, 'Choose a response vehicle before dispatching')).toBeVisible();
    const vehicle = page.getByLabel('Response vehicle');
    await pick(vehicle, /^VEH-02 .* not available$/);
    await expect(dispatch.getByRole('note')).toContainText('is already committed to CO-0002 at Kloofview Mall');
    await page.getByTestId('dispatch').click();
    await expect(status(page)).toHaveText('Signal received');
    await pick(vehicle, /^VEH-04 .* not available$/);
    await expect(dispatch.getByRole('note')).toContainText('is in for repair and cannot be dispatched');
    await pick(vehicle, /^VEH-05 .* not available$/);
    await expect(dispatch.getByRole('note')).toContainText('licence disc expired');
    await pick(vehicle, /^VEH-01 .* — available$/);
    await expect(page.getByLabel('Dispatch time')).toHaveValue('07:44');
    await page.getByTestId('dispatch').click();
    await expect(status(page)).toHaveText('Dispatched');
    await expect(timeline).toContainText('2 min after the signal · VEH-01');

    // Arrival cannot be before dispatch; 8 minutes after dispatch is inside the 15-minute SLA.
    await page.getByLabel('On-scene time').fill('07:40');
    await page.getByTestId('on-scene').click();
    await expect(anyToast(page, 'On-scene time 07:40 is before the dispatch time 07:44.')).toBeVisible();
    await page.getByLabel('On-scene time').fill('07:52');
    await page.getByTestId('on-scene').click();
    await expect(anyToast(page, 'on scene in 10 min — within the 15-minute demo SLA')).toBeVisible();
    await expect(status(page)).toHaveText('On scene');
    await expect(timeline).toContainText('10 min — within SLA');

    // Standing down needs an outcome.
    await page.getByTestId('stand-down').click();
    await expect(anyToast(page, 'Select the outcome before standing the vehicle down')).toBeVisible();
    await page.getByLabel('Outcome').selectOption('false');
    await page.getByLabel('Response report').fill('Premises checked with the keyholder, all secure.');
    await page.getByTestId('stand-down').click();
    await expect(status(page)).toHaveText('Stood down');
    await expect(timeline).toContainText('False alarm — premises secure');
    await expect(page.getByText('Final · locked')).toBeVisible();

    // A new signal answered too slowly is flagged as outside the SLA; the vehicle is free again.
    await page.getByRole('link', { name: 'Armed response' }).first().click();
    await page.getByTestId('new-record').click();
    const modal = page.locator('.modal');
    await modal.getByLabel('Site', { exact: true }).selectOption({ label: 'Baobab Distribution Centre · ST-0002' });
    await modal.getByLabel('Signal received').fill('10:00');
    await modal.getByLabel('Zone / detail').fill('Journey test — zone 3');
    await page.getByTestId('save-record').click();
    await expect(anyToast(page, /CO-\d{4} logged — dispatch a vehicle/)).toBeVisible();
    await expect(heading(page)).toHaveText('Intruder alarm — Baobab Distribution Centre');
    await pick(page.getByLabel('Response vehicle'), /^VEH-01 .* — available$/);
    await page.getByTestId('dispatch').click();
    await page.getByLabel('On-scene time').fill('10:21');
    await page.getByTestId('on-scene').click();
    await expect(anyToast(page, 'on scene in 21 min — outside the 15-minute demo SLA')).toBeVisible();
    await expect(panel(page, 'Response timeline')).toContainText('21 min — over SLA');
    expect(errors).toEqual([]);
  });

  test('equipment: a radio and a firearm are issued and returned; firearm rules refuse the wrong officer', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security/equipment');
    await signInAs(page, 'u_arm');

    // A radio goes to any officer on shift and comes back.
    await page.getByLabel('Search Equipment & armoury').fill('RAD-14');
    await page.getByTestId('table-equipment').locator('tbody tr').first().click();
    await expect(heading(page)).toContainText('RAD-14');
    await expect(status(page)).toHaveText('In store');
    await expect(page.getByTestId('issue-item')).toBeDisabled();
    await pick(page.getByLabel('Issue to officer'), /^Sibusiso Dlamini — Kloofview Mall — Main entrance/);
    await expect(panel(page, 'Issue to an officer')).toContainText('Sibusiso Dlamini meets the demo rules for this item.');
    await page.getByTestId('issue-item').click();
    await expect(anyToast(page, 'RAD-14 issued to Sibusiso Dlamini')).toBeVisible();
    await expect(status(page)).toHaveText('Issued');
    await expect(panel(page, 'Custody')).toContainText('Kloofview Mall — Main entrance');
    await step(page, 'Return to store').click();
    await expect(status(page)).toHaveText('In store');
    await expect(panel(page, 'Custody')).toContainText('In store');

    // A firearm: not to an officer on an unarmed post without competency …
    await page.goto('#/security/equipment/equipment_1');
    await expect(heading(page)).toContainText('FA-001');
    const issue = panel(page, 'Issue to an officer');
    const officer = page.getByLabel('Issue to officer');
    await pick(officer, /^Sibusiso Dlamini — Kloofview Mall — Main entrance/);
    await expect(issue.getByRole('alert')).toContainText('which is not an armed post. Firearms are only issued for armed posts');
    await page.getByTestId('issue-item').click();
    await expect(status(page)).toHaveText('In store');
    // … but to a competent officer on an armed post who does not already hold one.
    const armed = (await officer.locator('option').allInnerTexts()).filter((l) => l.includes('armed post'));
    expect(armed.length).toBeGreaterThan(1);
    let accepted = '';
    for (const label of armed) {
      await officer.selectOption({ label });
      if (await issue.getByText('meets the demo rules for this item').count()) { accepted = label.split(' — ')[0]; break; }
    }
    expect(accepted, 'an armed-post officer who may receive a firearm').not.toBe('');
    await page.getByTestId('issue-item').click();
    await expect(anyToast(page, `FA-001 issued to ${accepted}`)).toBeVisible();
    await expect(status(page)).toHaveText('Issued');
    await expect(panel(page, 'Custody')).toContainText(accepted);
    await step(page, 'Return to store').click();
    await expect(status(page)).toHaveText('In store');

    // A firearm with an expired licence is never issued.
    await page.goto('#/security/equipment/equipment_2');
    await expect(panel(page, 'Issue to an officer')).toContainText(/Firearm licence expired on .* — this item cannot be issued/);
    await step(page, 'Issue to officer').click();
    await expect(anyToast(page, 'FA-002 cannot be issued')).toBeVisible();
    await expect(status(page)).toHaveText('In store');
    expect(errors).toEqual([]);
  });

  test('site inspection: score the checklist → submit → corrective action raised and closed', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security/inspections');
    await signInAs(page, 'u_sup');
    const overdue = page.getByTestId('overdue-sites').locator('li', { hasText: 'Marula Office Park' });
    await expect(overdue).toContainText('days since the last inspection');
    await overdue.getByRole('button', { name: 'Inspect' }).click();
    // Starting an inspection only asks where, when and who — the checklist is scored on the page.
    await expect(page.locator('.modal').getByLabel('Uniform & appearance')).toHaveCount(0);
    await page.locator('.modal').getByLabel('Time', { exact: true }).fill('10:30');
    await page.getByTestId('save-record').click();
    await expect(anyToast(page, /INS-\d{4} started — score the checklist and submit/)).toBeVisible();
    await expect(heading(page)).toHaveText('Marula Office Park — inspection');
    await step(page, 'Submit inspection').click();
    await expect(anyToast(page, 'Score all five checklist items before submitting the inspection.')).toBeVisible();

    const score = (item: string, value: string) => page.getByRole('group', { name: item, exact: true }).getByRole('button', { name: value, exact: true }).click();
    await score('Uniform & appearance', 'Satisfactory');
    await score('Post orders known', 'Satisfactory');
    await score('Occurrence book up to date', 'Satisfactory');
    await score('Equipment', 'Unsatisfactory');
    await score('Alertness', 'Satisfactory');
    await expect(panel(page, 'Checklist')).toContainText('8/10 · 80%');
    await step(page, 'Submit inspection').click();
    await expect(anyToast(page, 'Describe the findings for the 1 item(s) scored below satisfactory.')).toBeVisible();
    // What is typed is saved as the box loses focus, so the submit button sees it.
    await page.getByLabel('Findings').fill('Torch not working and no spare batteries on site.');
    await step(page, 'Submit inspection').click();
    await expect(anyToast(page, /1 corrective action\(s\) raised from INS-\d{4}/)).toBeVisible();
    await expect(status(page)).toHaveText('Submitted');
    const raised = page.getByTestId('inspection-actions');
    await expect(raised).toContainText('Equipment: Torch not working and no spare batteries on site.');

    // The site is no longer overdue and the action is on the supervisor's list until it is closed with a note.
    await page.getByRole('link', { name: 'Site inspections' }).first().click();
    await expect(page.getByTestId('overdue-sites')).not.toContainText('Marula Office Park');
    const action = page.getByTestId('actions-list').locator('li', { hasText: 'Equipment: Torch not working' });
    await action.getByRole('button', { name: 'Mark done' }).click();
    await note(page, 'Torch replaced and spare batteries issued.');
    await expect(page.getByTestId('actions-list')).not.toContainText('Equipment: Torch not working');
    expect(errors).toEqual([]);
  });

  test('patrol round: a missed checkpoint needs a reason and is flagged on the round', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security/patrols');
    await signInAs(page, 'u_sup');
    await page.getByTestId('start-round').click();
    await expect(anyToast(page, 'Choose the site for the patrol round.')).toBeVisible();
    await pick(page.getByLabel('Patrol site'), /^Baobab Cold Store · 4 checkpoints$/);
    await page.getByTestId('start-round').click();
    await expect(anyToast(page, /PR-\d{4} started at Baobab Cold Store/)).toBeVisible();
    const round = page.getByTestId('round-card').filter({ hasText: 'Baobab Cold Store' });
    await expect(round).toContainText('0/4 scanned');
    for (const cp of ['CP1 Main gate', 'CP2 Perimeter north', 'CP3 Perimeter south']) await round.getByLabel(cp).check();
    await expect(round).toContainText('3/4 scanned');
    await round.getByTestId('complete-round').click();
    await expect(anyToast(page, '1 checkpoint(s) not scanned — say why before completing the round.')).toBeVisible();
    await round.getByLabel('Reason checkpoints were missed').fill('loading area gate locked, no key on site');
    await round.getByTestId('complete-round').click();
    await expect(anyToast(page, /PR-\d{4} completed — 3\/4 checkpoints scanned/)).toBeVisible();
    await expect(page.getByTestId('round-card').filter({ hasText: 'Baobab Cold Store' })).toHaveCount(0);
    const row = page.getByTestId('table-patrols').locator('tbody tr', { hasText: 'Baobab Cold Store' }).first();
    await expect(row).toContainText('1 checkpoint missed');
    await row.click();
    await expect(status(page)).toHaveText('Completed');
    await expect(panel(page, 'Details')).toContainText('CP4 Loading area — loading area gate locked, no key on site');
    expect(errors).toEqual([]);
  });

  test('invoicing: build the month from the roster, unfilled-shift penalties come off, issue and record payment', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security/invoices');
    await signInAs(page, 'u_acc');

    // A seeded invoice shows how a penalty comes off the month's guarding.
    await page.goto('#/security/invoices/invoices_11');
    await expect(heading(page)).toContainText('Kloofview Property Fund');
    const lines = page.getByTestId('invoice-lines');
    await expect(lines).toContainText('Less: penalties — 1 unfilled shift × R950.00 (demo rule)');
    await expect(lines).toContainText('-R950.00');
    await expect(lines).toContainText('VAT 15%');

    // This month: one draft per contract, built from the live roster and call-out records.
    await page.goto('#/security/invoices');
    const build = page.getByTestId('invoice-build');
    await expect(build).toContainText('Not built yet');
    await page.getByTestId('build-invoices').click();
    await expect(anyToast(page, /10 draft invoices built for /)).toBeVisible();
    await expect(build).not.toContainText('Not built yet');
    await expect(page.getByTestId('build-invoices')).toHaveCount(0);
    // Take the contract with the most unfilled shifts this month (possibly none early in a month).
    const rows = await build.locator('tbody tr').all();
    const counts = await Promise.all(rows.map(async (r) => Number((await r.locator('td').nth(2).innerText()).trim())));
    const most = Math.max(...counts);
    const target = rows[counts.indexOf(most)];
    await target.getByRole('link', { name: /INV-\d{4} · draft/ }).click();
    await expect(status(page)).toHaveText('Draft');
    await expect(page.getByTestId('invoice-lines')).toContainText(`Less: penalties — ${most} unfilled shift${most === 1 ? '' : 's'} ×`);
    if (most > 0) await expect(page.getByTestId('invoice-unfilled').locator('li')).toHaveCount(most);
    await expect(page.getByTestId('invoice-lines')).toContainText('Total due');

    await step(page, 'Issue invoice').click();
    await expect(anyToast(page, 'issued — logged only, nothing is sent to the client in this demo')).toBeVisible();
    await expect(status(page)).toHaveText('Issued');
    await step(page, 'Record payment').click();
    await expect(status(page)).toHaveText('Paid');
    await expect(page.getByText('Final · locked')).toBeVisible();
    await expect(page.getByTestId('edit-record')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('guide: every step opens the right screen as the right user and really works', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number, title: string | RegExp, user: string) => {
      await page.goto('#/security');
      await page.getByTestId(`guide-step-${n}`).click();
      await expect(heading(page)).toHaveText(title);
      await expect(page.getByTestId('user-switcher')).toContainText(user);
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    };
    await page.goto('#/security');
    await expect(page.getByTestId('guide-step-6')).toBeVisible();
    await expect(page.getByTestId('guide-step-7')).toHaveCount(0);

    // 1. Fill an unfilled post: a refused officer, then an eligible one.
    await open(1, 'Kloofview Mall — Cash office escort', 'Bongani Khumalo');
    await expect(status(page)).toHaveText('Unfilled');
    await page.getByTestId('candidate-blocked').first().getByRole('button', { name: 'Try to post' }).click();
    await expect(panel(page, 'Post an officer').getByRole('alert')).toContainText('was refused.');
    await page.getByTestId('candidate-eligible').first().getByRole('button', { name: 'Post', exact: true }).click();
    await expect(status(page)).toHaveText('Posted');

    // 2. Book off: refused until the handover entry is signed.
    await open(2, 'Kloofview Mall — Main entrance', 'Bongani Khumalo');
    await expect(status(page)).toHaveText('On duty');
    await step(page, 'Book off').click();
    await expect(anyToast(page, 'No signed shift handover entry in the Kloofview Mall occurrence book')).toBeVisible();
    await page.getByTestId('write-handover').click();
    await step(page, 'Book off').click();
    await expect(status(page)).toHaveText('Booked off');

    // 3. Dispatch armed response and see the response time.
    await open(3, 'Panic button — Protea Heights Estate', 'Bongani Khumalo');
    await pick(page.getByLabel('Response vehicle'), /— available$/);
    await page.getByTestId('dispatch').click();
    await page.getByTestId('on-scene').click();
    await expect(panel(page, 'Response timeline')).toContainText('10 min — within SLA');
    await page.getByLabel('Outcome').selectOption('usererror');
    await page.getByTestId('stand-down').click();
    await expect(status(page)).toHaveText('Stood down');

    // 4. Close an incident properly.
    await open(4, 'Break-in at the dispatch store — roller door forced', 'Thandeka Mabuza');
    await expect(status(page)).toHaveText('Investigating');
    await step(page, 'Log client report').click();
    await expect(anyToast(page, 'Record the root cause')).toBeVisible();
    await page.getByLabel('Root cause').fill('East fence alarm zone was bypassed after a false alarm and never re-armed.');
    await page.getByLabel('SAPS case number').fill('DEMO-CAS 214/11/2026');
    await page.getByLabel('Outcome').fill('Fence repaired, zone re-armed, stock loss reported to the client’s insurer.');
    await page.getByTestId('save-closeout').click();
    await step(page, 'Log client report').click();
    await expect(status(page)).toHaveText('Report to client');
    await step(page, 'Close incident').click();
    await expect(status(page)).toHaveText('Closed');

    // 5. Issue a firearm: refused for an unarmed post, accepted for an armed post.
    await open(5, /^FA-001 · /, 'Lucky Mahlaba');
    const officer = page.getByLabel('Issue to officer');
    const issue = panel(page, 'Issue to an officer');
    await pick(officer, /\((Day|Night)\)$/);
    await expect(issue.getByRole('alert')).toContainText('which is not an armed post');
    for (const label of (await officer.locator('option').allInnerTexts()).filter((l) => l.includes('armed post'))) {
      await officer.selectOption({ label });
      if (await issue.getByText('meets the demo rules for this item').count()) break;
    }
    await page.getByTestId('issue-item').click();
    await expect(status(page)).toHaveText('Issued');

    // 6. Submit the inspection: two corrective actions, site no longer overdue.
    await open(6, 'Highveld Private Hospital — inspection', 'Sipho Mokoena');
    await expect(panel(page, 'Site inspection record')).toContainText('16 d since last');
    await step(page, 'Submit inspection').click();
    await expect(status(page)).toHaveText('Submitted');
    await expect(page.getByTestId('inspection-actions').locator('li')).toHaveCount(2);
    await expect(panel(page, 'Site inspection record')).toContainText('0 d since last');

    await page.goto('#/security');
    await expect(page.getByTestId('guide')).toContainText('Open again');
    expect(errors).toEqual([]);
  });

  test('roles: each simulated user gets their own menu and shortcut, and is told what they cannot do', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/security');

    // Control room: runs the roster, the books and armed response; no commercial modules.
    await signInAs(page, 'u_ctl');
    await expect(page.getByTestId('dash-shortcut')).toHaveText('Open duty roster');
    await expect(nav(page).getByRole('link', { name: 'Armed response' })).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Invoicing' })).toHaveCount(0);

    // Supervisor: inspections and patrols, books officers on and off, but cannot post officers or close incidents.
    await signInAs(page, 'u_sup');
    await expect(page.getByTestId('dash-shortcut')).toHaveText('Open site inspections');
    await expect(nav(page).getByRole('link', { name: 'Armed response' })).toHaveCount(0);
    await page.goto('#/security/roster/roster_1');
    await expect(step(page, 'Post officer')).toBeDisabled();
    await expect(workflow(page).locator('.blocked-list')).toContainText('Needs the “Manage roster” permission — switch to Bongani Khumalo');
    await expect(page.getByText('Your simulated role cannot post officers.')).toBeVisible();
    await expect(page.getByTestId('candidate-eligible')).toHaveCount(0);
    await page.goto('#/security/incidents/incidents_6');
    await expect(step(page, 'Close incident')).toBeDisabled();
    await expect(page.getByText('Closing needs the “Close incidents” permission (Operations director).')).toBeVisible();
    await page.goto('#/security/callouts');
    await expect(page.getByTestId('no-access')).toBeVisible();

    // HR: maintains the officer register and sees the restricted notes; the roster is read-only.
    await page.goto('#/security');
    await signInAs(page, 'u_hr');
    await expect(page.getByTestId('dash-shortcut')).toHaveText('Open officers & compliance');
    await page.getByTestId('dash-shortcut').click();
    await page.getByLabel('Search Officers').fill('Johan Maseko');
    await page.getByTestId('table-officers').locator('tbody tr').first().click();
    await expect(panel(page, 'Compliance')).toContainText('Not deployable');
    await expect(panel(page, 'Details')).toContainText('PSIRA renewal submitted late');
    await expect(page.getByTestId('edit-record')).toBeVisible();

    // Accounts: contracts and invoices only; the control room's operational lists are not in the menu.
    await page.goto('#/security');
    await signInAs(page, 'u_acc');
    await expect(page.getByTestId('dash-shortcut')).toHaveText('Open invoicing');
    await expect(nav(page).getByRole('link', { name: 'Duty roster' })).toHaveCount(0);
    await expect(nav(page).getByRole('link', { name: 'Client contracts' })).toBeVisible();

    // Armoury: issues equipment, sees officers without the HR notes, cannot book officers off.
    await signInAs(page, 'u_arm');
    await expect(page.getByTestId('dash-shortcut')).toHaveText('Open the armoury');
    await page.goto('#/security/officers/officers_4');
    await expect(panel(page, 'Details')).not.toContainText('PSIRA renewal submitted late');
    await expect(panel(page, 'Details')).toContainText('1 field(s) hidden for your simulated role.');
    await expect(page.getByTestId('edit-record')).toHaveCount(0);
    await page.goto('#/security');
    await page.getByTestId('guide-step-2').click();
    await signInAs(page, 'u_arm');
    await expect(step(page, 'Book off')).toBeDisabled();
    await expect(workflow(page).locator('.blocked-list')).toContainText('Needs the “Book on / off” permission');
    expect(errors).toEqual([]);
  });

  test('mobile: dashboard, roster, shift and call-out screens fit a 390px screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/security', '#/security/roster', '#/security/roster/roster_1', '#/security/callouts', '#/security/callouts/callouts_1', '#/security/ob']) {
      await page.goto(path);
      await expect(heading(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
    // The roster grid stacks day and night posts under each site instead of scrolling sideways.
    await page.goto('#/security/roster');
    const site = page.getByTestId('roster-site').first();
    await expect(site).toContainText('Day shift 06:00–18:00');
    await expect(site).toContainText('Night shift 18:00–06:00');
    const box = await site.getByTestId('roster-chip').last().boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });
});
