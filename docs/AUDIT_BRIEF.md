# Functional audit brief (for auditors)

Question to answer for each industry: **if a prospect opens this demo cold and plays with it, does it actually
work, and can they tell how the real system would function?** Audit as that prospect, in a real browser, through
the UI only.

## Setup
- Repo: /home/user/embark-business-systems (Vite + React, hash routing, data in localStorage, fictional).
- Read docs/REUSE_GUIDE.md, then your industry's `src/industries/<id>/` (index.ts, helpers.ts, pages/) and its test.
- Run a dev server that contains ONLY your industry (other industries are being built and may not compile):
  `DEMO_INDUSTRY=<id> npx vite --port <your port> --strictPort` (background it; stop it when done).
- Drive it with Playwright: `require('playwright')`, `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`.
  Run specs with:
  `LIVE_URL=http://localhost:<port>/ PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx playwright test e2e/journeys/<id>.spec.ts --trace off`
- Each test starts with empty storage, so the seed is fresh. Routes are `#/<id>`, `#/<id>/<module>`, `#/<id>/<module>/<recordId>`.
  Seed ids are deterministic (`<collection>_<n>`). `data-testid="user-switcher"` switches the simulated user;
  toasts are `.toast`; the sidebar is `getByLabel('Main navigation')`. See e2e/optometry.spec.ts for style.

## What to check (as a first-time user)
1. **Core journey end to end through the UI**: take the industry's main record from its first state to its final
   state by clicking the real buttons and filling the real forms (e.g. job arrives → … → invoiced and paid). Every
   blocked step must say why AND the user must be able to find where to fix it on that screen or one click away.
   A blocked step whose fix is hidden in a generic "Edit" form with 25 fields counts as a finding — add a focused
   control or a clear pointer.
2. **Every module**: open it, use its main action (create a record with the "New …" button, save, see it listed;
   move at least one record a step). Look for dead buttons (click → nothing visible happens), forms that cannot
   be saved, actions with no feedback, empty panels that should have data, numbers that contradict each other
   (dashboard count vs list), dates/times that only look right at a certain time of day, and text that
   overflows or is cut off.
3. **Each simulated user**: switch to every user. Each must land somewhere useful, see a sensible menu, and be able
   to do their own job (a role that can see a workflow but can do nothing in it, with no explanation, is a finding).
4. **Mobile (390×844)**: dashboard and the two most important screens must be usable with no sideways page scroll.
5. **Honesty**: nothing may claim real sign-in, security, compliance, integrations or sent messages. Official-looking
   codes must be visibly fake. The business name must never be hard-coded in pages or message templates — use
   `useIndustry().businessName` (a branding feature replaces it at runtime); fix any you find.
6. **Does it show where it's going?** After the journey, would a prospect understand what the real system would do
   for them? If a key selling point is buried, surface it (dashboard link, clearer label, short helper text).

## What to deliver
- **Fix what you find** inside `src/industries/<id>/**` and `tests/<id>.test.ts` only. Do NOT edit `src/core/**`,
  `src/styles/**`, other industries, e2e files other than your own, configs, package.json or docs. If the cause is
  in core or shared CSS, do not work around it badly — report it precisely (file, what happens, suggested fix).
- **`e2e/journeys/<id>.spec.ts`**: the core journey as a permanent Playwright test (plus 1–2 blocked-step checks and
  a role check). It must pass on a fresh seed, repeatedly, and not depend on the time of day.
- **`guide` in the industry config** (see `GuideStep` in src/core/types.ts and optometry's `guide`): 5–6 steps a
  newcomer should try, each `to` a real module (or `module/recordId`), `as` a seeded user who can do it. Each step
  must really work on a fresh seed — click through each one in your spec via `data-testid="guide-step-N"` on the
  dashboard. If an industry already has a `guide`, verify and improve it.
- Keep `npx vitest run tests/<id>.test.ts` passing and `npx tsc -b 2>&1 | grep <id>` and
  `npx eslint src/industries/<id> e2e/journeys/<id>.spec.ts` clean.
- Do not commit or push. Stop your dev servers and delete temporary files when done.

## Report (concise, per industry)
1. Verdict: does the core journey work end to end for a newcomer? (yes / yes after fixes / no)
2. Findings table: severity (blocker / confusing / cosmetic) · what a user would experience · fixed? (yes + how / no + why)
3. Core or shared issues you could not fix (precise).
4. Test results: journey spec summary line, unit test summary line.
5. Anything a salesperson should know before demoing it.
