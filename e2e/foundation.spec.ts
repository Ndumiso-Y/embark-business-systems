import { expect, test } from '@playwright/test';

// Behaviour every industry inherits from the shared foundation, checked on optometry.
test.describe('Shared foundation', () => {
  test('forms: errors are shown and focused, Enter saves, edits update flags and history, delete confirms', async ({ page }) => {
    await page.goto('#/optometry/stock');
    await page.getByTestId('new-record').click();
    await page.getByTestId('save-record').click();
    expect(await page.locator('.modal .field-error').count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByLabel('Item', { exact: true })).toBeFocused();

    await page.getByLabel('Item', { exact: true }).fill('Audit test frame');
    await page.getByLabel('Category').selectOption('frame');
    await page.getByLabel('Supplier (fictional)').fill('Audit Supplier');
    await page.getByLabel('Cost price').fill('500');
    await page.getByLabel('Retail price').fill('400');
    await page.getByLabel('On hand').fill('3');
    await page.getByLabel('Reorder at').fill('1');
    await page.getByTestId('save-record').click();
    await expect(page.locator('.modal')).toContainText('Retail is below cost');
    await page.getByLabel('Retail price').fill('900');
    await page.getByLabel('Retail price').press('Enter');
    await expect(page).toHaveURL(/stock\/stock_/);

    await page.getByTestId('edit-record').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal')).toHaveCount(0);
    await page.getByTestId('edit-record').click();
    await page.getByLabel('On hand').fill('0');
    await page.getByLabel('On hand').press('Enter');
    await expect(page.locator('.modal')).toHaveCount(0);
    await expect(page.locator('.content')).toContainText('Out of stock');
    await expect(page.locator('.timeline')).toContainText('Details edited');

    await page.getByLabel('Search workspace').fill('audit test');
    await page.getByLabel('Search workspace').press('Enter');
    await expect(page.getByTestId('search-results').locator('li')).toHaveCount(1);
    await page.getByTestId('search-results').getByRole('link').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByTestId('confirm-button').click();
    await expect(page).toHaveURL(/#\/optometry\/stock$/);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('not found');
  });

  test('permissions: revoking a module hides it; a new user starts with the dashboard only', async ({ page }) => {
    await page.goto('#/optometry/admin');
    await page.getByLabel('Ayesha Patel: Recalls').uncheck();
    await page.getByTestId('user-switcher').selectOption('u_fd');
    await expect(page.getByLabel('Main navigation').getByRole('link', { name: 'Recalls' })).toHaveCount(0);
    await expect(page.getByTestId('no-access')).toBeVisible(); // still on the admin page, which they cannot open

    await page.getByTestId('user-switcher').selectOption('u_owner');
    await page.getByRole('button', { name: /Add demo user/ }).click();
    await page.getByLabel('Full name').fill('Temp Person');
    await page.getByLabel('Job title').fill('Locum');
    await page.getByRole('button', { name: 'Add user' }).click();
    await page.getByTestId('user-switcher').selectOption({ label: 'Temp Person · Locum' });
    await page.goto('#/optometry');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');
  });

  test('keyboard and unknown addresses', async ({ page }) => {
    await page.goto('#/optometry/patients');
    await page.locator('tbody tr').first().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/patients\/patients_/);
    await page.goto('#/optometry/nonsense');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('not found');
    await page.goto('#/optometry/patients/doesnotexist');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('not found');
  });

  test('guided walkthrough opens the right screen as the right person and can be hidden', async ({ page }) => {
    await page.goto('#/optometry');
    await expect(page.getByTestId('guide')).toBeVisible();
    await page.getByTestId('guide-step-2').click();
    await expect(page).toHaveURL(/#\/optometry\/exams/);
    await expect(page.getByTestId('user-switcher')).toHaveValue('u_opt');
    await page.getByTestId('user-switcher').selectOption('u_owner');
    await page.goto('#/optometry');
    await page.getByTestId('guide').getByRole('button', { name: 'Hide' }).click();
    await expect(page.getByTestId('guide')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('guide-reopen')).toBeVisible();
  });

  test('phone: search and the menu are reachable, dialogs fit', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/optometry');
    await page.getByRole('link', { name: 'Open search' }).click();
    await page.getByLabel('Search all records').fill('Sithole');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByTestId('search-results').locator('li').first()).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sidebar.open')).toHaveCount(0);
    await page.goto('#/optometry/stock');
    await page.getByTestId('new-record').click();
    const fits = await page.evaluate(() => { const m = document.querySelector('.modal')!.getBoundingClientRect(); return m.right <= window.innerWidth + 1 && m.left >= -1; });
    expect(fits).toBe(true);
  });
});
