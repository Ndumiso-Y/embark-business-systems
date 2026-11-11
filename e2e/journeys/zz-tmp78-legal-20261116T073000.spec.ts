import { expect, test, type Page } from '@playwright/test';

// Mahlaba & Rossouw Attorneys: the core journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage) and uses dates relative to today.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const toast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text }).last();
const workflow = (page: Page) => page.locator('.panel', { hasText: 'Workflow' }).first();
const status = (page: Page) => workflow(page).locator('.panel-head .tag');
const step = (page: Page, name: string) => workflow(page).getByRole('button', { name, exact: true });
const panel = (page: Page, title: string | RegExp) => page.locator('.panel', { has: page.getByRole('heading', { name: title, exact: typeof title === 'string' }) });
const MATTER = 'Protea Traders v Sable Retail Group — unpaid invoices';

/** Captures a trust entry for the matter currently selected on the trust ledger. */
async function captureTrust(page: Page, type: string, amount: string, payee: string, description: string) {
  await page.getByLabel('Transaction type').selectOption(type);
  await page.getByTestId('trust-amount').fill(amount);
  await page.getByLabel('Payee').fill(payee);
  await page.getByLabel('Description').fill(description);
  await page.getByTestId('capture-trust').click();
}

test.describe('Law firm journeys @ 2026-11-16T07:30:00', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-11-16T07:30:00')); });
  test('client → matter → conflict check → engagement → time → fee note → paid from trust → closed', async ({ page }) => {
    const errors = watchErrors(page);

    // --- The secretary takes the instruction: a new client, and a matter opened at intake.
    await page.goto('#/legal/clients');
    await signInAs(page, 'u_sec');
    await page.getByTestId('new-record').click();
    await page.getByLabel('Client name').fill('Protea Traders (Pty) Ltd');
    await page.getByLabel('Client type').selectOption('company');
    await page.getByLabel('Phone (fictional)').fill('011 555 9000');
    await page.getByLabel('Email').fill('protea@example.com');
    await page.getByLabel('FICA documents').selectOption('pending');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Protea Traders (Pty) Ltd');

    await page.getByTestId('open-matter').click();
    await page.getByLabel('Matter description').fill(MATTER);
    await page.getByLabel('Matter type').selectOption('litigation');
    await page.getByLabel('Opposing party').fill('Sable Retail Group (Pty) Ltd');
    await page.getByLabel('Responsible fee earner').selectOption('nm');
    await page.getByLabel('Fee estimate (excl. VAT)').fill('50000');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(MATTER);
    await expect(status(page)).toHaveText('Intake');
    await step(page, 'Send for conflict check').click();
    await expect(status(page)).toHaveText('Conflict check');

    // --- Conflict search: the opposing party is an existing client of the firm.
    await page.getByTestId('open-conflicts').click();
    await expect(page.getByTestId('conflict-search')).toHaveValue('Sable Retail Group (Pty) Ltd');
    await expect(page.getByTestId('conflict-hits')).toContainText('Client');
    await page.getByLabel('Conflict outcome').selectOption('potential');
    await page.getByTestId('record-conflict').click();
    await expect(page.locator('.field-error')).toContainText('needs a note');
    await page.getByLabel('Conflict note').fill('Unrelated to the lease matter. Written informed consent obtained from both clients.');
    await page.getByTestId('record-conflict').click();
    const pending = page.getByTestId('pending-conflicts').locator('li', { hasText: MATTER });
    // The secretary cannot clear it; the partner can, and the matter moves on by itself.
    await expect(pending.getByRole('button', { name: 'Clear for engagement' })).toBeDisabled();
    await signInAs(page, 'u_mp');
    await pending.getByRole('button', { name: 'Clear for engagement' }).click();
    await expect(toast(page, 'moved to Engagement')).toBeVisible();

    // --- Engagement: letter signed and FICA confirmed, on the matter itself.
    await page.goto('#/legal/matters');
    await page.getByTestId('table-matters').locator('tr', { hasText: MATTER }).click();
    await expect(status(page)).toHaveText('Engagement');
    await step(page, 'Open for work').click();
    await expect(toast(page, 'engagement letter')).toBeVisible();
    await page.getByTestId('mark-engagement').click();
    await page.getByTestId('mark-fica').click();
    await step(page, 'Open for work').click();
    await expect(status(page)).toHaveText('Active');
    const matterUrl = page.url();

    // --- Time: six-minute units only; then one click bills it.
    await page.getByTestId('record-time').click();
    await page.getByLabel('Hours').fill('1.25');
    await page.getByLabel('Narrative (appears on the fee note)').fill('Consultation with client; drafting letter of demand');
    await page.getByTestId('save-record').click();
    await expect(page.locator('.field-error').first()).toContainText('six-minute');
    await page.getByLabel('Hours').fill('1.5');
    await page.getByTestId('save-record').click();
    await page.getByTestId('bill-time').click();
    await page.getByTestId('confirm-button').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Protea Traders (Pty) Ltd');
    await expect(status(page)).toHaveText('Issued');
    await expect(panel(page, 'Payments')).toContainText('R5,520.00'); // 1.5 h × R3,200 + 15% VAT

    // --- Trust: the bookkeeper captures; an overdraw is refused; the partner approves.
    await signInAs(page, 'u_book');
    await page.goto(matterUrl);
    await panel(page, 'Trust (simulated)').getByRole('link', { name: 'Open ledger' }).click();
    await page.getByLabel('Transaction type').selectOption('transfer');
    await page.getByLabel('Fee note').selectOption({ index: 1 });
    await expect(page.getByTestId('trust-amount')).toHaveValue('5520.00');
    await page.getByLabel('Description').fill('Fees');
    await page.getByTestId('capture-trust').click();
    await expect(page.locator('.field-error')).toContainText('overdraw');

    await captureTrust(page, 'deposit', '8000', 'Protea Traders (Pty) Ltd', 'Deposit on account of fees');
    const ledger = page.getByTestId('trust-ledger');
    await expect(ledger.getByRole('button', { name: 'Approve (simulated)' })).toBeDisabled(); // bookkeeper cannot approve
    await signInAs(page, 'u_mp');
    await ledger.getByRole('button', { name: 'Approve (simulated)' }).click();
    await expect(ledger).toContainText('R8,000.00');

    await signInAs(page, 'u_book');
    await page.getByLabel('Transaction type').selectOption('transfer');
    await page.getByLabel('Fee note').selectOption({ index: 1 });
    await page.getByTestId('capture-trust').click();
    await signInAs(page, 'u_mp');
    await ledger.getByRole('button', { name: 'Approve (simulated)' }).click();
    await expect(toast(page, 'is now paid in full')).toBeVisible();
    await expect(ledger).toContainText('R2,480.00'); // 8,000 − 5,520

    // --- Closing is refused while trust money is held; refund it, then close.
    await page.goto(matterUrl);
    await expect(panel(page, 'Fee notes')).toContainText('Paid');
    await step(page, 'Start closing').click();
    await step(page, 'Close matter').click();
    await expect(toast(page, 'Trust balance must be R0.00')).toBeVisible();
    await page.getByTestId('closure-trust').click();
    await page.getByTestId('refund-balance').click();
    await page.getByTestId('capture-trust').click();
    await ledger.getByRole('button', { name: 'Approve (simulated)' }).click();
    await page.goto(matterUrl);
    await expect(panel(page, 'Closure checklist')).toContainText('can be closed');
    await step(page, 'Close matter').click();
    await expect(status(page)).toHaveText('Closed');
    expect(errors).toEqual([]);
  });

  test('closing is blocked by unbilled time and a trust balance, and says where to fix each', async ({ page }) => {
    await page.goto('#/legal/matters/matters_15'); // Venter Family Trust — closing, refund still owed
    await step(page, 'Close matter').click();
    await expect(toast(page, 'Trust balance must be R0.00')).toBeVisible();
    await expect(panel(page, 'Closure checklist').getByTestId('closure-trust')).toBeVisible();
    await page.goto('#/legal/matters/matters_1'); // active litigation with WIP and trust money
    await expect(panel(page, 'Closure checklist')).toContainText('unbilled time');
    await expect(panel(page, 'Closure checklist')).toContainText('Bill unbilled time');
  });

  test('court diary: add a deadline, postpone one with a note; a prescription date cannot be postponed', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/legal/diary');
    await signInAs(page, 'u_sec');
    await page.getByTestId('new-diary').click();
    await page.getByLabel('Title').fill('Deliver notice of bar');
    await page.getByLabel('Matter', { exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Type', { exact: true }).selectOption('filing');
    await page.getByLabel('Responsible').selectOption('cj');
    await page.getByTestId('save-record').click();
    const week = page.getByTestId('diary-week');
    const added = week.locator('li', { hasText: 'Deliver notice of bar' });
    await expect(added).toContainText('Today');

    // Postpone it: date and reason are asked for together.
    await added.getByTestId('postpone').click();
    await page.getByTestId('confirm-postpone').click();
    await expect(page.locator('.field-error')).toContainText('why');
    await page.getByLabel('Postponement note').fill('By agreement with the opposing attorneys.');
    await page.getByTestId('confirm-postpone').click();
    await expect(toast(page, 'postponed to')).toBeVisible();
    await expect(week.locator('li', { hasText: 'Deliver notice of bar' })).toHaveCount(1); // the new entry, seven days on
    await expect(week.locator('li', { hasText: 'Deliver notice of bar' })).toContainText('Due in 7 days');

    // The prescription date offers no postpone button, here or on its own page.
    const presc = week.locator('li', { hasText: 'Prescription date — claim against Metro Commuter Bus Services' });
    await expect(presc.getByTestId('no-postpone')).toBeVisible();
    await expect(presc.getByTestId('postpone')).toHaveCount(0);
    await presc.getByRole('link', { name: /Prescription date — claim/ }).click();
    await expect(page.getByRole('alert')).toContainText('cannot be postponed');
    await expect(page.getByTestId('postpone')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('roles: privileged notes are hidden from the bookkeeper, who can bill but not progress a matter', async ({ page }) => {
    await page.goto('#/legal/matters/matters_1');
    await expect(page.getByText('Strategy: dispute quantum')).toBeVisible(); // managing partner
    await signInAs(page, 'u_book');
    await expect(page.getByText('Strategy: dispute quantum')).toHaveCount(0);
    await expect(page.getByText('1 field(s) hidden for your simulated role.')).toBeVisible();
    await expect(step(page, 'Start closing')).toBeDisabled();
    await expect(page.getByTestId('bill-time')).toBeVisible();
    await expect(page.getByTestId('record-time')).toHaveCount(0);
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'Fee notes' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Conflict checks' })).toHaveCount(0);
    await page.goto('#/legal/conflicts');
    await expect(page.getByTestId('no-access')).toBeVisible();

    // The secretary does intake but does not manage matters: she is pointed to the client record.
    await signInAs(page, 'u_sec');
    await page.goto('#/legal/matters');
    await expect(page.getByTestId('new-record')).toHaveCount(0);
    await expect(page.getByRole('note')).toContainText('Open new matter');
  });

  test('guided walkthrough: every step opens the right screen and works on a fresh seed', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number) => { await page.goto('#/legal'); await page.getByTestId(`guide-step-${n}`).click(); };

    await open(1); // conflict check: search, record, clear
    await page.getByTestId('pending-conflicts').getByRole('button', { name: 'Search for this matter' }).click();
    await expect(page.getByTestId('conflict-hits')).toContainText('Umhlanga Bay Developments');
    await page.getByLabel('Conflict outcome').selectOption('potential');
    await page.getByLabel('Conflict note').fill('Developer consents in writing; separate fee earners.');
    await page.getByTestId('record-conflict').click();
    await page.getByTestId('pending-conflicts').locator('li', { hasText: 'Ndlovu — purchase of Unit 14' }).getByRole('button', { name: 'Clear for engagement' }).click();
    await expect(toast(page, 'moved to Engagement')).toBeVisible();

    await open(2); // engagement checklist
    await step(page, 'Open for work').click();
    await expect(toast(page, 'FICA')).toBeVisible();
    await page.getByTestId('mark-fica').click();
    await step(page, 'Open for work').click();
    await expect(status(page)).toHaveText('Active');

    await open(3); // time → fee note
    await page.getByTestId('record-time').click();
    await page.getByLabel('Narrative (appears on the fee note)').fill('Reviewing counterparty mark-up');
    await page.getByTestId('save-record').click();
    await page.getByTestId('bill-time').click();
    await page.getByTestId('confirm-button').click();
    await expect(status(page)).toHaveText('Issued');

    await open(4); // trust cannot be overdrawn
    await captureTrust(page, 'payment', '99999999', 'Test payee', 'Too much');
    await expect(page.locator('.field-error')).toContainText('overdraw');
    await page.getByTestId('trust-amount').fill('1500');
    await page.getByTestId('capture-trust').click();
    await expect(toast(page, 'awaiting partner approval')).toBeVisible();

    await open(5); // postpone; prescription cannot be
    await expect(page.getByTestId('no-postpone').first()).toBeVisible();
    await page.getByTestId('postpone').first().click();
    await page.getByLabel('Postponement note').fill('Postponed by agreement.');
    await page.getByTestId('confirm-postpone').click();
    await expect(toast(page, 'postponed to')).toBeVisible();

    await open(6); // bookkeeper's view of a matter
    await expect(page.getByText('1 field(s) hidden for your simulated role.')).toBeVisible();
    await expect(step(page, 'Start closing')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('mobile: dashboard, a matter, the trust ledger and the diary fit a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/legal', '#/legal/matters/matters_8', '#/legal/trust', '#/legal/diary', '#/legal/conflicts', '#/legal/diary/diary_1']) {
      await page.goto(path);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByLabel('Main navigation').getByRole('link', { name: 'Trust ledger' }).click();
    await expect(page.getByRole('heading', { name: 'Trust ledger (simulated)', level: 1 })).toBeVisible();
  });
});
