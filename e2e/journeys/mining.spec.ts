import { expect, test, type Page } from '@playwright/test';

// Core journeys for the mining demo (Ridgeback Minerals), driven through the UI only.
// Every test starts on a fresh seed. Dates are computed from the browser clock and
// permit validity runs to tomorrow, so nothing here depends on the time of day.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const toast = (page: Page) => page.locator('.toast').last();
const status = (page: Page) => page.locator('.panel', { hasText: 'Workflow' }).first().locator('.panel-head .tag');
const blocked = (page: Page) => page.locator('.blocked-list');
const step = (page: Page, name: string) => page.locator('.wf-actions').getByRole('button', { name, exact: true });
const isoDay = (page: Page, offset = 0) => page.evaluate((o) => {
  const d = new Date();
  d.setDate(d.getDate() + o);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}, offset);

test.describe('Mining journeys', () => {
  test('guide: every step opens a working screen as the right user', async ({ page }) => {
    const errors = watchErrors(page);
    const expected: Array<[RegExp, string]> = [
      [/Level 7 East — Day shift/, 'Pieter-Jan Coetzee'],
      [/Shift production log/, 'Zodwa Mthethwa'],
      [/Inspect settler tank internals/, 'Ayanda Ngcobo'],
      [/Runaway mine car/, 'Ayanda Ngcobo'],
      [/250 h service/, 'Ruan Visagie'],
      [/Respirable dust/, 'Fikile Shabalala'],
    ];
    for (let i = 0; i < expected.length; i++) {
      await page.goto('#/mining');
      await page.getByTestId(`guide-step-${i + 1}`).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected[i][0]);
      await expect(page.getByTestId('user-switcher')).toContainText(expected[i][1]);
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    }
    await expect(page.getByTestId('guide-step-7')).toHaveCount(0);
    // What each guide step promises is really there on a fresh seed.
    await signInAs(page, 'u_mm');
    await page.goto('#/mining/production/shifts_535');
    await expect(status(page)).toHaveText('Open');
    await page.goto('#/mining/permits/permits_4');
    await expect(blocked(page)).toContainText('Oxygen 18.9%');
    await page.goto('#/mining/incidents/incidents_12');
    await expect(status(page)).toHaveText('Investigating');
    await page.goto('#/mining/workorders/workorders_13');
    await expect(status(page)).toHaveText('Planned');
    await page.goto('#/mining/environment/envreadings_40');
    await expect(page.getByTestId('review-exceedance')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('shift: capture figures, submit, and verify as a different user (delay reason rule)', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mining');
    await page.getByTestId('guide-step-1').click(); // Pieter-Jan Coetzee, today's open Level 7 East day shift
    const figures = page.getByTestId('shift-figures');
    await figures.getByLabel('Tonnes hoisted').fill('');
    await page.getByTestId('save-figures').click();
    await expect(figures).toContainText('Enter the tonnes hoisted');
    await figures.getByLabel('Tonnes hoisted').fill('431');
    await figures.getByLabel('Delay minutes').fill('45'); // over 30 minutes, no reason yet
    await page.getByTestId('save-figures').click();
    await expect(toast(page)).toContainText('figures saved');
    await step(page, 'Submit shift').click();
    await expect(status(page)).toHaveText('Submitted');

    // The supervisor who submitted cannot verify: the step is disabled and the screen says who can.
    await expect(step(page, 'Verify shift')).toBeDisabled();
    await expect(page.getByTestId('shift-panel')).toContainText('Awaiting verification by Zodwa Mthethwa');

    // Mine manager: verification is refused until the delay has a reason.
    await signInAs(page, 'u_mm');
    await step(page, 'Verify shift').click();
    await expect(toast(page)).toContainText('select a delay reason before verifying');
    await expect(status(page)).toHaveText('Submitted');
    await page.getByTestId('shift-panel').getByLabel('Main delay reason').selectOption('lhd');
    await page.getByTestId('save-delay-reason').click();
    await expect(blocked(page)).toHaveCount(0);
    await step(page, 'Verify shift').click();
    await expect(status(page)).toHaveText('Verified');
    await expect(page.locator('.timeline')).toContainText('Verify shift');

    // The shift board and the verification queue reflect it (6 awaiting on a fresh seed, +1 submitted, −1 verified).
    await page.goto('#/mining/production');
    await expect(page.getByTestId('verify-list').locator('li')).toHaveCount(6);
    expect(errors).toEqual([]);
  });

  test('shift: logging a new shift never duplicates a log, and nobody verifies their own shift', async ({ page }) => {
    await page.goto('#/mining/production'); // mine manager
    await page.getByTestId('new-record').click();
    // Defaults to the first section/shift of today without a log (tonight, Level 7 East).
    await expect(page.locator('#f_shift')).toHaveValue('night');
    await expect(page.locator('#f_section')).toHaveValue('l7e');
    await page.locator('#f_shift').selectOption('day'); // today's day shift already has a log
    await page.locator('#f_crew').fill('Crew A — TL Sizwe Ndaba');
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText('already covers that section and shift');
    await page.locator('#f_shift').selectOption('night');
    await page.locator('#f_tonnesHoisted').fill('388');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 7 East — Night shift');
    await step(page, 'Submit shift').click();
    await expect(status(page)).toHaveText('Submitted');
    await expect(blocked(page)).toContainText('You submitted this shift log. A different person must verify it.');
    await step(page, 'Verify shift').click();
    await expect(status(page)).toHaveText('Submitted');
  });

  test('permit to work: request → approve → activate (contractor, isolation, oxygen) → close', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mining/permits');
    await signInAs(page, 'u_cc'); // contractor coordinator requests
    await page.getByTestId('new-record').click();
    await page.locator('#f_type').selectOption('confined');
    await page.locator('#f_location').selectOption('pumpstation');
    await page.locator('#f_description').fill('Clean out sump 3 (journey test)');
    await page.locator('#f_holder').fill('Karabo Seleka');
    await page.locator('#f_contractor').selectOption('contractors_7'); // Karabo Seleka: induction and medical expired
    // The form starts valid from today until tomorrow 16:00, so a new permit is never already expired.
    await expect(page.locator('#f_validFrom')).toHaveValue(await isoDay(page));
    await expect(page.locator('#f_validTo')).toHaveValue(await isoDay(page, 1));
    await expect(page.locator('#f_expiresAt')).toHaveValue('16:00');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clean out sump 3 (journey test)');
    await expect(status(page)).toHaveText('Requested');
    await expect(step(page, 'Approve permit')).toBeDisabled(); // the coordinator cannot approve

    // Safety officer: approval refused while the contractor is not cleared for site.
    await signInAs(page, 'u_so');
    await step(page, 'Approve permit').click();
    await expect(toast(page)).toContainText('Karabo Seleka is not cleared for site');
    await expect(status(page)).toHaveText('Requested');
    await page.getByTestId('permit-checks').getByRole('link', { name: 'Karabo Seleka' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Karabo Seleka');
    await expect(page.locator('.panel', { hasText: 'Site clearance' })).toContainText('renewals are recorded by');
    await signInAs(page, 'u_cc');
    await page.getByRole('button', { name: 'Record induction today' }).click();
    await page.getByRole('button', { name: 'Record medical today' }).click();
    await expect(page.locator('.panel', { hasText: 'Site clearance' }).locator('.panel-head .tag')).toHaveText('Cleared for site');
    await page.getByTestId('contractor-permits').getByRole('link', { name: /PTW-0012/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clean out sump 3 (journey test)');

    await signInAs(page, 'u_so');
    await step(page, 'Approve permit').click();
    await expect(status(page)).toHaveText('Approved');

    // Activation: isolation first, then a passing oxygen reading.
    await step(page, 'Activate permit').click();
    await expect(toast(page)).toContainText('Isolation and lock-out must be confirmed');
    await page.getByTestId('confirm-isolation').click();
    await expect(page.locator('.panel', { hasText: 'Confirm isolation' })).toContainText('List the isolation points');
    await page.getByLabel('Isolation points and lock numbers').fill('Sump pump 3 isolated at MCC, lock 27.');
    await page.getByTestId('confirm-isolation').click();
    await expect(blocked(page)).toContainText('Record the pre-entry gas test');
    await page.getByLabel('Oxygen reading').fill('18');
    await page.getByTestId('record-gas-test').click();
    await expect(blocked(page)).toContainText('Oxygen 18% is below 19.5%');
    await step(page, 'Activate permit').click();
    await expect(status(page)).toHaveText('Approved');
    await page.getByLabel('Oxygen reading').fill('20.9');
    await page.getByTestId('record-gas-test').click();
    await expect(blocked(page)).toHaveCount(0);
    await step(page, 'Activate permit').click();
    await expect(status(page)).toHaveText('Active');

    await step(page, 'Close permit').click();
    await page.getByTestId('confirm-transition').click(); // a note is required
    await expect(page.locator('.modal')).toContainText('A note is required');
    await page.getByLabel('Transition note').fill('Work complete, sump inspected, isolations removed.');
    await page.getByTestId('confirm-transition').click();
    await expect(status(page)).toHaveText('Closed');
    expect(errors).toEqual([]);
  });

  test('incident: report → investigate → corrective actions (root cause) → close', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mining/incidents');
    await signInAs(page, 'u_pc'); // a supervisor reports
    await page.getByTestId('new-record').click();
    await expect(page.locator('#f_date')).toHaveValue(await isoDay(page)); // today, with the reporter filled in
    await expect(page.locator('#f_reportedBy')).toHaveValue('Pieter-Jan Coetzee');
    await page.locator('#f_title').fill('Loose rock at travelling way (journey test)');
    await page.locator('#f_type').selectOption('nearmiss');
    await page.locator('#f_category').selectOption('fog');
    await page.locator('#f_severity').selectOption('medium');
    await page.locator('#f_location').selectOption('l7e');
    await page.getByTestId('save-record').click();
    await expect(status(page)).toHaveText('Reported');
    await expect(step(page, 'Start investigation')).toBeDisabled();
    await expect(page.getByTestId('investigation-panel')).toContainText('Ayanda Ngcobo');

    await signInAs(page, 'u_so');
    await step(page, 'Start investigation').click();
    await expect(status(page)).toHaveText('Investigating');
    await step(page, 'Agree corrective actions').click();
    await expect(toast(page)).toContainText('Record the root cause');
    const form = page.getByTestId('investigation-form');
    await form.getByLabel('Root cause').fill('Barring down not done after the blast.');
    await form.getByLabel('Corrective actions').fill('Re-bar the area and install mesh; add to entry examination checklist.');
    await form.getByLabel('Action owner').fill('Pieter-Jan Coetzee');
    await page.getByTestId('save-investigation').click();
    await expect(blocked(page)).toHaveCount(0);
    await step(page, 'Agree corrective actions').click();
    await expect(status(page)).toHaveText('Corrective actions');

    // Closing is refused until the actions are marked complete.
    await step(page, 'Close incident').click();
    // The refusal is immediate: no note is asked for when a note cannot fix the problem.
    await expect(page.locator('.toast').last()).toContainText('not marked complete');
    await expect(page.locator('.modal')).toHaveCount(0);
    await page.getByTestId('actions-complete').click();
    await expect(blocked(page)).toHaveCount(0);
    await step(page, 'Close incident').click();
    await page.getByLabel('Transition note').fill('Mesh installed and inspected with the section.');
    await page.getByTestId('confirm-transition').click();
    await expect(status(page)).toHaveText('Closed');
    expect(errors).toEqual([]);
  });

  test('work order: raise → plan → start → complete with hour meter; the machine’s next service moves', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mining/equipment/equipment_9'); // LOCO-12: 14 950 h, service was due at 14 900 h
    await signInAs(page, 'u_mp');
    await expect(page.locator('.panel', { hasText: 'Service status' }).locator('.panel-head .tag')).toHaveText('Overdue by 50 h');
    await page.getByRole('button', { name: 'Raise work order' }).click();
    await expect(page.locator('#f_title')).toHaveValue('500 h service');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('500 h service'); // lands on the new work order
    await expect(status(page)).toHaveText('Raised');

    await step(page, 'Start work').click();
    await expect(toast(page)).toContainText('must be planned and assigned');
    await page.getByTestId('plan-assign').click();
    await expect(page.getByTestId('plan-form')).toContainText('Assign an artisan');
    await page.getByTestId('plan-form').getByLabel('Artisan').selectOption({ index: 1 });
    await page.getByTestId('plan-assign').click();
    await expect(status(page)).toHaveText('Planned');
    await step(page, 'Start work').click();
    await expect(status(page)).toHaveText('In progress');

    await step(page, 'Complete work order').click();
    await expect(toast(page)).toContainText('meter reading at completion');
    const done = page.getByTestId('complete-form');
    await done.getByLabel('Hour meter at completion').fill('120');
    await done.getByLabel('Work done').fill('500 h service and battery check.');
    await page.getByTestId('complete-wo').click();
    await expect(done).toContainText('below the last recorded service');
    await done.getByLabel('Hour meter at completion').fill('14960');
    await page.getByTestId('complete-wo').click();
    await expect(status(page)).toHaveText('Completed');
    await expect(page.getByTestId('wo-machine')).toContainText('next service due at 15460 h');

    await page.getByTestId('wo-machine').getByRole('link', { name: 'LOCO-12' }).click();
    await expect(page.locator('.panel', { hasText: 'Service status' }).locator('.panel-head .tag')).toHaveText('500 h to service');
    await expect(page.locator('.panel', { hasText: 'Service status' })).toContainText('next service at 15460 h');
    expect(errors).toEqual([]);
  });

  test('environment: an exceedance cannot be reviewed without a note', async ({ page }) => {
    await page.goto('#/mining');
    await page.getByTestId('guide-step-6').click(); // Fikile Shabalala, dust reading above the demo threshold
    await expect(page.locator('.panel', { hasText: 'Against demo threshold' })).toContainText('above demo threshold');
    await step(page, 'Mark reviewed').click();
    await expect(toast(page)).toContainText('Add a review note');
    await expect(status(page)).toHaveText('Recorded');
    await page.getByLabel('Exceedance review note').fill('Water sprays at the tip were blocked — cleaned and re-sampled next shift.');
    await page.getByTestId('review-exceedance').click();
    await expect(status(page)).toHaveText('Reviewed');
    await expect(page.locator('.timeline')).toContainText('Water sprays at the tip were blocked');

    // A new reading must be taken at a point where that parameter is monitored.
    await page.goto('#/mining/environment');
    await page.getByTestId('new-record').click();
    await expect(page.locator('#f_date')).toHaveValue(await isoDay(page));
    await expect(page.locator('#f_recordedBy')).toHaveValue('Fikile Shabalala');
    await page.locator('#f_point').selectOption('rwd');
    await page.locator('#f_parameter').selectOption('dust');
    await page.locator('#f_value').fill('0.8');
    await page.getByTestId('save-record').click();
    await expect(page.locator('.modal')).toContainText('not monitored at Return water dam');
    await page.locator('#f_parameter').selectOption('ph');
    await page.locator('#f_value').fill('7.4');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Water pH — Return water dam');
  });

  test('roles: a shift supervisor sees their own modules and is told who does the rest', async ({ page }) => {
    await page.goto('#/mining');
    await signInAs(page, 'u_pc');
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'Shift production log' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Environmental monitoring' })).toHaveCount(0);
    await page.goto('#/mining/environment');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await page.goto('#/mining/workorders');
    await expect(page.getByTestId('new-record')).toHaveCount(0);
    await expect(page.getByRole('note').filter({ hasText: 'You can follow work orders here' })).toContainText('Ruan Visagie');
    await page.goto('#/mining/production');
    await expect(page.getByTestId('verify-list').getByRole('button', { name: 'Verify shift' })).toHaveCount(0);
    await expect(page.locator('.panel', { hasText: 'Awaiting verification' })).toContainText('Verification is done by Zodwa Mthethwa');
  });

  test('mobile: dashboard, shift log and a permit fit a 390 px screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/mining', '#/mining/production', '#/mining/production/shifts_535', '#/mining/permits', '#/mining/permits/permits_4']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByLabel('Main navigation').getByRole('link', { name: 'Shift production log' }).click();
    await expect(page.getByRole('heading', { name: 'Shift production log', level: 1 })).toBeVisible();
  });
});
