import { expect, test, type Page } from '@playwright/test';

// Kestrel Property Group: the core journeys a first-time visitor would try, driven through the UI only.
// Every test starts from a fresh seed (empty storage) and uses dates relative to today.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const signInAs = (page: Page, id: string) => page.getByTestId('user-switcher').selectOption(id);
const toast = (page: Page) => page.locator('.toast').last();
const workflow = (page: Page) => page.locator('.panel', { hasText: 'Workflow' }).first();
const status = (page: Page) => workflow(page).locator('.panel-head .tag');
const step = (page: Page, name: string) => workflow(page).getByRole('button', { name, exact: true });
const panel = (page: Page, title: string) => page.locator('.panel', { has: page.getByRole('heading', { name: title, exact: true }) });

test.describe('Real estate journeys @ 2027-03-01T00:20:00', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2027-03-01T00:20:00')); });
  test('listing: valuation → mandate → go-live checks → listed', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/realestate/listings/listings_1');
    await signInAs(page, 'u_admin');
    await expect(status(page)).toHaveText('Valuation');
    // The mandate is recorded right on the listing: type, signed and expiry dates default sensibly.
    await page.getByTestId('record-mandate').click();
    await expect(status(page)).toHaveText('Mandate signed');
    // Go live is refused until the seller's FICA is ticked off, and says so.
    await step(page, 'Go live').click();
    await expect(toast(page)).toContainText('FICA');
    await expect(panel(page, 'Go-live checks')).toContainText('1 to fix');
    await page.getByTestId('mark-fica').click();
    await expect(page.getByTestId('golive-ready')).toBeVisible();
    await step(page, 'Go live').click();
    await expect(status(page)).toHaveText('Listed');
    await expect(panel(page, 'Market position')).toContainText('Days on market0');
    expect(errors).toEqual([]);
  });

  test('go live is blocked by an expired FFC and an expired mandate, each fixable on the screen', async ({ page }) => {
    await page.goto('#/realestate/listings/listings_3');
    await signInAs(page, 'u_admin');
    await step(page, 'Go live').click();
    await expect(toast(page)).toContainText('Fidelity Fund Certificate expired');
    await page.getByLabel('Reassign listing to').selectOption({ label: 'Pieter Swanepoel' });
    await page.getByTestId('reassign-agent').click();
    await step(page, 'Go live').click();
    await expect(status(page)).toHaveText('Listed');

    await page.goto('#/realestate/listings/listings_5');
    await step(page, 'Go live').click();
    await expect(toast(page)).toContainText('mandate expired');
    await page.getByTestId('renew-mandate').click();
    await step(page, 'Go live').click();
    await expect(status(page)).toHaveText('Listed');

    // A sales agent can prepare a listing but not approve go-live, and is told who can.
    await page.goto('#/realestate/listings/listings_6');
    await signInAs(page, 'u_sales');
    await expect(step(page, 'Go live')).toBeDisabled();
    await expect(page.getByTestId('golive-ready')).toContainText('principal or the office admin');
  });

  test('buyer → matched listing → viewing with feedback → offer → sold → transfer → registered → commission paid', async ({ page }) => {
    const errors = watchErrors(page);
    // Office admin puts 9 Bramble Lane live (every check already passes).
    await page.goto('#/realestate/listings/listings_6');
    await signInAs(page, 'u_admin');
    await step(page, 'Go live').click();
    await expect(status(page)).toHaveText('Listed');

    // Sales agent captures a buyer whose budget and suburb fit it.
    await signInAs(page, 'u_sales');
    await page.goto('#/realestate/leads');
    await page.getByTestId('new-record').click();
    await page.getByLabel('Buyer name (fictional)').fill('Journey Buyer');
    await page.getByLabel('Phone').fill('082 555 0101');
    await page.getByLabel('Lead source').selectOption('website');
    await page.getByLabel('Budget').fill('2200000');
    await page.getByLabel('Preferred suburbs').fill('Bramble Downs');
    await page.getByLabel('Minimum bedrooms').fill('3');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Journey Buyer');
    const matches = page.getByTestId('matching-listings');
    await expect(matches).toContainText('9 Bramble Lane');

    // Book a viewing from the match (defaults: today, 10:00, the listing agent).
    await matches.locator('li', { hasText: '9 Bramble Lane' }).getByTestId('book-from-match').click();
    await page.getByTestId('save-record').click();
    await expect(status(page)).toHaveText('Viewing booked');

    // Complete it with feedback; without feedback it is refused.
    await page.getByTestId('record-feedback').click();
    await page.getByTestId('complete-viewing').click();
    await expect(page.locator('.field-error')).toContainText('interested');
    await page.getByLabel('Interest level').selectOption('hot');
    await page.getByLabel('Viewing feedback').fill('Loved the garden. Wants to make an offer subject to a bond.');
    await page.getByTestId('complete-viewing').click();
    await expect(status(page)).toHaveText('Completed');

    // Capture the offer straight from the completed viewing.
    await page.getByTestId('capture-offer').click();
    await page.getByLabel('Offer amount').fill('2100000');
    await page.getByLabel('Deposit', { exact: true }).fill('100000');
    await page.getByLabel('Bond amount').fill('2000000');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('9 Bramble Lane, Bramble Downs');
    await expect(status(page)).toHaveText('Submitted to seller');

    // Seller accepts → listing under offer; conditions block the sale until ticked off.
    await step(page, 'Seller accepts').click();
    await expect(status(page)).toHaveText('Accepted — conditions pending');
    await step(page, 'Conditions met').click();
    await expect(toast(page)).toContainText('Bond approval');
    await page.getByTestId('mark-bond').click();
    await page.getByTestId('mark-deposit').click();
    await expect(page.getByTestId('conditions-hint')).toContainText('Every condition is met');
    await page.goto('#/realestate/listings/listings_6');
    await expect(status(page)).toHaveText('Under offer');
    await page.getByRole('link', { name: /Journey Buyer/ }).first().click();
    await step(page, 'Conditions met').click();
    await expect(status(page)).toHaveText('Conditions met');

    // A transfer opened; walk the conveyancing steps.
    await panel(page, 'Transfer (simulated)').getByRole('link', { name: /^TRF-/ }).click();
    await expect(status(page)).toHaveText('OTP signed');
    await step(page, 'Bond approved / cash confirmed').click();
    await step(page, 'Transfer documents signed').click();
    await expect(toast(page)).toContainText('conveyancer');
    await page.getByTestId('pick-conveyancer').selectOption('ndaba');
    await step(page, 'Transfer documents signed').click();
    await step(page, 'Lodged (simulated)').click();
    await expect(toast(page)).toContainText('Transfer duty');
    await page.getByTestId('tick-transferDuty').click();
    await page.getByTestId('tick-ratesClearance').click();
    await step(page, 'Lodged (simulated)').click();
    await step(page, 'Registered (simulated)').click();
    await expect(status(page)).toHaveText('Registered');
    await expect(page.locator('.toast', { hasText: 'is now payable' })).toBeVisible();

    // The listing is registered and the buyer has bought.
    await page.goto('#/realestate/listings/listings_6');
    await expect(status(page)).toHaveText('Registered');

    // Bookkeeper pays the commission out (simulated).
    await signInAs(page, 'u_book');
    await page.goto('#/realestate/commission');
    const row = page.getByTestId('commission-payable').locator('li', { hasText: '9 Bramble Lane' });
    await expect(row).toContainText('R157,500'); // 7.5% of R2,100,000
    await row.getByRole('button', { name: 'Mark paid (simulated)' }).click();
    await expect(page.getByTestId('commission-payable').locator('li', { hasText: '9 Bramble Lane' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('rental: application → vetting → approved → deposit → signed → active → notice', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/realestate/leases');
    await signInAs(page, 'u_rental');
    await page.getByTestId('new-record').click();
    await page.getByLabel('Rental property (fictional)').fill('4 Journey Mews');
    await page.getByLabel('Suburb (fictional)').selectOption('marula');
    await page.getByLabel('Landlord (fictional)').fill('Lana Lord');
    await page.getByLabel('Tenant / applicant (fictional)').fill('Tina Tenant');
    await page.getByLabel('Monthly rent').fill('9500');
    await page.getByLabel('Deposit (held in trust — simulated)').fill('14250');
    // Lease starts today (the browser's local date) and runs for a year.
    const [start, end] = await page.evaluate(() => {
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const d = new Date();
      return [iso(d), iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 364))];
    });
    await page.getByLabel('Lease start').fill(start);
    await page.getByLabel('Lease end').fill(end);
    await page.getByTestId('save-record').click();
    await expect(status(page)).toHaveText('Application');

    await step(page, 'Start vetting (simulated)').click();
    await step(page, 'Approve tenant').click();
    await expect(toast(page)).toContainText('vetting outcome');
    await page.getByTestId('vet-approved').click();
    await step(page, 'Approve tenant').click();
    await expect(status(page)).toHaveText('Approved');

    await step(page, 'Lease signed').click();
    await expect(toast(page)).toContainText('deposit');
    await page.getByTestId('deposit-received').click();
    await step(page, 'Lease signed').click();
    await expect(status(page)).toHaveText('Lease signed');
    await step(page, 'Tenant moved in').click();
    await expect(status(page)).toHaveText('Active');

    await step(page, 'Notice given').click();
    await page.getByLabel('Transition note').fill('Tenant relocating; one calendar month’s notice.');
    await page.getByTestId('confirm-transition').click();
    await expect(status(page)).toHaveText('Notice given');
    expect(errors).toEqual([]);
  });

  test('maintenance above R2,500 needs the owner’s approval', async ({ page }) => {
    await page.goto('#/realestate/leases/leases_8'); // active lease
    await signInAs(page, 'u_rental');
    await page.getByTestId('log-maintenance').click();
    await page.getByLabel('Problem').fill('Replace cracked bath');
    await page.getByTestId('save-record').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Replace cracked bath');
    await expect(status(page)).toHaveText('Logged');

    await page.getByLabel('Contractor', { exact: true }).selectOption('flowfix');
    await page.getByLabel('Quote amount').fill('4800');
    await page.getByTestId('save-quote').click();
    await expect(status(page)).toHaveText('Quoted');
    await step(page, 'Approve quote').click();
    await expect(toast(page)).toContainText('R2,500');
    await page.getByTestId('owner-approve').click();
    await step(page, 'Approve quote').click();
    await expect(status(page)).toHaveText('Approved');
    await step(page, 'Assign contractor').click();
    await expect(status(page)).toHaveText('Contractor assigned');
  });

  test('roles: the rental agent has no sales modules; the bookkeeper sees commission but cannot progress transfers', async ({ page }) => {
    await page.goto('#/realestate');
    await signInAs(page, 'u_rental');
    const nav = page.getByLabel('Main navigation');
    await expect(nav.getByRole('link', { name: 'Rentals & leases' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Listings & mandates' })).toHaveCount(0);
    await expect(page.getByTestId('attention-list')).toContainText('Rent arrears');
    await expect(page.locator('.stat', { hasText: 'Registering this month' })).not.toContainText('commission');
    await page.goto('#/realestate/listings');
    await expect(page.getByTestId('no-access')).toBeVisible();

    await signInAs(page, 'u_book');
    await page.goto('#/realestate/transfers/transfers_4');
    await expect(step(page, 'Registered (simulated)')).toBeDisabled();
    await expect(panel(page, 'Conveyancing checklist')).toContainText('can follow the transfer but not progress it');
    await page.goto('#/realestate/commission');
    await expect(page.getByTestId('commission-payable').getByRole('button', { name: 'Mark paid (simulated)' }).first()).toBeEnabled();
  });

  test('guided walkthrough: every step opens the right screen and works on a fresh seed', async ({ page }) => {
    const errors = watchErrors(page);
    const open = async (n: number) => { await page.goto('#/realestate'); await page.getByTestId(`guide-step-${n}`).click(); };

    await open(1); // go live after ticking off FICA
    await page.getByTestId('mark-fica').click();
    await step(page, 'Go live').click();
    await expect(status(page)).toHaveText('Listed');

    await open(2); // match a buyer, book a viewing
    await page.getByTestId('book-from-match').first().click();
    await page.getByTestId('save-record').click();
    await expect(status(page)).toHaveText('Viewing booked');

    await open(3); // accept an offer, meet the conditions
    await step(page, 'Seller accepts').click();
    await page.getByTestId('mark-bond').click();
    await page.getByTestId('mark-deposit').click();
    await step(page, 'Conditions met').click();
    await expect(status(page)).toHaveText('Conditions met');

    await open(4); // register a lodged transfer
    const lodged = page.locator('section[aria-label="Lodged at deeds office (simulated) column"]');
    await expect(lodged.getByRole('button', { name: 'Registered (simulated)' }).first()).toBeVisible();
    const before = await lodged.locator('.board-card').count();
    await lodged.getByRole('button', { name: 'Registered (simulated)' }).first().click();
    await expect(lodged.locator('.board-card')).toHaveCount(before - 1);
    await page.goto('#/realestate');
    await expect(page.locator('.panel', { hasText: 'Recent activity' }).last()).toContainText(/Commission COM-\d+ created/);

    await open(5); // sign a lease once the deposit is in
    await step(page, 'Lease signed').click();
    await expect(toast(page)).toContainText('deposit');
    await page.getByTestId('deposit-received').click();
    await step(page, 'Lease signed').click();
    await expect(status(page)).toHaveText('Lease signed');

    await open(6); // owner approval above the limit
    await step(page, 'Approve quote').click();
    await expect(toast(page)).toContainText('R2,500');
    await page.getByTestId('owner-approve').click();
    await step(page, 'Approve quote').click();
    await expect(status(page)).toHaveText('Approved');
    expect(errors).toEqual([]);
  });

  test('mobile: dashboard, a listing and the viewings planner fit a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['#/realestate', '#/realestate/listings/listings_4', '#/realestate/viewings', '#/realestate/offers/offers_1', '#/realestate/transfers/transfers_3', '#/realestate/maintenance/maintenance_3']) {
      await page.goto(path);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByLabel('Main navigation').getByRole('link', { name: 'Buyers & leads' }).click();
    await expect(page.getByRole('heading', { name: 'Buyers & leads', level: 1 })).toBeVisible();
  });
});
