// Temporary capture helper for the medical dashboard work (not committed).
import { chromium } from '@playwright/test';
const [out, tag, ...pages] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const spec of pages) {
  const [name, path, w, h, png] = spec.split('|');
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:5174/' + path); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
  const hide = p.getByRole('button', { name: 'Hide', exact: true }); if (await hide.count()) { await hide.first().click(); await p.waitForTimeout(250); }
  const file = `${out}/${tag}-${name}-${w}.${png ? 'png' : 'jpg'}`;
  await p.screenshot(png ? { path: file, fullPage: true } : { path: file, type: 'jpeg', quality: 86, fullPage: true });
  console.log(name, w, 'overflowX', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'errors', errs.length, errs[0] ?? '');
  await ctx.close();
}
await b.close();
