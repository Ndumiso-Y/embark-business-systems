# Design-lock addendum — optometry dashboard (November 2026)

**Status: built on branch `design/optometry-dashboard-2026-11` — HOLD FOR OWNER APPROVAL. Not merged, not deployed.**

Scope: the optometry dashboard (`#/optometry`) and the minimum shell colouring that goes with it (sidebar, top bar,
canvas — for the optometry demo only). `02_design_lock.md` (interior v2) still governs every other industry and every
other optometry screen's layout. `05_homepage_addendum_2026-11-20.md` is unchanged apart from re-captured screens.

## Authority

| Item | Detail |
| --- | --- |
| Visual authority | `OPTOMETRY_DASHBOARD_APPROVED_VISUAL.png` (1672×941) from the owner's handoff package, November 2026. A generated concept: approved for composition and character. Its names, numbers, logo, photo and icons are illustrative. Not stored in this repository. |
| Rules applied | Config wins over the mockup for names and colours; records win over the mockup for every figure; nothing from the previous dashboard may become unreachable. |

## What was built

| Area | Decision |
| --- | --- |
| Shell (optometry only) | Deep navy sidebar derived from the practice colour, light text, blue pill for the active item, cool near-white canvas. Same markup, groups, destinations, search, role switcher and Demonstration label as before. |
| Default colour | Optometry's default theme changed from teal to the concept's blue (`themeFromHex('#2563c9')`, so text contrast is guaranteed). This applies across the optometry demo. Client branding replaces it exactly as before. |
| Greeting | `Good day, <first name>` from the simulated user (neutral: no time-of-day claim), a one-line subtitle with the business name from config, the demo's date, and the existing "Open today's diary" action. |
| KPI strip | Appointments today (featured) · In the practice now · Ready for collection · Claims awaiting payment · Recalls due. Each card is a link when the user has that module. |
| Patient flow | Ring + legend from today's appointments, with the lens-dial artwork (or the cover photo once one is cleared). |
| Today's diary | "Now and next" (4 rows), expandable to the whole day. Same `today-list`. |
| Lower row | Recent patients · Optical orders (two tiles, every stage on demand) · Needs attention (3 rows, all on demand). Same `attention-list`. |
| On demand | "Show trends and recent activity" reveals the six-month chart, exams this month and the activity list from the previous dashboard. The role bar stays at the foot. |

## Where every number comes from

All definitions live in `src/industries/optometry/dashboardModel.ts` (unit tested) and the dashboard component.

| Shown | Definition |
| --- | --- |
| Appointments today | Appointment records dated today (all statuses) |
| In the practice now | Today's appointments with status Checked in, Pre-test, In consulting room or Dispensing |
| Still to arrive / Completed / Did not attend | Today's appointments with status Booked / Completed / Did not attend |
| **Ring percentage** | **Completed ÷ today's appointments that were not cancelled**, rounded to a whole percent. The same sentence is written out under the ring ("4 of 16 visits completed") and in the ring's accessible name. Cancelled visits are listed separately as "not counted". |
| Ready for collection | Optical orders with status Ready to collect |
| At the lab / in QC | Optical orders with status At lab, Received or Remake |
| Claims awaiting payment | **A Rand amount, not a count**: for claims Submitted or Part paid, claim total minus what the scheme has paid. The count of open and rejected claims is the caption. |
| Recalls due | Patients returned by the existing recall rule (`dueRecalls`); caption = those already past their date. Shown only to users with the Recalls module (as the "recalls overdue" link was before). |
| Now and next | Patients in the practice first, then those still to arrive, in time order; near the end of the day the latest finished visits fill the rows |
| Recent patients | Patients seen or being seen today, most recent first, one row each |
| Needs attention | Unchanged rules: past promised date, uncollected 14+ days, rejected claims, unfinalised exams, low stock — filtered by the user's modules |

Not shown because the data does not support it: a "+4" trend badge (no prior-period comparison exists), a notification
bell (there are no notifications), date arrows (the dashboard has no other day to show).

## Moved, not removed

| Previous dashboard | Now |
| --- | --- |
| Dark banner "16 appointments · 4 patients in the practice now …" | KPI cards and the flow legend carry the same figures |
| "N recalls overdue" banner button | Recalls due card (links to Recalls) |
| Stat "Exams this month · N in progress" | Tag on the six-month chart under "Show trends and recent activity" |
| Full list of today's appointments | "Show all N appointments" in Today's diary |
| Optical jobs pipeline (every stage) | "Show every stage" in Optical orders |
| Needs attention (up to 8) | First three, then "Show all N" (all of them) |
| Six-month chart, recent activity, next recall note | "Show trends and recent activity" |
| Per-practitioner split under "Appointments today" | Shown in the Today's diary heading once the whole day is expanded |

## Tokens (optometry only, `src/industries/optometry/optometry.css`)

| Token | Value | Note |
| --- | --- | --- |
| Theme (`IndustryConfig.theme`) | accent `#2462c6`, accent2 `#3070d9`, soft `#a5bfe9`, tint `#ecf1f9`, line `#cfdaed`, text `#184081` | White on accent 5.8:1; text on tint 8.9:1 |
| `--opt-navy` / `--opt-navy-2` | `color-mix(accent-text 24%, #0a1727)` / `color-mix(accent-text 46%, #0c1c31)` | Sidebar and featured card; follows a client's brand colour, stays dark |
| `--opt-canvas` | `#f2f5fa` | |
| `--od-ink` / `--od-muted` / `--od-line` | `#101722` / `#53647a` / `#e1e8f1` | From the handoff's provisional tokens |
| Panels | white 90%, radius 24 (KPI cards 22), one soft shadow | |
| Icon medallion | 42 px circle (36 px in lists), 20 px icon, 1.7 stroke | One icon family: the repository's own SVG set; each card uses the same icon as its module in the menu |
| Type | Greeting up to 36 px; KPI values up to 44 px; panel titles 20–24 px; body 13–15 px | Inter, as elsewhere |
| Status colour | Blue family for progress; green only for "Ready to collect"; amber/red only for attention and did-not-attend | Always paired with a label |

Client branding: every colour above derives from the six `--accent*` variables, so `?name=…&accent=…`, a brand
file or the Settings branding tool re-tints the sidebar, featured card, ring and artwork and replaces the name
(covered by a browser test). A client logo sits on a white plate in the dark sidebar.

## Deviations from the approved concept

| # | Concept shows | Built | Why | Needs |
| --- | --- | --- | --- | --- |
| 1 | Photograph of a phoropter in the flow panel; spectacles photo in the sidebar | Abstract lens dial drawn in SVG in the practice colour; no sidebar photo | No rights-cleared optical photography exists yet (asset manifest) | A licensed or owner-generated optometry image: set `image` on the config and the flow panel uses it |
| 2 | Embark logo at the top of the sidebar, business name in a top-bar dropdown | The practice's own monogram/name (or the client's logo) at the top of the sidebar, as in every demo; Embark credited at the foot | That slot is what client branding replaces; there is only one business to choose, so a dropdown would do nothing | Owner decision if Embark should be more prominent |
| 3 | "Riverview Optometry", "Dr. James Dale", 24 Sep 2024, 28 / 6 / 12 / 3 / 17 | Northgate Optometry (config), the signed-in simulated user, the demo's date, the real figures | Config and records win | — |
| 4 | "Good morning, Dr. Dale" | "Good day, Lerato" | Neutral greeting kept (also what existing tests and other industries use) | — |
| 5 | Claims awaiting payment: 3 | A Rand amount with the count as caption | The system has always reported the amount outstanding | — |
| 6 | "+4" badge, bell, date arrows | Omitted | No data or function behind them | — |
| 7 | "71% In Progress" | "25% completed" with the calculation written beside it | The 71% had no formula | — |
| 8 | Legend: Arrived, In Examination, Dispensing, Completed | Still to arrive, In the practice now, Completed, Did not attend (+ the in-practice breakdown in the caption) | These four always add up to the day's visits; the mockup's rows overlapped | — |
| 9 | Flat menu (7 items), "Optometry Suite" | The demo's real grouped menu (9 modules + admin) and its configured workspace label | Navigation and destinations must not change | — |
| 10 | Needs attention as three totals | The existing itemised alerts, three at a time | Each row goes straight to the record to fix; totals are already in the KPI strip | — |
| 11 | Everything on one 941 px screen | About 1,450 px at 1440 wide (KPIs, flow and diary are in the first screen) | Real names, captions and 44 px touch targets need more room than the mockup's tiny type | — |
| 12 | Top-bar business pill, "Demo Environment" | Existing breadcrumb and "Demonstration" pill | Shared top bar left functionally and textually unchanged | — |

## Files

> **26 Nov 2026:** the reusable parts (navy shell, KPI cards, ring, lists, toggles) moved to a shared kit —
> `src/core/components/overview.tsx` and `src/styles/overview.css`, opted into with `shell: 'navy'`. Only the
> lens artwork stays in `optometry.css`. Optometry is pixel-identical before and after; see `08_medical_dashboard_addendum_2026-11.md`.


| File | Role |
| --- | --- |
| `src/industries/optometry/pages/Dashboard.tsx` | The dashboard |
| `src/industries/optometry/dashboardModel.ts` | Figures and short lists (pure, unit tested) |
| `src/industries/optometry/optometry.css` | All styling, scoped to `.app[data-industry="optometry"]` and `.od` |
| `src/industries/optometry/index.ts` | One line: the default theme |
| `scripts/capture-portal-media.mjs` | Understands the new dashboard; `PORTAL_MEDIA_ONLY=<id>` re-captures one industry |
| `src/core/portal/media/hero-optometry-*.png`, `cards/optometry.jpg` | Re-captured so the homepage shows the current dashboard |
| `e2e/optometry-dashboard.spec.ts`, `tests/optometry-dashboard.test.ts`, `e2e/optometry.spec.ts` | Tests |

No shared stylesheet, shared component or other industry file was changed.

## Browser evidence (20 Nov 2026, Chromium)

Before/after captures: `docs/design/evidence/2026-11-optometry-dashboard/`.

| Item | Observed | Status |
| --- | --- | --- |
| 1440 vs concept | Same order and character: navy sidebar, greeting + date, five-card strip with a dark featured card, flow panel with ring/legend/art beside the diary, three cards below. Differences are the deviations above | ORANGE (photo pending) |
| 1280 / 1024 / 768 | 1280 keeps the full desktop layout; at 1024 and 768 the featured card takes its own line and the flow panel sits above the diary; no stranded cards | GREEN |
| 390 / 360 | No sideways scroll (0 px), values and labels inside their cards, 44 px toggles | GREEN |
| Other industries | Mining (1440, 390) and medical (1440) dashboards pixel-identical before and after | GREEN |
| Homepage | Identical except the three re-captured optometry screens | GREEN |
| Other optometry screens | Same layout; sidebar navy and accents blue (diary compared) | GREEN — intended |
| Figures, disclosures, keyboard, permissions, branding | Automated in `e2e/optometry-dashboard.spec.ts` | GREEN |

Not checked: Safari, Firefox, real phones, an assistive-technology walkthrough.

## Rollback

The change is one commit on its branch. Before merge: delete the branch. After merge: `git revert <merge commit>`.
