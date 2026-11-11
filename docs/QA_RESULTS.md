# QA results

Run on 11 Nov 2026 in a Linux cloud container (Node 22, Chromium via Playwright 1.52).

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Pass |
| Lint | `npm run lint` | 0 errors, 8 warnings (react-refresh "only export components" — dev hot-reload hint only) |
| Unit tests | `npm test` | **87 passed** in 6 files: engine 13 · optometry 11 · medical 13 · automotive 12 · mining 17 · legal 21 |
| Browser tests | `npm run e2e` | **21 passed**: 5 cross-industry smoke, 9 optometry workflows, 7 client-link checks (run with `PAGES_URL` against the Pages build) |
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

## Client links

`e2e/client-links.spec.ts` builds on `npm run build:pages` served at the same path as GitHub Pages: each of the five
client links opens its own dashboard with the right page title, shows no "All industry demos" link, redirects the
gallery route and every other industry's route back to its own dashboard, and contains none of the other businesses'
names; the root page has no links; the unlisted hub shows all five industries.

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
