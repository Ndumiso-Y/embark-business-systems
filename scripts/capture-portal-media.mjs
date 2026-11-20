// Captures the homepage's device and card imagery from the running demos, so every
// picture of the software on the homepage is a real browser capture (sample data only).
//
//   npm run capture:portal            # starts its own dev server, writes src/core/portal/media/
//   PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run capture:portal
//
// Re-run after a visible change to a dashboard, then review the images before committing.
// The captures show today's date and today's sample figures; record the run in
// docs/design/04_asset_manifest.md.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { INDUSTRY_IDS } from '../src/industries/ids.ts';

const OUT = process.env.PORTAL_MEDIA_OUT ?? 'src/core/portal/media';
/** The demo shown inside the hero laptop and phone. */
const HERO = 'optometry';

mkdirSync(join(OUT, 'cards'), { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {});

/** Opens an industry dashboard in a fresh browser profile and hides the first-visit walkthrough. */
async function dashboard(id, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}#/${id}`);
  await page.locator('.dash-hero').first().waitFor();
  const hide = page.getByRole('button', { name: 'Hide', exact: true });
  if (await hide.count()) await hide.first().click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return { context, page };
}

try {
  {
    const { context, page } = await dashboard(HERO, { width: 1280, height: 800 });
    await page.screenshot({ path: join(OUT, `hero-${HERO}-desktop.png`) });
    await context.close();
  }
  {
    const { context, page } = await dashboard(HERO, { width: 390, height: 844 });
    await page.screenshot({ path: join(OUT, `hero-${HERO}-phone.png`) });
    await context.close();
  }
  for (const id of INDUSTRY_IDS) {
    const { context, page } = await dashboard(id, { width: 820, height: 640 });
    // Start at the page heading so the card shows the greeting, the day's banner and the first figures.
    const top = await page.locator('.dash-hero').first().evaluate((el) => Math.max(0, el.getBoundingClientRect().top + window.scrollY - 118));
    await page.screenshot({ path: join(OUT, 'cards', `${id}.jpg`), type: 'jpeg', quality: 84, clip: { x: 0, y: top, width: 820, height: 520 }, fullPage: true });
    await context.close();
    console.log(`captured ${id}`);
  }
} finally {
  await browser.close();
  await server.close();
}
