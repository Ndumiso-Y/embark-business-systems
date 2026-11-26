import { expect, test, type Page } from '@playwright/test';
import { INDUSTRY_IDS } from '../src/industries/ids';

// Owner hub homepage (approved concept ED-HOME-2026-11-20): hero with real demo captures
// and a Cover Flow-style carousel that reaches all industries.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
const N = INDUSTRY_IDS.length;
const centred = (page: Page) => page.locator('.cf-slide[data-slot="0"]');
const status = (page: Page) => page.getByTestId('coverflow-status');
const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('Homepage', () => {
  test('hero: headline, real demo captures in the device frames, and working actions', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Run your business in one connected\s+system\./);
    await expect(page.getByText('Business integration systems')).toBeVisible();

    // Both device screens are images captured from the optometry demo, and they load.
    for (const name of [/Northgate Optometry demonstration, captured from this site at laptop size/, /Northgate Optometry dashboard captured at phone size/]) {
      const img = page.getByRole('img', { name });
      await expect(img).toBeVisible();
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 300)).toBe(true);
    }
    await expect(page.locator('.hp-devices-note')).toContainText('Demonstration');
    await expect(page.locator('.hp-devices-note')).toContainText('fictional');

    // The brand mark is the supplied image, shown in its own proportions.
    const mark = page.locator('.hp-brand img');
    const ratio = await mark.evaluate((el: HTMLImageElement) => (el.clientWidth / el.clientHeight) / (el.naturalWidth / el.naturalHeight));
    expect(ratio).toBeGreaterThan(0.98);
    expect(ratio).toBeLessThan(1.02);

    // No invented contact link and no dead navigation: every header item is an in-page action.
    await expect(page.getByRole('link', { name: /whatsapp/i })).toHaveCount(0);
    await expect(page.locator('.hp-top a')).toHaveCount(0);

    await page.getByTestId('hero-explore').click();
    await expect(page.getByTestId('coverflow-stage')).toBeFocused();
    await expect(page.getByTestId('coverflow-stage')).toBeInViewport();
    await page.getByTestId('hero-how').click();
    await expect(page.getByRole('heading', { name: 'What these demonstrations are — and are not' })).toBeInViewport();
    // The factual caution from the previous homepage is still on the page.
    await expect(page.locator('.hp-caution')).toContainText('There is no real sign-in, no server');
    await page.getByRole('navigation', { name: 'On this page' }).getByRole('button', { name: 'Demos' }).click();
    await expect(page.getByTestId('coverflow-stage')).toBeFocused();
    expect(page.url()).toMatch(/#\/$/);

    await page.getByRole('link', { name: 'Try the Northgate Optometry demonstration shown here' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');
    expect(errors).toEqual([]);
  });

  test('carousel: every industry can be centred with the next arrow and opened', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('#/');
    await expect(page.locator('.cf-slide')).toHaveCount(INDUSTRY_IDS.length);
    await expect(page.locator('.cf-dot')).toHaveCount(INDUSTRY_IDS.length);
    await expect(centred(page).getByTestId('industry-optometry')).toBeVisible();
    await expect(status(page)).toHaveText(`Optometry, 1 of ${INDUSTRY_IDS.length}`);

    const seen = new Set<string>();
    for (let i = 0; i < INDUSTRY_IDS.length; i++) {
      await expect(status(page)).toContainText(`, ${i + 1} of ${INDUSTRY_IDS.length}`);
      const id = (await centred(page).locator('.icard').getAttribute('data-testid'))!.replace('industry-', '');
      seen.add(id);
      // Exactly one "Open … demo" link is exposed at a time, and it points at the centred industry.
      const open = page.getByRole('link', { name: /^Open .+ demo$/ });
      await expect(open).toHaveCount(1);
      await expect(open).toHaveAttribute('href', `#/${id}`);
      await expect(page.getByTestId(`coverflow-dot-${id}`)).toHaveAttribute('aria-current', 'true');
      await expect(page.locator('.cf-dot[aria-current]')).toHaveCount(1);
      await page.getByTestId('coverflow-next').click();
    }
    expect([...seen].sort()).toEqual([...INDUSTRY_IDS].sort());
    // It is circular: after the last industry comes the first again.
    await expect(status(page)).toHaveText(`Optometry, 1 of ${INDUSTRY_IDS.length}`);
    await page.getByTestId('coverflow-prev').click();
    await expect(status(page)).toContainText(`, ${INDUSTRY_IDS.length} of ${INDUSTRY_IDS.length}`);

    await page.getByTestId('coverflow-dot-legal').click();
    await page.getByRole('link', { name: 'Open law firm demo' }).click();
    await expect(page).toHaveURL(/#\/legal$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');
    expect(errors).toEqual([]);
  });

  test('carousel: a neighbouring card is centred first and only then opens', async ({ page }) => {
    await page.goto('#/');
    await page.getByTestId('hero-explore').click();
    await expect(page.getByTestId('coverflow-stage')).toBeInViewport({ ratio: 0.9 });
    await page.waitForTimeout(700);
    const next = page.locator('.cf-slide[data-slot="1"]');
    const id = (await next.locator('.icard').getAttribute('data-testid'))!.replace('industry-', '');
    await expect(next).toBeVisible();
    // Click the visible outer part of the neighbour (its inner edge sits under the centred card).
    const box = (await next.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.8);
    await expect(page).toHaveURL(/#\/$/);
    await expect(centred(page).getByTestId(`industry-${id}`)).toBeVisible();
    await page.waitForTimeout(500);
    // The whole centred card is the link, including while the pointer rests on it.
    await centred(page).hover();
    await centred(page).click();
    await expect(page).toHaveURL(new RegExp(`#/${id}$`));
  });

  test('carousel: keyboard arrows, Home and End work, and the neighbours are not tab stops', async ({ page }) => {
    await page.goto('#/');
    await page.getByTestId('coverflow-stage').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(status(page)).toContainText(`, 3 of ${N}`);
    await page.keyboard.press('ArrowLeft');
    await expect(status(page)).toContainText(`, 2 of ${N}`);
    await page.keyboard.press('End');
    await expect(status(page)).toContainText(`, ${N} of ${N}`);
    await page.keyboard.press('Home');
    await expect(status(page)).toHaveText(`Optometry, 1 of ${N}`);

    // Tab from the carousel reaches the centred card's link next, then the controls — never a hidden card.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Open optometry demo' })).toBeFocused();
    // Arrow keys still work from there, and focus does not stay on a card that has moved aside.
    await page.keyboard.press('ArrowRight');
    await expect(status(page)).toContainText(`, 2 of ${N}`);
    await expect(page.getByTestId('coverflow-stage')).toBeFocused();
    expect(await page.locator('.cf-slide:not([data-slot="0"]) a:not([tabindex="-1"])').count()).toBe(0);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/medical$/);
  });

  test('carousel: dragging moves it without opening a demo; module shortcuts follow the centred industry', async ({ page }) => {
    await page.goto('#/');
    await page.getByTestId('hero-explore').click();
    await expect(page.getByTestId('coverflow-stage')).toBeInViewport({ ratio: 0.9 });
    await page.waitForTimeout(700);
    const box = (await centred(page).boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    // Drag left across the centred card (which is itself a link): moves forward, does not navigate.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 60, y + 2, { steps: 4 });
    await page.mouse.move(x - 180, y + 4, { steps: 6 });
    await page.mouse.up();
    await expect(page).toHaveURL(/#\/$/);
    await expect(status(page)).toContainText(`, 2 of ${N}`);
    // Drag right: back again.
    await page.waitForTimeout(450);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 180, y, { steps: 8 });
    await page.mouse.up();
    await expect(page).toHaveURL(/#\/$/);
    await expect(status(page)).toHaveText(`Optometry, 1 of ${N}`);
    // A tiny movement is still a click.
    await page.waitForTimeout(450);
    await page.getByTestId('modules-open-optometry').click();
    await expect(page.getByRole('navigation', { name: 'Optometry modules' }).getByRole('link')).toHaveCount(9);
    await page.getByTestId('coverflow-next').click();
    await expect(page.getByTestId('modules-open-medical')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'General medical practice modules' })).toBeVisible();
    await page.getByTestId('coverflow-prev').click();
    await page.getByTestId('module-optometry-recalls').click();
    await expect(page.getByRole('heading', { name: 'Recalls', level: 1 })).toBeVisible();
  });

  test('jump buttons centre any industry in one click, without opening it', async ({ page }) => {
    await page.goto('#/');
    await expect(page.getByTestId('jump-chips').getByRole('button')).toHaveCount(N);
    await page.getByTestId('jump-recruitment').click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(centred(page).getByTestId('industry-recruitment')).toBeVisible();
    await expect(page.getByTestId('jump-recruitment')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('jump-chips').locator('[aria-pressed="true"]')).toHaveCount(1);
    // The buttons follow the carousel when it is moved another way.
    await page.getByTestId('coverflow-next').click();
    await expect(page.getByTestId('jump-recruitment')).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('jump-legal').click();
    await page.getByRole('link', { name: 'Open law firm demo' }).click();
    await expect(page).toHaveURL(/#\/legal$/);
  });

  test('phone: a dropdown replaces the buttons and centres the chosen industry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/');
    await expect(page.getByTestId('jump-chips')).toBeHidden();
    await page.getByTestId('jump-select').selectOption('hr');
    await expect(centred(page).getByTestId('industry-hr')).toBeVisible();
    await expect(centred(page)).toBeInViewport();
    expect(await overflowX(page)).toBeLessThanOrEqual(1);
  });

  test('reduced motion: the carousel still works and does not animate', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('#/');
    const duration = await page.locator('.cf-slide').first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
    await page.getByTestId('coverflow-next').click();
    await expect(status(page)).toContainText(`, 2 of ${N}`);
    await expect(centred(page).getByTestId('industry-medical')).toBeVisible();
    await context.close();
  });

  for (const width of [1440, 1024, 768, 390, 360]) {
    test(`layout at ${width}px: no sideways page scroll, centred card and controls fit`, async ({ page }) => {
      await page.setViewportSize({ width, height: width > 800 ? 1000 : 844 });
      await page.goto('#/');
      await page.waitForTimeout(200);
      expect(await overflowX(page)).toBeLessThanOrEqual(1);
      await page.getByTestId('coverflow-stage').scrollIntoViewIfNeeded();
      const card = (await centred(page).boundingBox())!;
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(width);
      // A neighbour peeks in on each side.
      for (const slot of ['-1', '1']) {
        const b = (await page.locator(`.cf-slide[data-slot="${slot}"]`).boundingBox())!;
        const visible = Math.min(b.x + b.width, width) - Math.max(b.x, 0);
        expect(visible, `slot ${slot} visible width`).toBeGreaterThan(16);
      }
      for (const id of ['coverflow-prev', 'coverflow-next']) {
        const b = (await page.getByTestId(id).boundingBox())!;
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(width);
      }
      await page.getByTestId('coverflow-next').click();
      await page.getByTestId('coverflow-next').click();
      expect(await overflowX(page)).toBeLessThanOrEqual(1);
      // The headline is not clipped.
      const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      expect(h1.x).toBeGreaterThanOrEqual(0);
      expect(h1.x + h1.width).toBeLessThanOrEqual(width);
    });
  }

  test('phone: a touch swipe moves the carousel', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto('#/');
    await page.getByTestId('coverflow-stage').scrollIntoViewIfNeeded();
    const box = (await centred(page).boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    const cdp = await context.newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', px: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y }] });
    await touch('touchStart', x);
    for (const dx of [-20, -60, -110, -150]) await touch('touchMove', x + dx);
    await touch('touchEnd', x - 150);
    await expect(status(page)).toContainText(`, 2 of ${N}`);
    await expect(page).toHaveURL(/#\/$/);
    expect(await overflowX(page)).toBeLessThanOrEqual(1);
    await context.close();
  });
});
