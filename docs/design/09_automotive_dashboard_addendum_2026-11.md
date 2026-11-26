# Design-lock addendum — automotive workshop dashboard (November 2026)

**Status: built on branch `design/automotive-dashboard-2026-11` — HOLD FOR OWNER APPROVAL. Not merged, not deployed.**
The branch sits on top of the optometry and medical dashboard branches (both awaiting approval), because all three
share one dashboard kit (`08_medical_dashboard_addendum_2026-11.md`).

Scope: the automotive dashboard (`#/automotive`) and the automotive demo's shell colours. Other automotive screens keep
their layout and pick up only the navy sidebar. No other industry changes.

## Authority

| Item | Detail |
| --- | --- |
| Visual authority | `APPROVED_AUTOMOTIVE_DASHBOARD_CONCEPT.png`, owner handoff (automotive), November 2026. A generated concept for layout and character; "Velocity Automotive", "Michael", the SUV photo, the figures, "+20% vs last Tue" and "Weekly capacity 32/40" are illustrative. Not stored in this repository. |
| Process | Playbook ED-WEB-001 (v1.0 active; v1.1 candidate used as guidance only). |
| Rules | Config wins for names and colours; records win for every figure; the approval-before-work and QC rules stay intact and visible. |

## What was built

| Area | Decision |
| --- | --- |
| Shell | Navy sidebar with the workshop's own copper accent (`#b4572e`, unchanged). The handoff noted the concept's blue as a stylised theme; the copper keeps the demo's identity and client branding still replaces it (a blue example is in the evidence). |
| Header | `Good day, <first name>`, subtitle with the configured business name, the demo's date, a "N need attention" button, "Open workshop board". |
| KPI strip | Today's bookings (featured) · In the workshop · Awaiting approval · Ready for collection · Unpaid invoices. A user without invoices (the technician) sees "Parts low" in that slot. |
| Workshop flow | Ring with the number of vehicles on site, legend by job-card stage with count and share, a drawn generic vehicle (or the cover photo once cleared), a six-step stage track, and the line "Work starts only after the customer approves the estimate; every vehicle passes a quality check before it is released". |
| Today's bookings | Job cards planned today in start-time order, five then "Show all"; "View all" opens the bay planner. |
| Lower row | Open job cards (table, longest on site first) · Bay capacity (hours booked of bays × 8 h, then per bay) · Needs attention (first three, "Show all"). |
| Second row | Awaiting customer approval (`awaiting-list`) · Ready for collection (`ready-list`) — the previous dashboard's lists, unchanged. |
| On demand | Revenue chart with the service-overdue note, low stock, recent activity; role bar at the foot. |

## Where every number comes from

Definitions in `src/industries/automotive/dashboardModel.ts` (unit tested) and the dashboard.

| Shown | Definition |
| --- | --- |
| Today's bookings | Job cards with today's work date, not cancelled (`plannedOn`); caption = still booked, and hours booked of bay capacity |
| In the workshop / ring centre | Job cards checked in, diagnosing, awaiting approval, in progress, in QC or ready (`IN_WORKSHOP`) |
| Legend share | A stage's count ÷ vehicles on site, rounded |
| Awaiting approval | Job cards awaiting approval; caption = the oldest estimate's age. Red when one has waited 2+ days |
| Ready for collection | Ready job cards; caption = private customers, who pay before release |
| Unpaid invoices | **A Rand amount**: balance of issued and part-paid invoices; caption = open and overdue counts |
| Parts low (technician) | Parts at or below their reorder level |
| Bay capacity | Hours booked today (`hoursBy` bay) against 4 bays × 8 h; per bay as before |
| Open job cards | On-site job cards, earliest check-in first |
| Needs attention | Unchanged rules: approvals waiting 2+ days, past promised date, waiting for QC, overdue invoices, low stock — filtered by the user's modules |

Not shown because the data does not support it: "+20% vs last Tue", "Weekly capacity 32/40", the notification bell, a
site switcher, "Awaiting parts" and "Parts unavailable" (the job workflow has no parts-hold state).

## Shared kit changes in this branch

| Change | Effect |
| --- | --- |
| Sidebar navy now mixes 12% of the brand colour (was 24%), lighter glow | Warm brands (copper, red) no longer turn the sidebar brown. Optometry and medical sidebars are a shade deeper navy; their layouts are unchanged |
| "N need attention" button moved into the kit (`.od-alert-chip`) | Medical pixel-identical before and after the move |
| `FlowRing` can show a count (`value`) instead of a percentage; green `ok` tone | Used for "9 on site" and the Ready stage |

## Deviations from the approved concept

| # | Concept shows | Built | Why | Needs |
| --- | --- | --- | --- | --- |
| 1 | Photograph of a silver SUV in a workshop; headlight photo in the sidebar | A generic vehicle drawn in SVG (neutral silver, no make, badge or plate); no sidebar photo | No cleared vehicle photography | A licensed or owner-generated workshop image — set `image` on the config |
| 2 | Blue accent | The workshop's copper accent on the navy shell | Keeps each demo distinct; the handoff flagged the blue as stylised | Say if you want it blue — a one-line change (example in the evidence) |
| 3 | Embark logo top-left; "Velocity Automotive – Main Workshop" switcher | The workshop's monogram/name (or the client's logo when branded); breadcrumb as before | That slot is what client branding replaces; there is one workshop | — |
| 4 | "Active jobs 18", "Today's bookings 24 +20%", "Parts low 4" | Real figures; no trend; "Parts low" only where invoices are not visible | Records win; five cards fit | — |
| 5 | Stages Checked in / In service / Awaiting parts / Quality check / Ready | The real job-card stages, including "Awaiting approval" and "Diagnosing" | The workflow has no parts-hold state; approval is the key gate | — |
| 6 | "Service pipeline" with weekly capacity | "Bay capacity" for today | Planned hours exist per day; a weekly denominator would be invented | — |
| 7 | Needs attention as three totals | The existing itemised alerts, three at a time | Each row opens the record to fix | — |
| 8 | Times as "9:00 AM" | 24-hour times, as elsewhere in the demos | South African convention | — |
| 9 | Not present | Awaiting-approval and ready-for-collection lists below | Kept from the previous dashboard (and their test hooks) | — |

## Files

`src/industries/automotive/pages/Dashboard.tsx`, `src/industries/automotive/dashboardModel.ts`,
`src/industries/automotive/automotive.css`, `src/industries/automotive/index.ts` (`shell: 'navy'`), kit files
(`src/styles/overview.css`, `src/core/components/overview.tsx`), `src/industries/medical/*` (button class moved to the
kit), `tests/automotive-dashboard.test.ts`, `e2e/automotive-dashboard.spec.ts`, and re-captured homepage images
(`hero-optometry-*.png`, `cards/optometry.jpg`, `cards/medical.jpg`, `cards/automotive.jpg`).

## Browser evidence (26 Nov 2026, Chromium)

Captures: `docs/design/evidence/2026-11-automotive-dashboard/` — before (1440, 1024, 768, 390), after (1440, 1280,
1024, 768, 390, 360), everything expanded, 2× crops, technician user, blue client-brand example, phone menu, workshop
board, navy-shell check for optometry and medical, and unchanged mining and tyres.

| Item | Observed | Status |
| --- | --- | --- |
| 1440 vs concept | Same order and character: navy sidebar, greeting, five-card strip with a dark featured card, flow panel with ring/legend/vehicle and a stage track beside today's bookings, three panels below | ORANGE (photo pending; copper accent) |
| 1280 / 1024 / 768 | Desktop layout to ~1,150 px; then the featured card takes its own line and bookings move under the flow | GREEN |
| 390 / 360 | No sideways scroll (0 px); ring above the legend; vehicle hidden; stage track fits; touch targets 44 px | GREEN |
| Roles | Technician: "Parts low" instead of invoices; links only to own modules (all five users tested) | GREEN |
| Branding | A branded link renames and recolours; sidebar stays dark; vehicle stays neutral | GREEN |

Not checked: Safari, Firefox, real phones, an assistive-technology walkthrough.

## Rollback

Before merge: delete the branch. After merge: `git revert` the merge commit.
