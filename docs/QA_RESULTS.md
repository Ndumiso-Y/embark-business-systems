# QA results

## Homepage redesign — 20 Nov 2026 (branch `design/homepage-coverflow-2026-11-20`, not merged)

Same container (Node 22, Chromium via Playwright). Design record: `docs/design/05_homepage_addendum_2026-11-20.md`.

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck` | 0 | Pass |
| Lint | `npm run lint` | 0 | 0 errors, 6 warnings (all in files this change did not touch, plus the existing route helpers) |
| Unit tests | `npm test` | 0 | **360 passed** in 15 files (8 new: carousel position maths and card lines) |
| Browser tests, dev server | `npm run e2e` | 0 | **147 passed**, 14 skipped (the 14 client-link checks need the built site) |
| Browser tests, built site | `PAGES_URL=… LIVE_URL=…/hub-k7q3m9/ playwright test client-links homepage` | 0 | **26 passed**: 14 client-link checks + 12 homepage tests against the built hub |
| Production build | `npm run build` | 0 | Pass — JS 2,090 kB (621 kB gzip), CSS 64 kB, plus 15 homepage images (≈0.9 MB) |
| Multi-link build | `npm run build:pages` | 0 | Pass — client builds contain no homepage code or images (checked `optometry/assets`) |

New homepage tests (`e2e/homepage.spec.ts`, 12): hero copy, both device images load, mark shown at its natural
proportions, no WhatsApp link and no links in the header, both actions land where they say; all 12 industries
centred in turn with the next arrow, one `Open … demo` link at a time with the right address, one dot per industry;
circular wrap; a neighbouring card centres first and opens only on the second click (also while hovered); Left /
Right / Home / End and the tab order; mouse drag both ways without navigating; module shortcuts follow the centred
industry; reduced motion; layout at 1440, 1024, 768, 390 and 360 px (no sideways page scroll, neighbours peek, 44 px
controls, headline unclipped); touch swipe at 390 px.

Found and fixed while testing: hovering the centred card moved its arrow with a CSS transform, which made the arrow
the containing block for the card-wide link area, so only a narrow strip stayed clickable. The arrow icon now moves
instead of the link.

Changed existing tests: `e2e/optometry.spec.ts` and `e2e/client-links.spec.ts` asserted that all twelve cards were
visible at once; a carousel shows about five, so they now assert every card exists and every industry has a visible
position dot, and centre an industry before opening its module list.

Not tested: Safari, Firefox, real phones, assistive-technology walkthrough.

---

Latest full run 12 Nov 2026 in a Linux cloud container (Node 22, Chromium via Playwright 1.52).

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Pass |
| Lint | `npm run lint` | 0 errors, 8 warnings (react-refresh "only export components" — dev hot-reload hint only) |
| Unit tests | `npm test` | **352 passed** in 14 files: engine 13 · brand 8 · optometry 16 · medical 18 · automotive 13 · tyres 18 · mining 21 · construction 29 · real estate 24 · legal 26 · security 50 · cleaning 40 · education 47 · mall 29 |
| Browser tests | `npm run e2e` | **149 passed** against the built site: 12 cross-industry smoke · 9 optometry workflows · 5 shared-foundation · 4 branding · 14 client-link checks · 105 end-to-end journeys across the twelve industries (`e2e/journeys/`) |
| Production build | `npm run build` | Pass — JS 780 kB (238 kB gzip), CSS 37 kB |
| Preview build | `npm run build:preview` | Single self-contained HTML (~800 kB) boots with no console errors |

## What the browser tests cover

**Every industry** (`e2e/industries.spec.ts`): dashboard renders with KPIs; every sidebar module opens; the first record
in each register opens its detail page; Users & permissions and Settings render; at least two fictional users see
fewer modules than the administrator; no page errors or console errors throughout.

**Optometry** (`e2e/optometry.spec.ts`):
1. Gallery lists all five industries and opens the optometry dashboard with 16 appointments today.
2. An exam cannot be finalised without a diagnosis (reason shown); after choosing one and saving, finalising issues a prescription; the result survives a reload.
3. Front desk does not see Eye examinations and gets "No access" on the direct URL.
4. Lab board refuses to send a job with an expired prescription (reason shown) and moves a received job through QC to "Ready to collect".
5. Booking from an empty planner slot works; a booking that clashes with an existing appointment is refused.
6. Patient flow board checks a patient in.
7. A draft medical-aid claim submits once its checks pass.
8. A recall reminder is previewed and logged as "not sent"; Settings → Reset restores the seed.
9. At 390 px wide the navigation drawer works and no page scrolls sideways.

## Issues found and fixed during QA

- **Compact currency formatting** (inherited from the JNL helper): amounts from R100,000 were divided by R100,000 and labelled "m" (R103,000 showed as "R1.03m"). Fixed and unit-tested. The JNL repository has the same latent code but never calls the compact option, so nothing visible is affected there; it was not changed.
- Clinical attention flags (vitals, allergy matches) were visible to non-clinical roles in the medical demo. `flags()` now receives the current user and medical hides clinical detail from roles without *View clinical*.
- Long attention tags overflowed narrow board cards; they now wrap.
- The trust-ledger table was squashed at desktop width; it now keeps a minimum width and scrolls inside its panel.

## Functional audit (November 2026)

Every industry was driven through its real screens as a first-time user, fixed where it stalled, and its journey
kept as a permanent browser test. Findings and fixes are in `docs/AUDIT_REPORT.md`. The journey tests were also run
with the browser clock pinned to early morning, late evening, a Sunday and the first of a month, to catch anything
that only looks right at certain times.

## Client links

`e2e/client-links.spec.ts` builds on `npm run build:pages` served at the same path as GitHub Pages: each of the twelve
client links opens its own dashboard with the right page title, shows no "All industry demos" link, redirects the
gallery route and every other industry's route back to its own dashboard, and contains none of the other businesses'
names; the root page has no links; the unlisted hub shows all twelve industries.

## Deployment check (11 Nov 2026)

- Pushed to `Ndumiso-Y/embark-business-systems`; GitHub Actions run 43086155126 succeeded (typecheck, unit tests,
  build, upload, deploy). GitHub reports the `github-pages` deployment as **success** at
  https://ndumiso-y.github.io/embark-business-systems/.
- The cloud container that ran these checks cannot reach `github.io` (blocked by its network policy), so the live URL
  itself was not opened from there. Instead the same production build was served locally at the identical path
  (`/embark-business-systems/`) and the full browser suite passed: **14 passed**.
- Open the live link once in a normal browser to confirm.

## Not tested

- Real devices and browsers other than Chromium (Safari/Firefox untested).
- Screen-reader walkthrough (keyboard focus states and labels exist but were not audited with assistive technology).
- Printing: the prescription Print button uses the browser print dialog, which the hosted artifact preview blocks.

## Screenshots

`qa/screenshots/` — desktop (1440 px) captures of the gallery, every industry dashboard and key screens
(optometry diary, exam, lab board, recalls, reports, users; medical waiting room; automotive workshop board; mining
shift log; legal trust ledger), and mobile (390 px) captures of the gallery, dashboards, diary and waiting room.
