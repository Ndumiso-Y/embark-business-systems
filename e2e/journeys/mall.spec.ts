import { expect, test, type Page } from '@playwright/test';

// Harbour Crossing Mall: the journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage). The guided records (leases_1, leases_2, cases_1,
// permits_1), the prospects, the bookings and the shops still waiting for a meter reading are the same
// on every day of the week and month, and month names are only matched by pattern, so nothing here
// depends on the date or the time of day.

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
const modal = (page: Page) => page.locator('.modal');
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
/** Local date `offset` days from today, as the browser sees it. */
const day = (page: Page, offset = 0) => page.evaluate((n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, offset);
const openGuide = async (page: Page, n: number) => { await page.goto('#/mall'); await page.getByTestId(`guide-step-${n}`).click(); };
const plan = (page: Page, shop: string) => page.getByTestId(`plan-${shop}`);
/** Open the register row that contains `text` (first match). */
const openRow = (page: Page, table: string, text: string) => page.getByTestId(table).locator('tbody tr', { hasText: text }).first().click();
const note = async (page: Page, text: string) => { await page.getByLabel('Transition note').fill(text); await page.getByTestId('confirm-transition').click(); };

// Optional: E2E_FAKE_NOW=2026-10-31T23:10:00 runs the journeys on another day / time of day.
const FAKE_NOW = process.env.E2E_FAKE_NOW;

test.describe('Shopping centre journeys', () => {
  test.beforeEach(async ({ page }) => {
    if (FAKE_NOW) await page.clock.install({ time: new Date(FAKE_NOW) });
  });

  test('guide: all six steps open the right screen as the right person', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mall');
    await expect(page.getByTestId('guide')).toContainText('Try these 6 things');
    const steps: Array<[number, string, string | RegExp, string]> = [
      [1, 'u_la', 'Shops & stacking plan', '#/mall/units'],
      [2, 'u_lm', 'Ember Athletica', '#/mall/leases/leases_2'],
      [3, 'u_ops', 'Utilities metering', '#/mall/meters'],
      [4, 'u_acc', 'Monthly billing', '#/mall/billing'],
      [5, 'u_acc', /The Copper Skillet/, '#/mall/arrears/cases_1'],
      [6, 'u_tc', /Hot work — ClearView Shopfronts/, '#/mall/permits/permits_1'],
    ];
    for (const [n, who, title, hash] of steps) {
      await openGuide(page, n);
      await expect(page.getByTestId('user-switcher')).toHaveValue(who);
      await expect(heading(page)).toContainText(title);
      expect(page.url()).toContain(hash);
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    }
    // Each one starts where the guide says it does.
    await openGuide(page, 2);
    await expect(status(page)).toHaveText('Fit-out');
    await expect(panel(page, 'Before the shop can trade').locator('.panel-head .tag')).toHaveText('2 outstanding');
    await openGuide(page, 3);
    await expect(page.getByTestId('readings-waiting').locator('li')).toHaveCount(4);
    await openGuide(page, 4);
    await expect(page.getByTestId('draft-invoices')).toHaveText('Draft this month’s invoices (58)');
    await openGuide(page, 5);
    await expect(status(page)).toHaveText('Reminder logged');
    await openGuide(page, 6);
    await expect(status(page)).toHaveText('Requested');
    expect(errors).toEqual([]);
  });

  test('guide 1 — stacking plan: a vacant shop over 500 m² needs a credit check and the leasing manager before heads of terms', async ({ page }) => {
    const errors = watchErrors(page);
    await openGuide(page, 1);
    await expect(page.getByTestId('plan-legend')).toContainText('Vacant (4)');
    await expect(plan(page, 'G14')).toHaveAttribute('data-status', 'vacant');
    await plan(page, 'G14').click();
    const summary = page.getByTestId('unit-summary');
    await expect(summary).toContainText('Shop G14');
    await expect(summary).toContainText('Application from Paper Lantern Stationers');
    await page.getByTestId('open-application').click();
    await expect(heading(page)).toHaveText('Paper Lantern Stationers');
    await expect(status(page)).toHaveText('Application');

    // Refused: no credit check. The fix is a button on the same screen.
    await step(page, 'Agree heads of terms').click();
    await expect(toast(page)).toContainText('An approved credit check is needed first');
    await page.getByTestId('credit-approved').click();
    // Refused again: 620 m² is above the approval limit and the administrator cannot approve it.
    await step(page, 'Agree heads of terms').click();
    await expect(toast(page)).toContainText('above 500 m² needs the leasing manager’s approval');
    await expect(page.getByTestId('approve-letting')).toHaveCount(0);
    await expect(page.getByTestId('approval-hint')).toContainText('Pieter van der Walt');
    await signInAs(page, 'u_lm');
    await page.getByTestId('approve-letting').click();
    await expect(panel(page, 'Before heads of terms')).toContainText('Approved by Pieter van der Walt');
    await step(page, 'Agree heads of terms').click();
    await expect(status(page)).toHaveText('Heads of terms');
    await expect(anyToast(page, 'Shop G14 is now under offer to Paper Lantern Stationers')).toBeVisible();

    // The unit followed the lease.
    await page.goto('#/mall/units');
    await expect(plan(page, 'G14')).toHaveAttribute('data-status', 'offer');
    await expect(page.getByTestId('plan-legend')).toContainText('Vacant (3)');
    await expect(page.getByTestId('plan-legend')).toContainText('Under offer (3)');
    // Colouring by category keeps every shop on the plan.
    await page.getByRole('button', { name: 'By category' }).click();
    await expect(page.getByTestId('plan-legend')).toContainText('Food court');
    await expect(page.getByTestId('stacking-plan').locator('button')).toHaveCount(66);
    await page.reload();
    await expect(plan(page, 'G14')).toHaveAttribute('data-status', 'offer');
    expect(errors).toEqual([]);
  });

  test('prospect → application → heads of terms → signed → fit-out → trading: the vacant unit ends up let', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mall/pipeline/prospects_2');
    await expect(heading(page)).toHaveText('Marula & Mint Skincare');
    await expect(status(page)).toHaveText('Proposal sent');
    await expect(panel(page, 'Unit of interest')).toContainText('Shop L09');
    await step(page, 'Take lease application').click();
    await expect(anyToast(page, /Lease application LS-\d+ opened for Shop L09/)).toBeVisible();
    await expect(status(page)).toHaveText('Application taken');
    await page.getByTestId('open-lease').click();
    await expect(heading(page)).toHaveText('Marula & Mint Skincare');
    await expect(status(page)).toHaveText('Application');
    await expect(panel(page, 'Rent & charges')).toContainText('R365.00/m²'); // the unit's asking rent

    // Heads of terms: a small shop only needs the credit check.
    await step(page, 'Agree heads of terms').click();
    await expect(toast(page)).toContainText('approved credit check');
    await page.getByTestId('credit-approved').click();
    await step(page, 'Agree heads of terms').click();
    await expect(status(page)).toHaveText('Heads of terms');

    // Signing: deposit or guarantee, then FICA — both on this screen.
    await step(page, 'Lease signed').click();
    await expect(toast(page)).toContainText('Record the deposit or bank guarantee received');
    await page.getByTestId('deposit-type').selectOption('guarantee');
    await page.getByTestId('record-deposit').click();
    await expect(panel(page, 'Before the lease can be signed')).toContainText(/Bank guarantee of R[\d,]+\.00 · DEMO-BG-/);
    await step(page, 'Lease signed').click();
    await expect(toast(page)).toContainText('FICA documents are not verified');
    await page.getByTestId('fica-verified').click();
    await step(page, 'Lease signed').click();
    await expect(status(page)).toHaveText('Lease signed');

    // Hand-over opens the fit-out project; trading is refused until it is signed off.
    await step(page, 'Hand over for fit-out').click();
    await expect(status(page)).toHaveText('Fit-out');
    await expect(anyToast(page, /Fit-out project FO-\d+ opened/)).toBeVisible();
    await step(page, 'Start trading').click();
    await expect(toast(page)).toContainText(/The fit-out \(FO-\d+\) is not signed off yet/);
    await page.getByTestId('open-fitout').click();
    await expect(status(page)).toHaveText('Drawings submitted');
    await step(page, 'Approve drawings').click();
    await step(page, 'Contractor inducted').click();
    await expect(toast(page)).toContainText('Name the fit-out contractor');
    await page.getByTestId('fitout-contractor').fill('Shopfit Squared');
    await page.getByTestId('fitout-insurance').fill(await day(page, 200));
    await page.getByTestId('fitout-inducted').check();
    await page.getByTestId('save-fitout-contractor').click();
    await expect(panel(page, 'Contractor on site').locator('.panel-head .tag')).toHaveText('Cleared for site');
    await step(page, 'Contractor inducted').click();
    await step(page, 'Start works').click();
    await step(page, 'Works complete — start snagging').click();
    await expect(status(page)).toHaveText('Snagging');
    await step(page, 'Sign off fit-out').click();
    await expect(toast(page)).toContainText('Snags are still open');
    await page.getByTestId('snags').fill('Signage timer not set');
    await page.getByTestId('snags-cleared').check();
    await page.getByTestId('save-snags').click();
    await step(page, 'Sign off fit-out').click();
    await expect(status(page)).toHaveText('Signed off');

    // Back on the lease: certificate of occupancy and tenant insurance, then the shop opens.
    await page.getByTestId('open-lease').click();
    await expect(panel(page, 'Before the shop can trade').locator('.panel-head .tag')).toHaveText('2 outstanding');
    await page.getByTestId('coo-number').fill('12345');
    await page.getByTestId('save-coo').click();
    await expect(toast(page)).toContainText('starts with DEMO-COO-');
    await page.getByTestId('coo-number').fill('DEMO-COO-0412');
    await page.getByTestId('save-coo').click();
    await step(page, 'Start trading').click();
    await expect(toast(page)).toContainText('insurance is not on file');
    await page.getByTestId('insurance-expiry').fill(await day(page, 365));
    await page.getByTestId('save-insurance').click();
    await expect(panel(page, 'Before the shop can trade').locator('.panel-head .tag')).toHaveText('Ready to trade');
    await step(page, 'Start trading').click();
    await expect(status(page)).toHaveText('Trading');
    await expect(anyToast(page, 'Shop L09 now shows as let')).toBeVisible();

    await page.goto('#/mall/units');
    await expect(plan(page, 'L09')).toHaveAttribute('data-status', 'let');
    await expect(plan(page, 'L09')).toContainText('Marula & Mint Skincare');
    await expect(page.getByTestId('plan-legend')).toContainText('Vacant (3)');
    // The vacancy list no longer offers the shop, and the next month-end run includes the new tenant.
    await page.goto('#/mall/pipeline');
    await expect(page.getByTestId('vacancy-list')).not.toContainText('Shop L09');
    await page.goto('#/mall/billing');
    await expect(page.getByTestId('draft-invoices')).toHaveText('Draft this month’s invoices (59)');
    expect(errors).toEqual([]);
  });

  test('guide 2 — a shop only opens with fit-out sign-off, a certificate of occupancy number and tenant insurance', async ({ page }) => {
    await openGuide(page, 2);
    await expect(panel(page, 'Before the shop can trade')).toContainText(/FO-0001 · Signed off on \d\d \w{3} \d{4}/);
    await step(page, 'Start trading').click();
    await expect(toast(page)).toContainText('Record the certificate of occupancy number');
    await page.getByTestId('coo-number').fill('DEMO-COO-0777');
    await page.getByTestId('save-coo').click();
    await step(page, 'Start trading').click();
    await expect(toast(page)).toContainText('insurance is not on file');
    // Expired cover does not count.
    await page.getByTestId('insurance-expiry').fill(await day(page, -3));
    await page.getByTestId('save-insurance').click();
    await expect(toast(page)).toContainText('expired cover does not count');
    await page.getByTestId('insurance-expiry').fill(await day(page, 180));
    await page.getByTestId('save-insurance').click();
    await step(page, 'Start trading').click();
    await expect(status(page)).toHaveText('Trading');
    await page.goto('#/mall/units');
    await expect(plan(page, 'U06')).toHaveAttribute('data-status', 'let');
    await expect(page.getByTestId('plan-legend')).toContainText('Fit-out (1)');
  });

  test('guide 3 & 4 — meter readings and a verified turnover declaration feed the month’s invoices; issue and collect', async ({ page }) => {
    const errors = watchErrors(page);
    // Operations manager: readings.
    await openGuide(page, 3);
    const row = page.getByTestId('reading-row-F05');
    await expect(row).toContainText('Burger Buoy');
    const prevElec = Number(await row.getAttribute('data-prev-elec'));
    const prevWater = Number(await row.getAttribute('data-prev-water'));
    const lastUsed = Number(await row.getAttribute('data-last-used'));
    expect(prevElec).toBeGreaterThan(0);
    await page.getByTestId('elec-F05').fill(String(prevElec - 10));
    await page.getByTestId('water-F05').fill(String(prevWater + 45));
    await page.getByTestId('capture-F05').click();
    await expect(toast(page)).toContainText('a meter cannot run backwards');
    await expect(row).toContainText('is below the previous reading');
    await page.getByTestId('elec-F05').fill(String(prevElec + lastUsed + 80));
    await page.getByTestId('capture-F05').click();
    await expect(anyToast(page, /Shop F05: reading captured — [\d ]+ kWh used/)).toBeVisible();
    await expect(page.getByTestId('readings-waiting').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('captured-F05')).toContainText('kWh');
    // A jump of more than 40% is captured but flagged until someone reviews it.
    const g07 = page.getByTestId('reading-row-G07');
    const g07Prev = Number(await g07.getAttribute('data-prev-elec'));
    const g07Used = Number(await g07.getAttribute('data-last-used'));
    await page.getByTestId('elec-G07').fill(String(g07Prev + g07Used * 2));
    await page.getByTestId('capture-G07').click();
    await expect(anyToast(page, /Usage is \+\d+% against last month — flagged for review/)).toBeVisible();
    await expect(page.getByTestId('captured-G07')).toContainText('review');
    await page.getByTestId('review-G07').click();
    await expect(page.getByTestId('captured-G07')).toContainText('reviewed by Rajesh Naidoo');
    await expect(page.getByTestId('readings-waiting').locator('li')).toHaveCount(2);

    // Credit controller: verify Indigo Reef's declared turnover — it is above the breakpoint.
    await signInAs(page, 'u_acc');
    await page.goto('#/mall/turnover');
    await page.getByTestId('turnover-todo').getByRole('link', { name: 'Indigo Reef' }).click();
    await expect(status(page)).toHaveText('Declared');
    await expect(panel(page, 'What this figure means').locator('.panel-head .tag')).toHaveText('Above breakpoint');
    await step(page, 'Verify').click();
    await expect(status(page)).toHaveText('Verified');
    await expect(anyToast(page, /Verified — turnover rent of R[\d,.]+ will be on the next invoice/)).toBeVisible();

    // Month-end run.
    await openGuide(page, 4);
    await expect(page.getByTestId('run-warnings')).toContainText(/2 shops have no \w{3} \d{4} meter reading/);
    await expect(page.getByTestId('run-warnings')).toContainText(/8 turnover declarations for \w{3} \d{4} are not verified/);
    await page.getByTestId('draft-invoices').click();
    await expect(toast(page)).toContainText(/58 draft invoices created for \w{3} \d{4}/);
    await expect(page.getByTestId('draft-invoices')).toBeDisabled();
    await expect(page.getByTestId('run-summary')).toContainText('Every trading lease already has an invoice');
    await expect(page.getByTestId('table-invoices').locator('tbody tr')).toHaveCount(58);

    // A shop with no reading still drafts, with a note instead of a utilities line.
    await openRow(page, 'table-invoices', 'KeyCraft Locksmiths');
    await expect(status(page)).toHaveText('Draft');
    await expect(page.getByTestId('billing-notes')).toContainText('no meter reading captured for Shop L11');
    await expect(page.getByTestId('invoice-lines')).not.toContainText('Electricity');
    // A completed tenant-responsibility repair is recharged.
    await page.goto('#/mall/billing');
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await openRow(page, 'table-invoices', 'Saffron Thread');
    await expect(page.getByTestId('invoice-lines')).toContainText('Recharge WO-0015 — Replace the cracked shopfront glass panel');

    // The reading arrives after the draft was made: capture it and the draft offers the utilities line.
    await signInAs(page, 'u_cm');
    await page.goto('#/mall/meters');
    const l11Prev = Number(await page.getByTestId('reading-row-L11').getAttribute('data-prev-elec'));
    await page.getByTestId('elec-L11').fill(String(l11Prev + 1500));
    await page.getByTestId('capture-L11').click();
    await expect(page.getByTestId('readings-waiting').locator('li')).toHaveCount(1);
    await page.goto('#/mall/billing');
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await openRow(page, 'table-invoices', 'KeyCraft Locksmiths');
    await expect(page.getByTestId('catch-up')).toContainText('Electricity');
    await page.getByTestId('add-catch-up').click();
    await expect(page.getByTestId('invoice-lines').locator('tr[data-line="elec"]')).toContainText('1 500');
    await expect(page.getByTestId('billing-notes')).toHaveCount(0);
    await expect(page.getByTestId('catch-up')).toHaveCount(0);
    // A once-off charge is added on the draft itself.
    await page.getByTestId('add-charge').click();
    await expect(toast(page)).toContainText('Type what the charge is for');
    await page.getByTestId('charge-description').fill('After-hours air-conditioning');
    await page.getByTestId('charge-amount').fill('850');
    await page.getByTestId('add-charge').click();
    await expect(page.getByTestId('invoice-lines')).toContainText('After-hours air-conditioning');
    await signInAs(page, 'u_acc');

    // Indigo Reef: rent, recoveries, metered electricity and the turnover rent just verified.
    await page.goto('#/mall/billing');
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await openRow(page, 'table-invoices', 'Indigo Reef');
    const lines = page.getByTestId('invoice-lines');
    for (const text of ['Base rent', 'Operating costs recovery', 'Marketing levy', 'Electricity', 'Turnover rent']) await expect(lines).toContainText(text);
    await expect(lines.locator('tr[data-line="rent"]')).toContainText('380'); // m²
    await step(page, 'Issue invoice (simulated)').click();
    await expect(status(page)).toHaveText('Issued');

    // Payments: never more than the balance; part payment, then the rest.
    const amount = page.getByTestId('payment-amount');
    const balance = Number(await amount.inputValue());
    expect(balance).toBeGreaterThan(100000);
    await amount.fill(String(balance + 1));
    await page.getByTestId('record-payment').click();
    await expect(toast(page)).toContainText('is more than the balance');
    await expect(status(page)).toHaveText('Issued');
    await amount.fill('50000');
    await page.getByTestId('record-payment').click();
    await expect(status(page)).toHaveText('Part paid');
    await expect(page.getByTestId('invoice-lines')).toContainText('Paid so far');
    await expect(page.getByTestId('payment-amount')).toHaveValue(String(Math.round((balance - 50000) * 100) / 100));
    await page.getByTestId('record-payment').click();
    await expect(status(page)).toHaveText('Paid');
    await expect(page.getByTestId('payment-amount')).toHaveCount(0);
    await expect(panel(page, 'History')).toContainText('Part payment of R50,000.00 received');

    // Issue the rest in one go; the dashboard now shows the month as billed.
    await page.goto('#/mall/billing');
    await page.getByTestId('issue-drafts').click();
    await expect(toast(page)).toContainText('57 invoices issued');
    await page.goto('#/mall');
    await expect(page.locator('.stat', { hasText: 'Billed ·' })).toContainText(/R\d+\.\dm/);
    await expect(page.locator('.stat', { hasText: 'Billed ·' })).toContainText('collected');
    await page.reload();
    await expect(page.locator('.stat', { hasText: 'Billed ·' })).not.toContainText('Not drafted');
    expect(errors).toEqual([]);
  });

  test('guide 5 — arrears: reminder preview, letter of demand, payment arrangement; a new case for a tenant with none', async ({ page }) => {
    const errors = watchErrors(page);
    await openGuide(page, 5);
    await expect(panel(page, 'Overdue invoices').locator('.panel-head .tag')).toContainText('overdue');
    await expect(page.getByTestId('case-invoices').locator('li')).toHaveCount(4);
    await expect(panel(page, 'Ageing').locator('.panel-head .tag')).toHaveText('Over 90 days');
    await expect(page.getByTestId('reminder-preview')).toContainText('Our records at Harbour Crossing Mall show');
    await expect(panel(page, 'Reminder to the tenant')).toContainText('Preview only — no email, SMS or letter is sent');
    await step(page, 'Log letter of demand').click();
    await expect(status(page)).toHaveText('Letter of demand');
    // The arrangement needs its terms, typed on this screen.
    await step(page, 'Record payment arrangement').click();
    await expect(toast(page)).toContainText('Type the monthly instalment');
    await page.getByTestId('instalment').fill('25000');
    await page.getByTestId('first-payment').fill(await day(page, 7));
    await page.getByTestId('save-arrangement').click();
    await step(page, 'Record payment arrangement').click();
    await expect(status(page)).toHaveText('Payment arrangement');
    // It cannot be settled while money is owed; handing over needs a note.
    await step(page, 'Mark settled').click();
    await expect(toast(page)).toContainText('The Copper Skillet still owes');
    await step(page, 'Hand over to attorneys').click();
    await page.getByTestId('confirm-transition').click();
    await expect(modal(page)).toContainText('A note is required');
    await note(page, 'Handed to Fynbos & Partners (fictional) after two missed instalments; landlord approved.');
    await expect(status(page)).toHaveText('Handed over');

    // The ageing table: a tenant with no case yet gets one from the list.
    await page.goto('#/mall/arrears');
    const table = page.getByTestId('arrears-table');
    await expect(table.locator('tbody tr').first()).toContainText('The Copper Skillet');
    await expect(table.locator('tbody tr', { hasText: 'The Copper Skillet' })).toContainText('Handed over');
    await table.locator('tbody tr', { hasText: 'Signal Cove Mobile' }).getByRole('button', { name: 'Open case' }).click();
    await expect(heading(page)).toContainText('Signal Cove Mobile');
    await expect(status(page)).toHaveText('New arrears');
    await step(page, 'Log reminder (nothing is sent)').click();
    await expect(status(page)).toHaveText('Reminder logged');
    // Paying the invoice from the case clears the arrears, and then the case can be settled.
    await page.getByTestId('case-invoices').getByRole('link').first().click();
    await page.getByTestId('record-payment').click();
    await expect(status(page)).toHaveText('Paid');
    await page.goto('#/mall/arrears');
    await expect(page.getByTestId('arrears-table')).not.toContainText('Signal Cove Mobile');
    await page.getByTestId('table-cases').locator('tbody tr', { hasText: 'Signal Cove Mobile' }).click();
    await expect(panel(page, 'Overdue invoices').locator('.panel-head .tag')).toHaveText('Nothing overdue');
    await step(page, 'Mark settled').click();
    await expect(status(page)).toHaveText('Settled');
    expect(errors).toEqual([]);
  });

  test('maintenance: a tenant request from logged to tenant-confirmed, and a tenant-responsibility job that is recharged', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mall/workorders');
    await signInAs(page, 'u_tc');
    await page.getByTestId('new-record').click();
    await modal(page).getByLabel('What is wrong').fill('Ceiling light panel flickering over the till');
    await modal(page).getByLabel('Unit (leave empty for a common area)').selectOption({ label: 'Shop G04 · SH-0020' });
    await modal(page).getByLabel('Category').selectOption('electrical');
    await modal(page).getByLabel('Priority').selectOption('urgent');
    await page.getByTestId('save-record').click();
    await expect(toast(page)).toContainText(/Work order WO-\d+ created/);
    await expect(status(page)).toHaveText('Logged');
    await expect(panel(page, 'Shop & tenant')).toContainText('Indigo Reef');

    // Responsibility first.
    await step(page, 'Mark assessed').click();
    await expect(toast(page)).toContainText('Decide who is responsible first');
    await page.getByTestId('resp-landlord').click();
    await expect(panel(page, 'Assessment').locator('.panel-head .tag')).toHaveText('Landlord’s responsibility');
    await step(page, 'Mark assessed').click();
    await expect(status(page)).toHaveText('Assessed');
    await step(page, 'Assign contractor').click();
    await expect(toast(page)).toContainText('Name the contractor under “Contractor” first');
    await page.getByTestId('contractor').fill('Voltline Electrical');
    await page.getByTestId('save-contractor').click();
    await step(page, 'Assign contractor').click();
    await expect(status(page)).toHaveText('Assigned');
    await step(page, 'Work started').click();
    await step(page, 'Work completed').click();
    await expect(status(page)).toHaveText('Completed');
    await step(page, 'Log tenant confirmation').click();
    await expect(status(page)).toHaveText('Tenant confirmed');
    await page.reload();
    await expect(status(page)).toHaveText('Tenant confirmed');

    // Tenant responsibility (seeded blocked drain): a recharge must be agreed, or the job closed with a note.
    await page.goto('#/mall/workorders/workorders_5');
    await expect(panel(page, 'Assessment').locator('.panel-head .tag')).toHaveText('Tenant’s responsibility');
    await step(page, 'Assign contractor').click();
    await expect(toast(page)).toContainText('either agree a recharge amount');
    await page.getByTestId('recharge-amount').fill('1250');
    await page.getByTestId('save-recharge').click();
    await page.getByTestId('contractor').fill('PipeWright Plumbing');
    await page.getByTestId('save-contractor').click();
    await step(page, 'Assign contractor').click();
    await expect(status(page)).toHaveText('Assigned');
    await step(page, 'Work started').click();
    await step(page, 'Work completed').click();
    await expect(anyToast(page, 'R1,250.00 will be recharged on the tenant’s next invoice')).toBeVisible();
    await expect(panel(page, 'Assessment')).toContainText('it goes onto this tenant’s invoice at the next month-end run');
    // The other way out: close a tenant job with a note.
    await page.goto('#/mall/workorders');
    await page.getByTestId('new-record').click();
    await modal(page).getByLabel('What is wrong').fill('Tenant’s own display fridge tripping the plugs');
    await modal(page).getByLabel('Unit (leave empty for a common area)').selectOption({ label: 'Shop G04 · SH-0020' });
    await page.getByTestId('save-record').click();
    await step(page, 'Close — tenant to attend').click();
    await expect(toast(page)).toContainText('Only a tenant-responsibility job is closed this way');
    await page.getByTestId('resp-tenant').click();
    await step(page, 'Close — tenant to attend').click();
    await note(page, 'Tenant’s own appliance: asked to have it repaired and to send an electrician’s report by Friday.');
    await expect(status(page)).toHaveText('Closed — tenant to attend');
    expect(errors).toEqual([]);
  });

  test('guide 6 — hot-work permit: insurance and fire watch before approval, its own dates before it is active, fire watch before it closes', async ({ page }) => {
    const errors = watchErrors(page);
    await openGuide(page, 6);
    await expect(panel(page, 'Before approval').locator('.panel-head .tag')).toHaveText('2 outstanding');
    await step(page, 'Approve permit').click();
    await expect(toast(page)).toContainText(/public-liability insurance expires on .* before the work ends/);
    await page.getByTestId('permit-insurance').fill(await day(page, 120));
    await page.getByTestId('save-permit-insurance').click();
    await step(page, 'Approve permit').click();
    await expect(toast(page)).toContainText('Hot work needs a named fire watch');
    await page.getByTestId('fire-watch').fill('Sipho Mabena (ClearView)');
    await page.getByTestId('save-fire-watch').click();
    await expect(panel(page, 'Before approval').locator('.panel-head .tag')).toHaveText('Ready to approve');
    await step(page, 'Approve permit').click();
    await expect(status(page)).toHaveText('Approved');
    // It is for tomorrow, so it cannot be made active today — unless the dates are moved on this screen.
    await step(page, 'Make active').click();
    await expect(toast(page)).toContainText('This permit is only valid from');
    await page.getByTestId('start-today').click();
    await page.getByTestId('save-dates').click();
    await step(page, 'Make active').click();
    await expect(status(page)).toHaveText('Active');
    await step(page, 'Close permit').click();
    await expect(toast(page)).toContainText('Confirm the fire watch stayed for 60 minutes');
    await page.getByTestId('confirm-fire-watch').click();
    await step(page, 'Close permit').click();
    await expect(status(page)).toHaveText('Closed');

    // A sprinkler isolation needs a reinstatement date and time; an expired permit is called out.
    await page.goto('#/mall/permits/permits_2');
    await step(page, 'Approve permit').click();
    await expect(toast(page)).toContainText('A sprinkler isolation needs a reinstatement date and time');
    await page.getByTestId('reinstate-time').fill('05:30');
    await page.getByTestId('save-reinstate').click();
    await step(page, 'Approve permit').click();
    await expect(status(page)).toHaveText('Approved');
    await page.goto('#/mall/permits/permits_5');
    await expect(page.locator('.notice.red')).toContainText('Expired but still active');
    await page.goto('#/mall');
    await expect(page.getByTestId('attention-list')).toContainText('WP-0005 expired but still active');
    expect(errors).toEqual([]);
  });

  test('exhibitions: a clashing booking is refused until its space or dates change; the deposit comes first', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mall/bookings');
    await signInAs(page, 'u_mkt');
    await expect(page.getByTestId('space-calendar')).toContainText('Evergreen Vehicle Display');
    await page.getByTestId('new-record').click();
    await modal(page).getByLabel('Exhibitor (fictional)').fill('Lumo Lights Showcase');
    await modal(page).getByLabel('Space').selectOption('court-g');
    await modal(page).getByLabel('From').fill(await day(page, 11)); // inside the confirmed vehicle display (days 10–16)
    await modal(page).getByLabel('To', { exact: true }).fill(await day(page, 13));
    await page.getByTestId('save-record').click();
    await expect(status(page)).toHaveText('Enquiry');
    await expect(page.getByTestId('clash-notice')).toContainText('already booked by Evergreen Vehicle Display');
    await step(page, 'Send quote (simulated)').click();
    await expect(status(page)).toHaveText('Quoted');
    await page.getByTestId('deposit-received').click();
    await step(page, 'Confirm booking').click();
    await expect(toast(page)).toContainText('a space cannot be double-booked');
    await expect(status(page)).toHaveText('Quoted');
    // Move it to the forecourt: no clash, and it confirms.
    await page.getByTestId('booking-space').selectOption('forecourt');
    await page.getByTestId('save-booking-dates').click();
    await expect(page.getByTestId('clash-notice')).toHaveCount(0);
    await step(page, 'Confirm booking').click();
    await expect(status(page)).toHaveText('Confirmed');
    await step(page, 'Exhibitor set up — go live').click();
    await expect(toast(page)).toContainText('This booking only starts on');

    // A seeded quote: no deposit, and after the deposit it is still refused for the clash.
    await page.goto('#/mall/bookings/bookings_6');
    await step(page, 'Confirm booking').click();
    await expect(toast(page)).toContainText('only confirmed once the deposit is received');
    await page.goto('#/mall/bookings/bookings_5');
    await expect(page.getByTestId('clash-notice')).toBeVisible();
    await page.getByTestId('deposit-received').click();
    await step(page, 'Confirm booking').click();
    await expect(toast(page)).toContainText('already booked by Evergreen Vehicle Display (EX-0003)');
    await page.getByTestId('booking-from').fill(await day(page, 17));
    await page.getByTestId('booking-to').fill(await day(page, 20));
    await page.getByTestId('save-booking-dates').click();
    await step(page, 'Confirm booking').click();
    await expect(status(page)).toHaveText('Confirmed');

    // Marketing fund: the events calendar lists it; a campaign within the fund is approved.
    await page.goto('#/mall/marketing');
    await expect(page.getByTestId('events-calendar')).toContainText('Zest Mobile Network Promo');
    await openRow(page, 'table-campaigns', 'Carols by candlelight');
    await page.getByTestId('campaign-cost').fill('99000000');
    await page.getByTestId('save-cost').click();
    await step(page, 'Approve spend').click();
    await expect(toast(page)).toContainText('left in the marketing fund');
    await page.getByTestId('campaign-cost').fill('82000');
    await page.getByTestId('save-cost').click();
    await step(page, 'Approve spend').click();
    await expect(status(page)).toHaveText('Spend approved');
    expect(errors).toEqual([]);
  });

  test('other modules: escalation, renewal, turnover capture, daily log, incident and the reports all work', async ({ page }) => {
    const errors = watchErrors(page);
    // Escalation due this month: one press raises the rent and clears the flag.
    await page.goto('#/mall/leases');
    await page.getByLabel('Search Leases').fill('Saffron Thread');
    await openRow(page, 'table-leases', 'Saffron Thread');
    await expect(panel(page, 'Rent & charges').locator('.panel-head .tag')).toHaveText('Escalation due this month');
    await expect(panel(page, 'Rent & charges')).toContainText('R360.00/m²');
    await page.getByTestId('apply-escalation').click();
    await expect(toast(page)).toContainText(/base rent raised [\d.]+% to R3\d\d\.\d\d per m²/);
    await expect(page.getByTestId('apply-escalation')).toHaveCount(0);
    await expect(panel(page, 'Rent & charges')).not.toContainText('R360.00/m²');

    // Renewal: refused until new terms are saved on the lease.
    await page.goto('#/mall/leases');
    await page.getByLabel('Search Leases').fill('Urban Tern');
    await openRow(page, 'table-leases', 'Urban Tern');
    await expect(status(page)).toHaveText('Renewal negotiation');
    await step(page, 'Renew lease').click();
    await expect(toast(page)).toContainText('Set the new end date under “Renewal terms” first');
    await page.getByTestId('renew-end').fill(await day(page, 365 * 3));
    await page.getByTestId('renew-rent').fill('392');
    await page.getByTestId('save-renewal').click();
    await step(page, 'Renew lease').click();
    await expect(status(page)).toHaveText('Trading');
    await expect(panel(page, 'Rent & charges')).toContainText('R392.00/m²');

    // Turnover: capture an awaited declaration; a figure far below the rent is flagged at risk.
    await page.goto('#/mall/turnover');
    await page.getByTestId('turnover-todo').getByRole('link', { name: 'Bunny Chow Bros' }).click();
    await expect(status(page)).toHaveText('Awaited');
    await page.getByTestId('record-declaration').click();
    await expect(toast(page)).toContainText('Type the turnover the tenant declared');
    await page.getByTestId('declared-amount').fill('250000');
    await expect(panel(page, 'What this figure means').locator('.panel-head .tag')).toHaveText('At risk');
    await page.getByTestId('declared-amount').fill('560000');
    await page.getByTestId('record-declaration').click();
    await expect(status(page)).toHaveText('Declared');
    await step(page, 'Query with tenant').click();
    await note(page, 'Figure excludes delivery-app sales — asked for the full month-end report.');
    await expect(status(page)).toHaveText('Queried');

    // Daily log: today's footfall is typed in and the dashboard picks it up.
    await page.goto('#/mall/ops');
    await expect(panel(page, `Footfall — last 14 days`)).toBeVisible();
    await page.getByTestId('save-log').click();
    await expect(toast(page)).toContainText('Type today’s footfall count');
    await page.getByTestId('log-footfall').fill('18250');
    await page.getByTestId('log-parking').fill('51200');
    await page.getByTestId('save-log').click();
    await expect(toast(page)).toContainText('18 250 visitors');
    await expect(page.locator('.stat', { hasText: 'Footfall · today' })).toContainText('18 250');
    await expect(page.getByTestId('table-opslog').locator('tbody tr')).toHaveCount(31);
    await page.goto('#/mall');
    await expect(page.locator('.stat', { hasText: 'Footfall · today' })).toContainText('18 250');

    // Incident with an injury: response, findings and a DEMO-CLM reference before it closes.
    await page.goto('#/mall/incidents/incidents_1');
    await expect(status(page)).toHaveText('Reported');
    await step(page, 'Log response').click();
    await expect(toast(page)).toContainText('Record who responded and what was done');
    await page.getByTestId('action-taken').fill('First aid given; wet-floor sign placed; customer declined an ambulance.');
    await page.getByTestId('save-response').click();
    await step(page, 'Log response').click();
    await expect(status(page)).toHaveText('Responded');
    await step(page, 'Investigation complete').click();
    await expect(toast(page)).toContainText('Write up the findings');
    await page.getByTestId('findings').fill('Spill was four minutes old; cleaner was already on the way. No change to procedure.');
    await page.getByTestId('save-findings').click();
    await step(page, 'Investigation complete').click();
    await expect(status(page)).toHaveText('Investigated');
    await step(page, 'Close incident').click();
    await expect(toast(page)).toContainText('an insurance reference is needed before closing');
    await page.getByTestId('insurance-ref').fill('CLAIM-88');
    await page.getByTestId('save-insurance-ref').click();
    await expect(toast(page)).toContainText('starts with DEMO-CLM-');
    await page.getByTestId('insurance-ref').fill('DEMO-CLM-3301');
    await page.getByTestId('save-insurance-ref').click();
    await step(page, 'Close incident').click();
    await expect(status(page)).toHaveText('Closed');

    // Unit page and reports render from the same records.
    await page.goto('#/mall/units');
    await plan(page, 'U05').click();
    await page.getByTestId('open-unit').click();
    await expect(heading(page)).toHaveText('Shop U05');
    await expect(panel(page, 'Lease')).toContainText('The Copper Skillet');
    await expect(panel(page, 'Arrears').locator('.panel-head .tag')).toContainText('overdue');
    await expect(panel(page, 'Turnover trend')).toContainText('rent is');
    await expect(workflow(page).getByRole('button')).toHaveCount(0); // a unit's status is never set by hand
    await page.goto('#/mall/reports');
    await expect(page.getByTestId('report-occupancy').locator('tbody tr')).toHaveCount(5);
    await expect(page.getByTestId('report-collections').locator('tbody tr')).toHaveCount(6);
    for (const title of ['Vacancy trend', 'Rent roll & collections', 'Arrears ageing', 'Trading density by category', 'Footfall trend', 'Lease-expiry profile', 'Tenant mix']) await expect(panel(page, title)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('roles: every simulated user lands on a useful dashboard, sees their own menu and is told what they cannot do', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/mall');
    const nav = page.getByLabel('Main navigation');
    const menus: Record<string, { has: string[]; hasNot: string[] }> = {
      u_cm: { has: ['Shops & stacking plan', 'Monthly billing', 'Work permits', 'Marketing fund & events'], hasNot: [] },
      u_lm: { has: ['Shops & stacking plan', 'Leases', 'Leasing pipeline & vacancies', 'Turnover declarations'], hasNot: ['Monthly billing', 'Work permits', 'Incidents'] },
      u_la: { has: ['Shops & stacking plan', 'Leases', 'Leasing pipeline & vacancies'], hasNot: ['Monthly billing', 'Turnover declarations', 'Utilities metering'] },
      u_ops: { has: ['Utilities metering', 'Maintenance & work orders', 'Fit-outs', 'Work permits', 'Incidents'], hasNot: ['Monthly billing', 'Leases', 'Exhibitions & promotions'] },
      u_tc: { has: ['Fit-outs', 'Work permits', 'Maintenance & work orders', 'Leases'], hasNot: ['Monthly billing', 'Utilities metering', 'Incidents'] },
      u_acc: { has: ['Monthly billing', 'Arrears & credit control', 'Turnover declarations', 'Reports'], hasNot: ['Work permits', 'Fit-outs', 'Exhibitions & promotions'] },
      u_mkt: { has: ['Exhibitions & promotions', 'Marketing fund & events', 'Centre operations log'], hasNot: ['Monthly billing', 'Leases', 'Work permits'] },
      u_sec: { has: ['Incidents', 'Centre operations log', 'Work permits'], hasNot: ['Monthly billing', 'Leases', 'Fit-outs'] },
    };
    for (const [id, menu] of Object.entries(menus)) {
      await page.goto('#/mall');
      await signInAs(page, id);
      await expect(heading(page)).toContainText('Good day');
      await expect(page.getByTestId('hero-occupancy')).toContainText('% let');
      await expect(page.getByTestId('primary-action')).toBeVisible(); // a way into their own work
      await expect(page.locator('.dash-hero a')).toHaveCount(1);
      for (const label of menu.has) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
      for (const label of menu.hasNot) await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
      // The attention list only links to modules this person can open.
      await page.getByTestId('primary-action').click();
      await expect(page.getByTestId('no-access')).toHaveCount(0);
    }

    // Marketing has no billing; leasing sees turnover but cannot verify it, and is told who can.
    await signInAs(page, 'u_mkt');
    await page.goto('#/mall/billing');
    await expect(page.getByTestId('no-access')).toBeVisible();
    await signInAs(page, 'u_lm');
    await page.goto('#/mall/turnover');
    await page.getByTestId('turnover-todo').getByRole('link', { name: 'Indigo Reef' }).click();
    await expect(step(page, 'Verify')).toBeDisabled();
    await expect(workflow(page)).toContainText(/Verify turnover.*Michelle Jacobs/);
    // The tenant coordinator runs fit-outs but cannot sign them off; security sees permits but cannot approve.
    await signInAs(page, 'u_tc');
    await page.goto('#/mall/fitouts/fitouts_4');
    await expect(step(page, 'Sign off fit-out')).toBeDisabled();
    await expect(panel(page, 'Snag list')).toContainText(/Sign off fit-outs.*Rajesh Naidoo/);
    await page.goto('#/mall/leases/leases_2');
    await expect(step(page, 'Start trading')).toBeDisabled();
    await expect(page.getByTestId('save-coo')).toHaveCount(0);
    await signInAs(page, 'u_sec');
    await page.goto('#/mall/permits/permits_1');
    await expect(step(page, 'Approve permit')).toBeDisabled();
    await expect(page.getByTestId('save-fire-watch')).toHaveCount(0);
    // The credit controller reads meters but cannot capture them; operations cannot draft invoices.
    await signInAs(page, 'u_acc');
    await page.goto('#/mall/meters');
    await expect(page.getByTestId('capture-F05')).toHaveCount(0);
    await expect(page.locator('main')).toContainText(/Meter readings.*Rajesh Naidoo/);
    expect(errors).toEqual([]);
  });

  test('mobile: dashboard, stacking plan, lease, billing and meters are usable with no sideways page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/mall', '#/mall/units', '#/mall/units/units_43', '#/mall/leases', '#/mall/leases/leases_1', '#/mall/leases/leases_2', '#/mall/pipeline', '#/mall/billing', '#/mall/billing/invoices_300', '#/mall/arrears', '#/mall/arrears/cases_1', '#/mall/turnover', '#/mall/meters', '#/mall/workorders', '#/mall/workorders/workorders_5', '#/mall/fitouts/fitouts_4', '#/mall/permits/permits_1', '#/mall/ops', '#/mall/incidents/incidents_1', '#/mall/bookings', '#/mall/bookings/bookings_5', '#/mall/marketing', '#/mall/reports']) {
      await page.goto(path);
      await expect(heading(page)).toBeVisible();
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
    // The stacking plan works with a thumb: the shop tile and its summary are on screen.
    await page.goto('#/mall/units');
    const tile = plan(page, 'G14');
    await tile.scrollIntoViewIfNeeded();
    const box = (await tile.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await tile.click();
    await expect(page.getByTestId('unit-summary')).toContainText('Application from Paper Lantern Stationers');
    // So does capturing a reading: the inputs and the button are inside the screen, not in a scrolled table.
    await page.goto('#/mall/meters');
    const capture = page.getByTestId('capture-L11');
    await capture.scrollIntoViewIfNeeded();
    const b = (await capture.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    const prev = Number(await page.getByTestId('reading-row-L11').getAttribute('data-prev-elec'));
    await page.getByTestId('elec-L11').fill(String(prev + 1700));
    await capture.click();
    await expect(page.getByTestId('readings-waiting').locator('li')).toHaveCount(3);
  });

  test('honesty: the business name follows branding and nothing claims to send, integrate or comply', async ({ page }) => {
    await page.goto('#/mall/settings');
    const main = page.locator('main');
    await expect(main).toContainText('Not an accounting system or a lease-administration system of record');
    await expect(main).toContainText('Every reading, payment, footfall count and turnover figure is typed in by hand');
    await expect(main).toContainText('no email, SMS or letter is sent');
    await expect(main).toContainText('not Consumer Protection Act, Rental Housing Act or FICA compliance');
    await page.goto('#/mall/billing/invoices_300');
    await expect(panel(page, 'Invoice')).toContainText('From Harbour Crossing Mall · demonstration document, not a tax invoice');
    await page.goto('#/mall/billing');
    await expect(main).toContainText('Interest on arrears is not calculated');
    await expect(main).toContainText('max(0, verified turnover × the lease % − base rent)');
    await page.goto('#/mall/ops');
    await expect(main).toContainText('there is no counter or parking-system link');
    await page.goto('#/mall/leases/leases_5');
    await expect(panel(page, 'Before the lease can be signed')).toContainText('not FICA compliance');
  });
});
