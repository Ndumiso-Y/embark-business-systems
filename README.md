# Embark Digitals — Industry management demos

A reusable, browser-only application foundation with twelve industry configurations, built by
Embark Digitals as discovery demonstrations. It is **not** a production system.

| # | Industry | Fictional business | Depth |
| --- | --- | --- | --- |
| 1 | **Optometry (priority)** | Northgate Optometry | Fully interactive practice workflows |
| 2 | General medical practice | Acacia Family Practice | Interactive core workflows |
| 3 | Automotive services | Torque Lane Auto Services | Interactive core workflows |
| 4 | Mining | Ridgeback Minerals | Interactive core workflows |
| 5 | Law firm | Mahlaba & Rossouw Attorneys | Interactive core workflows |
| 6 | Real estate | Kestrel Property Group | Interactive core workflows |
| 7 | Construction | Ironbark Building & Civils | Interactive core workflows |
| 8 | Tyre & fitment centre | TreadRight Tyre & Fitment | Interactive core workflows |
| 9 | Security services | Sentinel Ridge Security | Interactive core workflows |
| 10 | Cleaning services | BrightPath Cleaning Services | Interactive core workflows |
| 11 | Education | Marula Ridge Academy | Interactive core workflows |
| 12 | Shopping centre | Harbour Crossing Mall | Interactive core workflows |

- Every business, person, record, code and figure is **fictional**.
- Any demo can be **branded for a client** (name, logo, colours) — see `docs/BRANDING.md`.
- Each dashboard opens with a **guided walkthrough** of the things worth trying.
- Data lives only in the visitor's browser (localStorage). Another browser or device starts fresh.
- Users, roles and permissions are a **simulation**. There is no real sign-in and no server-side access control.
- No backend, integrations, messaging, payments, or medical/legal/safety/financial compliance.

## Live links

Each industry has its own link. A client link contains **only that industry** — no gallery, no links to the
other demos, and none of their code or data.

| Industry | Client link |
| --- | --- |
| Optometry | https://ndumiso-y.github.io/embark-business-systems/optometry/ |
| General medical practice | https://ndumiso-y.github.io/embark-business-systems/medical-practice/ |
| Automotive services | https://ndumiso-y.github.io/embark-business-systems/automotive/ |
| Mining | https://ndumiso-y.github.io/embark-business-systems/mining/ |
| Law firm | https://ndumiso-y.github.io/embark-business-systems/law-firm/ |
| Real estate | https://ndumiso-y.github.io/embark-business-systems/real-estate/ |
| Construction | https://ndumiso-y.github.io/embark-business-systems/construction/ |
| Tyre & fitment centre | https://ndumiso-y.github.io/embark-business-systems/tyre-fitment/ |
| Security services | https://ndumiso-y.github.io/embark-business-systems/security/ |
| Cleaning services | https://ndumiso-y.github.io/embark-business-systems/cleaning/ |
| School | https://ndumiso-y.github.io/embark-business-systems/school/ |
| Shopping centre | https://ndumiso-y.github.io/embark-business-systems/shopping-centre/ |

The site root shows a neutral Embark Digitals page that lists nothing. The full hub with every industry is at an
unlisted address for internal use — see `docs/SHARING_LINKS.md`.

- **Repository:** https://github.com/Ndumiso-Y/embark-business-systems
- **Deploys:** GitHub Actions on every push to `main` (typecheck → unit tests → `npm run build:pages` → Pages).

Lineage: the visual language, shell and money/date helpers are adapted from
`Ndumiso-Y/jnl-traders-business-system-demo` (that repository was read only and not changed).

## Run locally

```bash
npm install
```

```bash
npm run dev          # http://localhost:5173/
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
npm run build        # full hub build in dist/ (all industries)
npm run build:pages  # GitHub Pages site in dist-pages/ (one locked site per industry + hub + root page)
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
| `docs/BRANDING.md` | Show any demo in a client's own name, logo and colours |
| `docs/AUDIT_REPORT.md` | Functional audit: what was tested as a first-time user, what was fixed, known limits |
| `docs/design/` | Design lock (references, tokens, screen map) and the cover-photo asset manifest |
| `docs/SHARING_LINKS.md` | Client links, the unlisted hub, and what "private" means on a public site |
| `docs/INDUSTRY_STRATEGY.md` | How industries are chosen, the four families, and what to build next |
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
