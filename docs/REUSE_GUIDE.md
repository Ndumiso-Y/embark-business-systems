# Reuse guide — building an industry demo on the Embark foundation

This repository is one reusable application foundation plus one configuration per industry. A new
industry demo is a folder under `src/industries/<id>/` that exports an `IndustryConfig`. You should not
need to touch `src/core/` to add an industry.

> All demos are browser-only and use fictional data. Do not describe a demo as having real sign-in,
> access control, compliance (medical, legal, safety, financial) or backend persistence. See
> "Honesty rules" at the end.

## 1. What the foundation gives you

| Area | Where | What you get |
| --- | --- | --- |
| Contracts | `src/core/types.ts` | `IndustryConfig`, `CollectionDef`, `FieldDef`, `WorkflowDef`, `Transition`, `ModuleDef`, `DemoUser`, `DemoRecord` |
| Pure logic | `src/core/engine.ts` | `can`, `hasModule`, `availableTransitions`, `applyTransition`, `validateValues`, `linesTotals`, `str`/`num`/`lines` value readers, `validateConfig` |
| Seed helpers | `src/core/seed.ts` | `seeder(today)` → `rec()`, `day()`, `line()`; `user()`; deterministic ids `<collection>_<n>` and refs `PREFIX-000n` |
| Store | `src/core/store.ts` | One persisted zustand store (localStorage key `embark-industry-demos-v1`), per-industry data, create/update/delete/transition, activity log, toasts, reset |
| Hooks | `src/core/context.tsx` | `useIndustry`, `useData`, `useUser` (`can`, `hasModule`), `useRecords`, `useActions` (`create`, `update`, `remove`, `transition`, `toast`, `def`), `useBase` |
| Shell | `src/core/IndustryLayout.tsx` | Themed sidebar grouped by `module.group`, top bar with simulated "Signed in as" switcher, search, demo pill, mobile drawer |
| Generic screens | `src/core/components/records.tsx` | `RegisterPage` (search, status filter, table/board toggle, create modal), `RecordDetail` (workflow stepper + actions + blocked reasons, details, history, edit, delete), `RecordTable`, `RecordBoard`, `WorkflowActions`, `History` |
| Forms | `src/core/components/fields.tsx` | `FieldInput` for every field type, `LinesEditor` (priced lines with VAT totals), `RecordFormModal`, `formatValue`, `money()` |
| UI kit | `src/core/components/ui.tsx` | `PageHeader`, `Stat`, `Panel`, `Tag`, `StatusTag`, `Flags`, `Notice`, `Field`, `Modal`, `Confirm`, `Empty`, `DueTag`, `Segmented`, `BarChart`, `Meters`, `Pipeline`, `KeyValues` |
| Built-in pages | `src/core/pages/` | Users & permissions matrix, Settings & reset (lists your `boundaries`), workspace Search, Gallery, Not found |
| Helpers | `src/core/lib/` | `dates.ts` (`todayIso`, `addDays`, `daysBetween`, `dueState`, `formatDate`, `monthShort` …), `money.ts` (integer-cent `computeTotals`, `formatRand`) |
| Icons | `src/core/components/Icons.tsx` | ~55 stroke icons (`IcoEye`, `IcoStethoscope`, `IcoHelmet`, `IcoWrench`, `IcoScale` …) |

Routes are automatic: `#/<industry>` (dashboard), `#/<industry>/<module>`, `#/<industry>/<module>/<recordId>`,
plus `/admin`, `/settings`, `/search`.

## 2. Steps to add an industry

1. **Create** `src/industries/<id>/index.ts` exporting a default `IndustryConfig`, and add the id to
   `IndustryId` in `src/core/types.ts` and to `INDUSTRY_IDS` in `src/industries/ids.ts`. To give it a client link,
   add it to `CLIENT_SLUGS` in `scripts/build-pages.mjs` (see `docs/SHARING_LINKS.md`).
2. **Describe the business**: `industry`, fictional `businessName`, `monogram` (2 letters), `workspaceTag`,
   `summary`, `highlights` (3–4 bullets for the gallery), `theme` (six accent colours; keep text contrast ≥ 4.5:1
   for `accentText` on `accentTint`).
3. **Roles and permissions**: `roles` are labels; `permissions` are action keys that workflow
   transitions (`permission`), sensitive fields (`FieldDef.permission`) and editing (`CollectionDef.editPermission`)
   check. Super admins bypass everything.
4. **Collections**: one `CollectionDef` per record type. Give each a `refPrefix`, `title()`, optional
   `subtitle()`, `fields` (mark `table: true` for register columns), optional `createFields` (short create form),
   `flags()` for computed attention tags (overdue, low stock …) and `sort`.
5. **Workflows**: `states` (with tones; mark final ones `terminal`) and `transitions`. Put business rules in
   `guard` (return a reason string to block — the reason is shown to the user), use `requiresNote` for
   rejections/cancellations, and `after` for side effects. `after` receives `{ record, data, today, user, note, api }`
   where `api.create`, `api.update` and `api.transition` act on other records (their own rules still apply).
6. **Modules**: each `ModuleDef` points at a `collection` (generic register + detail) and/or a custom `page`
   and `detail`. Use `group` to build the sidebar sections and `view: 'board'` for pipeline-style work.
7. **Seed**: `seed(today)` returns `{ users, collections, currentUserId }`. Use `seeder(today)`; express dates
   relative to today with `day(±n)` so the demo always looks current. Keep it deterministic (no `Math.random`;
   use a seeded PRNG like `prng()` in `optometry/seed.ts`). Users list module keys (plus built-ins
   `dashboard` and `admin`) and permission keys.
8. **Dashboard**: a component built from the UI kit with KPIs that are *specific to the industry*, computed
   from live records (never hard-coded numbers), an attention list, and at least one chart or pipeline.
9. **Boundaries**: list what the demo does *not* do in `boundaries` (shown on Settings).
10. **Test**: add `tests/<id>.test.ts` (see §5). `validateConfig(config)` must return `[]`.

## 3. Minimal example

```ts
import type { IndustryConfig } from '../../core/types';
import { seeder, user } from '../../core/seed';
import { str } from '../../core/engine';
import { IcoWrench } from '../../core/components/Icons';
import Dashboard from './Dashboard';

const config: IndustryConfig = {
  id: 'automotive', industry: 'Automotive services', businessName: 'Example Motors', monogram: 'EM',
  workspaceTag: 'WORKSHOP', tagline: '', summary: '…', highlights: ['…'], boundaries: ['…'],
  theme: { accent: '#b4572e', accent2: '#c66a40', accentSoft: '#f0b89a', accentTint: '#faece4', accentLine: '#f0d3c3', accentText: '#8c3f1f' },
  roles: [{ key: 'advisor', label: 'Service advisor' }],
  permissions: [{ key: 'jobs', label: 'Jobs', description: 'Move job cards' }],
  modules: [{ key: 'jobs', label: 'Job cards', icon: IcoWrench, group: 'Workshop', collection: 'jobs', view: 'board', description: '…' }],
  collections: [{
    key: 'jobs', singular: 'Job card', plural: 'Job cards', refPrefix: 'JC',
    title: (r) => str(r, 'vehicle'),
    fields: [{ key: 'vehicle', label: 'Vehicle', type: 'text', required: true, table: true }],
    workflow: {
      initial: 'booked',
      states: [{ key: 'booked', label: 'Booked', tone: 'dark' }, { key: 'done', label: 'Done', tone: 'green', terminal: true }],
      transitions: [{ from: 'booked', to: 'done', label: 'Complete', permission: 'jobs',
        guard: ({ record }) => (str(record, 'vehicle') ? null : 'Vehicle required') }],
    },
  }],
  seed: (today) => {
    const { collections, rec } = seeder(today);
    rec('jobs', 'JC', { vehicle: 'Demo hatchback' }, { status: 'booked' });
    return { users: [user('u1', 'Demo Advisor', 'Service advisor', 'advisor', ['dashboard', 'jobs'], ['jobs'])], collections, currentUserId: 'u1' };
  },
  dashboard: Dashboard,
};
export default config;
```

## 4. Making modules genuinely industry-specific

Renaming "Customers" to "Patients" is not a new demo. For each industry, start from the work people
actually do and the rules that bite them:

- **What moves through stages?** That is a workflow (patient flow, lab job, job card, permit, matter).
- **What must never happen?** That is a `guard` (exam not finalised without a diagnosis; vehicle work
  without customer approval; trust balance going negative; permit activation without isolation).
- **What goes overdue?** That is a `flags()` rule and a dashboard attention item (recalls, promised dates,
  licence/induction expiry, court deadlines).
- **What does one action cause elsewhere?** That is an `after` effect (exam → prescription + recall date).
- **Who must not see what?** That is a `FieldDef.permission` (clinical notes, HR detail, privileged notes).

Use custom `page`/`detail` components only where the generic register is the wrong shape (a diary,
an exam form, a shift log, a trust ledger). Everything else should stay configuration.

## 5. Tests

- `tests/engine.test.ts` covers the shared engine (access, transitions, guards, notes, validation, totals).
- Each industry adds a test that: runs `validateConfig(config)` and expects `[]`; builds the seed with a
  fixed date; and exercises at least two of its business rules through `applyTransition` (blocked and allowed).
- `e2e/*.spec.ts` (Playwright) drive the real UI. Run `npm run e2e`.

## 6. Lessons from building the five demos

The guide was tested by building medical, automotive, mining and legal from it in parallel, after optometry.
What those builds ran into, and how to handle it:

| Situation | Approach |
| --- | --- |
| A rule needs a value typed at the moment of the step (payment amount, gas reading) | Store it on the record first (a field or a small form on the custom detail page), then let the `guard` read it |
| A note is only sometimes required (e.g. only when a reading exceeds a limit) | Leave `requiresNote` off and check `note` inside the `guard`; give the custom page a "with note" form |
| Two separate steps with the same from/to states | Not supported — use one transition and branch in the guard/after |
| Clinical or privileged detail in a computed flag | `flags(r, data, today, user)` receives the user — return a neutral label for roles without the permission |
| "Today" in tests | Keep a `todayStr()` / `setTodayForTests()` pair in the industry's `helpers.ts` (see optometry) |
| Circular imports between config and pages | Put rules and lookups in `helpers.ts`; `index.ts` imports pages, pages import helpers |
| A record created from a register should be linked to its parent (estimate → job) | Create it from the parent's detail page with `initial` values, or resolve the link in a helper |

## 6a. What the November 2026 audit added (use these)

| Need | Use |
| --- | --- |
| Show a newcomer what to try | `guide: GuideStep[]` on the config — 5–6 steps, each `to` a module (or `module/recordId`), `as` a seeded user. `validateConfig` checks the module, user and — across seven consecutive days — that a linked record exists in the same state |
| A blocked step needs a value | Put a small form for that value on the detail page next to the workflow, and make the guard message point to it. Never answer "Edit → field" |
| Your page has its own button for a step | `<RecordDetail hideTransitions={['state']}>` / `<WorkflowActions hide={[...]}>` so the generic button does not appear twice |
| Prefill the "New …" form | `CollectionDef.createDefaults(today, data)` |
| Keep a value on the record but out of generic forms and details | `FieldDef.hidden`; show units with `FieldDef.unit` |
| Limit a record picker | `FieldDef.refFilter(target, values, data)` (pickers over 12 options get a type-to-filter box automatically) |
| Tell the user what a required note should say | `Transition.noteHint` |
| Month charts | `monthKeys(today, n)` from `core/lib/dates` — never subtract ~30 days repeatedly |
| Records the walkthrough links to | Give them stable ids (create them before any weekday-dependent history) |
| Time | Rules and flags use dates only ("kept overnight"), never hours on the wall clock; seeded "today" must look right at 07:00 and at 22:00 |
| Business name | `useIndustry().businessName` — never hard-code it; client branding replaces it at runtime (`docs/BRANDING.md`) |
| Check your work | Follow `docs/AUDIT_BRIEF.md` and add `e2e/journeys/<id>.spec.ts` |

## 7. Honesty rules for every demo

- Every person, business, number, code and document is fictional. Use `example.com` emails and `555` phone numbers.
- Never claim real authentication, authorisation, compliance, integrations or persistence. The shell already
  shows "Demonstration"; add industry-specific limits to `boundaries`.
- Codes that look official (tariffs, case numbers) must be visibly fake (e.g. `DEMO-EX1`). Public
  classification codes (ICD-10 samples) may be shown as samples, labelled as such.
- Messages (SMS, email) are previewed and logged, never sent.
