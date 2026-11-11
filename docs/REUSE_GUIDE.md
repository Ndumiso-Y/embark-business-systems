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
   `IndustryId` in `src/core/types.ts` and to `INDUSTRIES` in `src/industries/registry.ts`.
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
   rejections/cancellations, and `after` for side effects (create a linked record, adjust stock).
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

## 6. Honesty rules for every demo

- Every person, business, number, code and document is fictional. Use `example.com` emails and `555` phone numbers.
- Never claim real authentication, authorisation, compliance, integrations or persistence. The shell already
  shows "Demonstration"; add industry-specific limits to `boundaries`.
- Codes that look official (tariffs, case numbers) must be visibly fake (e.g. `DEMO-EX1`). Public
  classification codes (ICD-10 samples) may be shown as samples, labelled as such.
- Messages (SMS, email) are previewed and logged, never sent.
