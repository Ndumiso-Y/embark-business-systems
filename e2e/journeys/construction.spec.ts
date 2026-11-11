import { expect, test, type Page } from '@playwright/test';

// Core journeys for the construction demo (Ironbark Building & Civils), driven through the UI only.
// Every test starts on a fresh seed. Nothing depends on the time of day or the day of the week:
// dates come from the browser clock, and money is checked by adding up what is on screen
// (some seeded amounts vary with the weekday the demo is first opened).

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
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
/** Value of a label/value pair inside a container. */
const kv = (scope: ReturnType<Page['locator']>, label: string) => scope.locator('.kv > div', { hasText: label }).first().locator('dd');
/** "R13,861,300.00" or "− R693,065.00" → cents (always positive). */
const cents = (text: string | null) => Math.round(Number((text ?? '').replace(/[^0-9.]/g, '')) * 100);
const isoDay = (page: Page, offset = 0) => page.evaluate((o) => {
  const d = new Date();
  d.setDate(d.getDate() + o);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}, offset);
const weekday = (page: Page) => page.evaluate(() => new Date().getDay());

/** Reads the valuation calculation off the screen and checks every line adds up. */
async function checkValuationAddsUp(page: Page, retentionPct: number) {
  const row = async (label: string) => cents(await page.getByTestId('valuation-totals').locator('.row', { hasText: label }).locator('b').textContent());
  const work = await row('Work done to date');
  const materials = await row('Materials on site');
  const variations = await row('Approved variations to date');
  const gross = await row('Gross value to date');
  const retention = await row('Less retention');
  const net = await row('Net value to date');
  const previous = await row('Less previous certificates');
  const due = await row('Amount due (excl. VAT)');
  const vat = await row('VAT 15%');
  const total = cents(await page.getByTestId('valuation-totals').locator('.grand b').textContent());
  expect(gross, 'gross = work + materials + variations').toBe(work + materials + variations);
  expect(retention, `retention = ${retentionPct}% of gross`).toBe(Math.round((gross * retentionPct) / 100));
  expect(net, 'net = gross − retention').toBe(gross - retention);
  expect(due, 'due = net − previous certificates').toBe(net - previous);
  expect(vat, 'VAT = 15% of amount due').toBe(Math.round((due * 15) / 100));
  expect(total, 'total = due + VAT').toBe(due + vat);
  return { gross, retention, previous, due, vat, total };
}

test.describe('Construction journeys', () => {
  test('guide: every step opens a working screen as the right user', async ({ page }) => {
    const errors = watchErrors(page);
    const expected: Array<[RegExp, string]> = [
      [/^Site diary$/, 'Sizwe Ndlovu'],
      [/Additional stormwater sump/, 'Heinrich van der Merwe'],
      [/Valuation 6 — Umgeni Ridge Primary/, 'Lindiwe Mahlangu'],
      [/Rietvlei Business Park — Unit C warehouse/, 'Heinrich van der Merwe'],
      [/Sanitaryware for the ablution block/, 'Fatima Davids'],
      [/HP-EX-311/, 'Sizwe Ndlovu'],
    ];
    for (let i = 0; i < expected.length; i++) {
      await page.goto('#/construction');
      await page.getByTestId(`guide-step-${i + 1}`).click();
      await expect(heading(page)).toHaveText(expected[i][0]);
      await expect(page.getByTestId('user-switcher')).toContainText(expected[i][1]);
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    }
    await expect(page.getByTestId('guide-step-7')).toHaveCount(0);
    // What each guide step promises is really there on a fresh seed.
    await signInAs(page, 'u_md');
    await page.goto('#/construction/diary');
    await expect(page.getByTestId('diary-drafts').locator('li', { hasText: 'cause missing' })).toHaveCount(1);
    await page.goto('#/construction/variations/variations_3');
    await expect(status(page)).toHaveText('Submitted to client');
    await expect(page.getByTestId('variation-impact')).toContainText('R39,800.00');
    await page.goto('#/construction/valuations/valuations_6');
    await expect(status(page)).toHaveText('Draft');
    await page.goto('#/construction/projects/projects_2');
    await expect(blocked(page)).toContainText('1 critical snag still open (SNG-0016)');
    await page.goto('#/construction/procurement/requisitions_3');
    await expect(status(page)).toHaveText('Approved');
    await page.goto('#/construction/plant/plant_4');
    await expect(page.getByTestId('off-hire')).toBeVisible();
    await expect(page.locator('.notice', { hasText: 'Hired plant idle — R3,900.00/day' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('site diary: a delay or rain day needs a cause before signing; one entry per site per day', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/construction');
    await page.getByTestId('guide-step-1').click(); // Sizwe Ndlovu, site agent
    // The warehouse entry of the last working day has a 3-hour delay and no cause.
    const draft = page.getByTestId('diary-drafts').locator('li', { hasText: 'cause missing' });
    await draft.getByRole('button', { name: 'Sign diary' }).click();
    await expect(toast(page)).toContainText('select the delay cause before signing');
    await draft.getByRole('link').click();
    await expect(status(page)).toHaveText('Draft');
    await expect(page.getByTestId('diary-panel')).toContainText('Cause not recorded');
    await page.getByTestId('diary-form').getByLabel('Delay cause').selectOption('plant');
    await page.getByTestId('save-diary').click();
    await expect(blocked(page)).toHaveCount(0);
    await expect(page.getByTestId('diary-panel')).toContainText('Contractor-risk delay');
    await step(page, 'Sign diary').click();
    await expect(status(page)).toHaveText('Signed');
    await expect(kv(page.locator('.panel', { hasText: 'Details' }).first(), 'Signed by')).toHaveText('Sizwe Ndlovu');

    // A second entry for the same site and day is refused.
    const lastWorkDay = await isoDay(page, (await weekday(page)) === 1 ? -2 : -1);
    await page.goto('#/construction/diary');
    await page.getByTestId('new-record').click();
    await page.locator('#f_project').selectOption('projects_2');
    await page.locator('#f_date').fill(lastWorkDay);
    await page.locator('#f_workDone').fill('Duplicate entry');
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText('one entry per site per day');

    // A rain day on the most recent Sunday (the seed never has Sunday entries).
    await page.locator('#f_date').fill(await isoDay(page, -(await weekday(page))));
    await page.locator('#f_weather').selectOption('rain');
    await page.locator('#f_workDone').fill('');
    await page.locator('#f_labourGeneral').fill('6');
    await page.getByTestId('save-record').click();
    await expect(heading(page)).toContainText('Rietvlei Business Park');
    await step(page, 'Sign diary').click();
    await expect(toast(page)).toContainText('Describe the work done');
    const form = page.getByTestId('diary-form');
    await form.getByLabel('Work done').fill('No productive work — rain. Site made safe.');
    await expect(form.getByLabel('Delay cause')).toHaveValue('rain'); // suggested for a rain day, saved with the entry
    await form.getByLabel('Delay hours').fill('8');
    await page.getByTestId('save-diary').click();
    await expect(page.getByTestId('diary-panel')).toContainText('Rain day — counts towards the indicative extension of time');
    await step(page, 'Sign diary').click();
    await expect(status(page)).toHaveText('Signed');
    expect(errors).toEqual([]);
  });

  test('variation: instruct → price → submit → approve, and the revised contract sum changes on the project', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/construction/projects/projects_1');
    await signInAs(page, 'u_sa'); // the site agent records the instruction
    const commercial = page.locator('.panel', { hasText: 'Commercial position' });
    const before = cents(await kv(commercial, 'Revised contract sum').textContent());
    expect(before).toBe(cents(await kv(commercial, 'Original contract value').textContent()) + cents(await kv(commercial, 'Approved variations').textContent()));
    await page.getByRole('button', { name: 'Record variation' }).click();
    await page.locator('#f_description').fill('Extra paving at the entrance (journey test)');
    await page.getByTestId('save-record').click();
    await expect(heading(page)).toHaveText('Extra paving at the entrance (journey test)');
    await expect(status(page)).toHaveText('Instructed');
    await expect(page.locator('.panel', { hasText: 'Price the variation' })).toContainText('Lindiwe Mahlangu'); // who prices it

    await signInAs(page, 'u_qs');
    await step(page, 'Mark priced').click();
    await expect(toast(page)).toContainText('Enter the priced value');
    await page.getByTestId('price-form').getByLabel('Priced value').fill('50000');
    await page.getByTestId('price-form').getByLabel('Time impact days').fill('2');
    await page.getByTestId('price-variation').click();
    await expect(status(page)).toHaveText('Priced');

    // No written instruction, no submission.
    await step(page, 'Submit to client').click();
    await expect(toast(page)).toContainText('a verbal instruction cannot be submitted');
    await page.getByLabel('Site instruction reference').fill('SI-020');
    await page.getByTestId('save-si-ref').click();
    await expect(blocked(page)).toHaveCount(0);
    await step(page, 'Submit to client').click();
    await expect(status(page)).toHaveText('Submitted to client');
    await expect(step(page, 'Record client approval')).toBeDisabled(); // the QS cannot approve their own submission

    await signInAs(page, 'u_pm1');
    await step(page, 'Record client approval').click();
    await expect(status(page)).toHaveText('Approved');
    const impact = page.getByTestId('variation-impact');
    expect(cents(await kv(impact, 'Revised contract sum').textContent())).toBe(before + 5_000_000);
    await impact.getByRole('link', { name: /Umgeni Ridge Primary/ }).click();
    await expect(kv(commercial, 'Revised contract sum')).toHaveText(/R18,634,800\.00/);
    expect(cents(await kv(commercial, 'Revised contract sum').textContent())).toBe(before + 5_000_000);

    // A variation for a non-compliant subcontractor cannot be priced.
    await signInAs(page, 'u_qs');
    await page.goto('#/construction/variations/variations_9');
    await page.getByTestId('price-form').getByLabel('Priced value').fill('64000');
    await page.getByTestId('price-variation').click();
    await expect(page.getByTestId('price-form')).toContainText('is not compliant');
    await expect(status(page)).toHaveText('Instructed');
    expect(errors).toEqual([]);
  });

  test('payment valuation: submit → certificate (≤ submitted) → certified → paid, and the numbers add up', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/construction');
    await page.getByTestId('guide-step-3').click(); // Lindiwe Mahlangu, QS — draft valuation 6 on the school (5 % retention)
    const v6 = await checkValuationAddsUp(page, 5);
    expect(v6.previous).toBeGreaterThan(0);
    await step(page, 'Submit valuation').click();
    await expect(status(page)).toHaveText('Submitted');

    // The certificate panel starts from the amount submitted and refuses anything higher.
    const amount = page.getByLabel('Certified amount');
    expect(cents(await amount.inputValue())).toBe(v6.due);
    await step(page, 'Record certificate').click(); // the workflow button points at the panel until an amount is recorded
    await expect(toast(page)).toContainText('Record payment certificate');
    await amount.fill(String((v6.due + 100) / 100));
    await page.getByTestId('record-certificate').click();
    await expect(page.getByTestId('certificate-panel')).toContainText('A certificate cannot exceed the claim');
    await expect(status(page)).toHaveText('Submitted');
    const certified = v6.due - 2_912_500; // the principal agent certifies R29,125 less
    await amount.fill(String(certified / 100));
    await page.getByTestId('record-certificate').click();
    await expect(status(page)).toHaveText('Certified');
    const cert = page.getByTestId('certificate-totals');
    await expect(cert.locator('.row', { hasText: 'Certified less than claimed by' })).toContainText('R29,125.00');
    expect(cents(await cert.locator('.grand b').textContent())).toBe(certified + Math.round((certified * 15) / 100));
    await step(page, 'Mark paid').click();
    await expect(status(page)).toHaveText('Paid');
    await expect(cert.locator('.grand')).toContainText('Paid incl. VAT');

    // The next valuation starts from the project and deducts what has now been certified.
    await page.goto('#/construction/projects/projects_1');
    await page.getByRole('button', { name: 'New valuation' }).click();
    await expect(page.locator('#f_valuationNo')).toHaveValue('7');
    const workDone = Number(await page.locator('#f_workDone').inputValue());
    await page.locator('#f_workDone').fill(String(workDone + 400000));
    await page.getByTestId('save-record').click();
    await expect(heading(page)).toHaveText(/Valuation 7 — Umgeni Ridge Primary/);
    const v7 = await checkValuationAddsUp(page, 5);
    expect(v7.previous).toBe(v6.previous + certified);
    await step(page, 'Submit valuation').click();
    await expect(status(page)).toHaveText('Submitted');

    // Only one open valuation per project.
    await page.goto('#/construction/projects/projects_1');
    await expect(page.getByRole('button', { name: 'New valuation' })).toBeDisabled();
    await expect(page.locator('.panel', { hasText: 'Payment valuations' }).last()).toContainText('only one open valuation per project');
    expect(errors).toEqual([]);
  });

  test('snags: fix and verify the critical snag, then practical completion unblocks', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/construction');
    await page.getByTestId('guide-step-4').click(); // Heinrich van der Merwe, PM — warehouse
    await step(page, 'Certify practical completion').click();
    await expect(toast(page)).toContainText('1 critical snag still open (SNG-0016)');
    await expect(status(page)).toHaveText('On site');
    await page.getByTestId('completion-checks').getByRole('link', { name: /SNG-0016/ }).click();
    await expect(heading(page)).toHaveText('Fire door to stair 2 not self-closing');
    await expect(page.getByTestId('snag-panel')).toContainText('practical completion of Rietvlei Business Park — Unit C warehouse is blocked');
    await step(page, 'Mark fixed').click();
    await expect(status(page)).toHaveText('Fixed — awaiting check');
    await step(page, 'Verify fix').click();
    await page.getByLabel('Transition note').fill('Closer replaced and door tested with the fire officer.');
    await page.getByTestId('confirm-transition').click();
    await expect(status(page)).toHaveText('Verified closed');
    await page.getByTestId('snag-panel').getByRole('link', { name: /Rietvlei Business Park/ }).click();
    await expect(blocked(page)).toHaveCount(0);
    await expect(page.getByTestId('completion-checks')).toContainText('None open');
    await step(page, 'Certify practical completion').click();
    await expect(status(page)).toHaveText('Practical completion');

    // An uncategorised snag blocks it too; one click on the snag categorises it.
    await page.goto('#/construction/projects/projects_1');
    await expect(blocked(page)).toContainText('1 snag not categorised (SNG-0021)');
    await page.getByTestId('completion-checks').getByRole('link', { name: /SNG-0021/ }).click();
    await page.getByTestId('snag-category').getByRole('button', { name: 'Minor' }).click();
    await expect(page.getByTestId('snag-panel').locator('.panel-head .tag')).toHaveText('Minor');
    await page.getByTestId('snag-panel').getByRole('link', { name: /Umgeni Ridge Primary/ }).click();
    await expect(blocked(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('procurement: requisition → approve → purchase order → receive with delivery note', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/construction/procurement');
    await signInAs(page, 'u_sa'); // the site agent raises it
    await page.getByTestId('new-record').click();
    await page.locator('#f_project').selectOption('projects_1');
    await page.locator('#f_description').fill('Paving bricks for the entrance (journey test)');
    await page.getByRole('button', { name: 'Add line' }).click();
    await page.getByLabel('Line 1 description').fill('60 mm interlocking paver (m²)');
    await page.getByLabel('Line 1 quantity').fill('100');
    await page.getByLabel('Line 1 unit price').fill('180');
    await page.getByTestId('save-record').click();
    await expect(heading(page)).toHaveText('Paving bricks for the entrance (journey test)');
    await expect(status(page)).toHaveText('Requested');
    await expect(kv(page.getByTestId('req-panel'), 'Value excl. VAT')).toHaveText('R18,000.00');
    await expect(kv(page.getByTestId('req-panel'), 'Incl. VAT')).toHaveText('R20,700.00');
    await expect(kv(page.locator('.panel', { hasText: 'Details' }).first(), 'Requested by')).toHaveText('Sizwe Ndlovu'); // filled in from the signed-in user
    await expect(step(page, 'Approve requisition')).toBeDisabled();
    await expect(page.getByTestId('req-panel')).toContainText('Waiting for approval by');

    await signInAs(page, 'u_pm1');
    await step(page, 'Approve requisition').click();
    await expect(status(page)).toHaveText('Approved');
    await expect(page.locator('.panel', { hasText: 'Issue the purchase order' })).toContainText('Fatima Davids'); // who issues it

    await signInAs(page, 'u_ps');
    await step(page, 'Issue purchase order').click();
    await expect(toast(page)).toContainText('Select the supplier');
    await page.getByTestId('issue-po').click();
    await expect(page.getByTestId('po-form')).toContainText('Select the supplier.');
    await page.getByTestId('po-form').getByLabel('Supplier').selectOption('highveld');
    await page.getByTestId('issue-po').click();
    await expect(status(page)).toHaveText('PO issued');
    await expect(kv(page.getByTestId('req-panel'), 'PO number (demo)')).toHaveText('PO-DEMO-0014');

    await step(page, 'Receive in full').click();
    await expect(toast(page)).toContainText('delivery note number');
    await page.getByTestId('receive-full').click();
    await expect(page.getByTestId('receive-form')).toContainText('delivery note number');
    await page.getByLabel('Delivery note number').fill('HBB-DN-50001');
    await page.getByTestId('receive-full').click();
    await expect(status(page)).toHaveText('Delivered');
    await expect(kv(page.getByTestId('req-panel'), 'Delivery note')).toHaveText('HBB-DN-50001');
    expect(errors).toEqual([]);
  });

  test('plant: off-hiring a hired item stops the hire cost', async ({ page }) => {
    await page.goto('#/construction');
    await page.getByTestId('guide-step-6').click(); // Sizwe Ndlovu — idle hired excavator past its off-hire date
    const hire = page.locator('.panel', { hasText: 'Running hire cost' });
    const days = Number(await kv(hire, 'Days on hire').textContent());
    const rate = cents(await kv(hire, 'Daily rate').textContent());
    expect(cents(await page.getByTestId('hire-cost').textContent())).toBe(days * rate);
    await page.getByTestId('off-hire').click();
    await expect(toast(page)).toContainText('Off-hired');
    const done = page.locator('.panel', { hasText: 'Final hire cost' });
    await expect(done.locator('.panel-head .tag')).toHaveText('Off-hired / returned');
    expect(cents(await page.getByTestId('hire-cost').textContent())).toBe(days * rate);
    await expect(page.getByTestId('off-hire')).toHaveCount(0);
    await expect(page.locator('.timeline')).toContainText('arrange collection with the hire company');

    // A project manager can see hired plant but is told who off-hires it.
    await signInAs(page, 'u_pm1');
    await page.goto('#/construction/plant/plant_8');
    await expect(page.getByTestId('off-hire')).toHaveCount(0);
    await expect(page.locator('.panel', { hasText: 'Running hire cost' })).toContainText(/off-hired by .*Sizwe Ndlovu \(Site agent\)/);
  });

  test('roles: the safety officer sees their own modules and is told who does the rest', async ({ page }) => {
    await page.goto('#/construction');
    await signInAs(page, 'u_so');
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'Health & safety' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Payment valuations' })).toHaveCount(0);
    await page.goto('#/construction/valuations');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await page.goto('#/construction/snags');
    await expect(page.getByTestId('new-record')).toHaveCount(0);
    await expect(page.getByRole('note').filter({ hasText: 'You can follow snag lists here' })).toBeVisible();
    // Their own job works: close out a near miss only once a corrective action is recorded.
    await page.goto('#/construction/safety/safety_8');
    await step(page, 'Close out').click();
    await expect(toast(page)).toContainText('Record the corrective action');
    await expect(status(page)).toHaveText('Open');
    await page.getByTestId('safety-panel').getByLabel('Corrective action').fill('Exclusion zone marked under telehandler lifts; banksman appointed.');
    await page.getByTestId('save-safety').click();
    await expect(blocked(page)).toHaveCount(0);
    await step(page, 'Close out').click();
    await expect(status(page)).toHaveText('Closed out');

    // A project manager can read valuations; the screen says the QS runs them.
    await signInAs(page, 'u_pm1');
    await page.goto('#/construction/valuations/valuations_6');
    await expect(step(page, 'Submit valuation')).toBeDisabled();
    await expect(page.getByRole('note').filter({ hasText: 'Valuations are prepared' })).toContainText('Lindiwe Mahlangu');
  });

  test('mobile: dashboard, site diary, a valuation and a project fit a 390 px screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/construction', '#/construction/diary', '#/construction/valuations/valuations_6', '#/construction/projects/projects_2', '#/construction/variations']) {
      await page.goto(path);
      await expect(heading(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByLabel('Main navigation').getByRole('link', { name: 'Site diary' }).click();
    await expect(page.getByRole('heading', { name: 'Site diary', level: 1 })).toBeVisible();
  });
});
