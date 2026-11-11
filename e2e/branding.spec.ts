import { expect, test, type Page } from '@playwright/test';
import { makePng } from './helpers/png';

/** Hue (0–360) of the workspace accent colour currently applied. */
async function accentHue(page: Page): Promise<number> {
  return page.locator('.app').evaluate((el) => {
    const hex = getComputedStyle(el).getPropertyValue('--accent').trim();
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
  });
}
const sidebar = (page: Page) => page.getByLabel('Main navigation');

test.describe('Client branding', () => {
  test('uploading a logo rebrands the workspace with its colours and name', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('#/optometry/settings');
    const before = await accentHue(page);

    // A blue logo on a transparent background with white lettering.
    const logo = makePng(120, 60, (x, y) => (x < 8 || y < 8 || x > 111 || y > 51 ? [0, 0, 0, 0] : y > 24 && y < 34 ? [255, 255, 255, 255] : [26, 115, 232, 255]));
    await page.getByTestId('brand-logo-input').setInputFiles({ name: 'acme-logo.png', mimeType: 'image/png', buffer: logo });
    await page.getByLabel('Company name').fill('Acme Eye Care');

    await expect(sidebar(page).locator('img.brand-logo')).toBeVisible();
    await expect(sidebar(page)).toContainText('ACME EYE CARE');
    const hue = await accentHue(page);
    expect(Math.abs(hue - before)).toBeGreaterThan(10);
    expect(hue).toBeGreaterThan(200);
    expect(hue).toBeLessThan(230);
    await expect(page).toHaveTitle('Acme Eye Care · Demonstration');
    await expect(page.locator('.footer-note')).toContainText('prepared for Acme Eye Care');

    // The brand carries through the rest of the demo and survives a reload and a data reset.
    await page.goto('#/optometry');
    await expect(page.locator('.page-kicker').first()).toContainText('Acme Eye Care');
    await page.reload();
    await expect(sidebar(page).locator('img.brand-logo')).toBeVisible();
    await page.goto('#/optometry/settings');
    await page.getByTestId('reset-demo').click();
    await page.getByTestId('confirm-button').click();
    await expect(sidebar(page)).toContainText('ACME EYE CARE');

    await page.getByTestId('brand-remove').click();
    await expect(sidebar(page)).toContainText('NORTHGATE OPTOMETRY');
    await expect(sidebar(page).locator('img.brand-logo')).toHaveCount(0);
    expect(Math.abs((await accentHue(page)) - before)).toBeLessThan(1);
    expect(errors).toEqual([]);
  });

  test('a branded link applies the name and colour without any setup', async ({ page }) => {
    await page.goto('?name=Zenith%20Optical&accent=e11d48#/optometry');
    await expect(sidebar(page)).toContainText('ZENITH OPTICAL');
    const hue = await accentHue(page);
    expect(hue > 335 || hue < 10).toBe(true);
    await expect(page.locator('.brand-monogram')).toContainText('ZO');
  });

  test('a published brand file adds the logo too', async ({ page }) => {
    await page.goto('?brand=example#/optometry');
    await expect(sidebar(page).locator('img.brand-logo')).toBeVisible();
    await expect(sidebar(page)).toContainText('EXAMPLE CLIENT CO');
    const hue = await accentHue(page);
    expect(hue).toBeGreaterThan(10);
    expect(hue).toBeLessThan(40);
  });

  test('an unknown brand key or bad values leave the demo unchanged', async ({ page }) => {
    await page.goto('?brand=does-not-exist&accent=zzzzzz#/optometry');
    await expect(sidebar(page)).toContainText('NORTHGATE OPTOMETRY');
  });
});
