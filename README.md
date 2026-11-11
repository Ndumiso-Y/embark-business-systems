# Embark Digitals — Industry management demos

A reusable, browser-only application foundation with five industry configurations, built by
Embark Digitals as discovery demonstrations. It is **not** a production system.

| # | Industry | Fictional business | Depth |
| --- | --- | --- | --- |
| 1 | **Optometry (priority)** | Northgate Optometry | Fully interactive practice workflows |
| 2 | General medical practice | Acacia Family Practice | Interactive core workflows |
| 3 | Automotive services | Torque Lane Auto Services | Interactive core workflows |
| 4 | Mining | Ridgeback Minerals | Interactive core workflows |
| 5 | Law firm | Mahlaba & Rossouw Attorneys | Interactive core workflows |

- Every business, person, record, code and figure is **fictional**.
- Data lives only in the visitor's browser (localStorage). Another browser or device starts fresh.
- Users, roles and permissions are a **simulation**. There is no real sign-in and no server-side access control.
- No backend, integrations, messaging, payments, or medical/legal/safety/financial compliance.

Lineage: the visual language, shell and money/date helpers are adapted from
`Ndumiso-Y/jnl-traders-business-system-demo` (that repository was read only and not changed).

## Run locally

```bash
npm install
```

```bash
npm run dev          # http://localhost:5173/embark-industry-demos/
```

```bash
npm test             # unit tests (vitest)
```

```bash
npm run typecheck && npm run lint
```

```bash
npm run e2e          # Playwright browser tests (first time: npx playwright install chromium)
```

```bash
npm run build        # GitHub Pages build (base /embark-industry-demos/)
npm run build:preview  # portable build with relative paths (dist-preview/)
```

## How to use the demo

1. Open the gallery (`#/`) and choose an industry.
2. Use **Signed in as** (top bar) to switch between fictional staff; each sees only their modules and actions.
3. Work through the workflows — buttons enforce business rules and explain why a step is blocked.
4. **Settings & reset** restores the starting data for that industry only.

## Documentation

| File | Contents |
| --- | --- |
| `docs/REUSE_GUIDE.md` | How the foundation works and how to add or adapt an industry |
| `docs/INDUSTRY_MODULES.md` | Modules, workflows and rules per industry, with the research behind them |
| `docs/BUSINESS_SCOPE_AND_LIMITATIONS.md` | What is demonstrated, simulated, and not built |
| `docs/QA_RESULTS.md` | Test runs and screenshot list |
| `qa/screenshots/` | Captures at desktop and mobile widths |

## Source layout

```
src/core/                  reusable foundation (no industry knowledge)
  types.ts                 IndustryConfig and related contracts
  engine.ts                access, workflow, validation, totals (pure, unit tested)
  store.ts  seed.ts        persisted store, seed helpers
  context.tsx              hooks bound to the active industry
  IndustryLayout.tsx       themed shell, sidebar, simulated user switcher
  components/              UI kit, generic register / board / detail / forms
  pages/                   gallery, users & permissions, settings, search
src/industries/<id>/       one configuration per industry (+ custom pages)
src/industries/registry.ts list of industries
tests/                     vitest unit tests
e2e/                       Playwright tests
```
