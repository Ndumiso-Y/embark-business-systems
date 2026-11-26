# Design-lock addendum — medical practice dashboard (November 2026)

**Status: built on branch `design/medical-dashboard-2026-11` — HOLD FOR OWNER APPROVAL. Not merged, not deployed.**
The branch sits on top of the optometry dashboard redesign (also awaiting approval), because both now share one kit.

Scope: the medical dashboard (`#/medical`) and the medical demo's shell colours. Other medical screens keep their
layout and pick up only the navy sidebar and blue accent. No other industry changes.

## Authority

| Item | Detail |
| --- | --- |
| Visual authority | `APPROVED_MEDICAL_DASHBOARD_CONCEPT.png` (1672×941), owner handoff ED-IND-MED-UI-001, 26 Nov 2026. A generated concept for layout and character; its names, numbers, doctor photo, logo and "Doctor on Call" panel are illustrative. Not stored in this repository. |
| Process | Playbook ED-WEB-001 (v1.0 active; v1.1 candidate used as guidance only). |
| Rules | Config wins for names and colours; records win for every figure; safety-relevant alerts must stay reachable. |

## Shared kit (new)

The optometry redesign's reusable parts moved into an opt-in kit so every dashboard in this style shares them:

| File | What |
| --- | --- |
| `src/core/components/overview.tsx` | `Kpi`, `FlowRing`, `MoreButton` |
| `src/core/lib/overview.ts` | `escapeCloses`, `WEEKDAYS`, `initialsOf` |
| `src/styles/overview.css` | Navy shell (`.app[data-shell="navy"]`) and the `.od-*` dashboard layout, with generic ring/legend tones |
| `IndustryConfig.shell` | `'navy'` opts an industry in; nothing changes for industries that don't |

Verified: the optometry dashboard (1440 and 390 px), the optometry diary and the mining dashboard are pixel-identical
before and after the extraction (mining compared with and without the kit in the same browser session).

## What was built

| Area | Decision |
| --- | --- |
| Shell | Navy sidebar, cool canvas, blue default theme (`themeFromHex('#1f6fd6')`, replacing green). Client branding replaces the colour and name as before. |
| Header | `Good day, <first name>` from the simulated user; subtitle with the configured business name; the demo's date; a **"N need attention"** button that jumps to the alert list; "Open waiting room". |
| KPI strip | Visits today (featured) · In the waiting room · Abnormal results to review · Chronic reviews overdue · Claims outstanding. A card appears only when the user has that module. |
| Practice overview | Ring + legend of today's visits by state, the lens-free medical artwork (or the cover photo once cleared), a one-line summary, and "Visits by booked hour (today)". |
| Today's schedule | "Now and next" (5 rows, in the practice first), expandable to the whole day; links to each visit. |
| Lower row | Waiting longest (keeps `waiting-longest`) · Clinicians now · Results inbox. |
| Needs attention | Full-width, first four items in two columns, "Show all"; same rules and `attention-list` as before. |
| On demand | Six-month consultations chart and recent activity; role bar at the foot. |

## Where every number comes from

Definitions in `src/industries/medical/dashboardModel.ts` (unit tested) and the dashboard.

| Shown | Definition |
| --- | --- |
| Visits today | Visit records dated today (all states) |
| Ring and legend | Today's visits by state: still to arrive = booked; waiting to be seen = arrived + triaged; with a doctor; at billing; done; did not attend. Cancelled visits listed separately and not counted |
| **Ring percentage** | **Done (checked out) ÷ today's visits that were not cancelled**, rounded. Spelled out under the ring and in its accessible name |
| In the waiting room | Arrived + triaged; caption = those still needing triage and the longest wait in minutes (from the arrival time, when it has passed) |
| Abnormal results to review | Results received and flagged abnormal (`unreviewedAbnormal`); caption = all received, and requested more than 7 days ago |
| Chronic reviews overdue | `overdueChronic`; caption = active on the register |
| Claims outstanding | **A Rand amount**: unpaid balance of submitted, part-paid and billed-to-patient claims; caption = open, draft and rejected counts |
| Visits by booked hour | Today's visits grouped by their booked hour (07:00–17:00 at least); hours already past drawn in full colour |
| Clinicians now | Per clinician from today's visits: the visit in "with doctor" state, visits at billing or done ("seen"), visits still booked ("to come") |
| Results inbox | Received (waiting for review), of which abnormal / normal; requested and still at the lab, with those over 7 days |
| Needs attention | Unchanged rules: vitals highlights (clinical users only, demo rule), abnormal results, allergy-blocked scripts, late results, unsigned consultations, overdue chronic reviews, rejected claims — filtered by the user's modules |

Not shown because the data does not support it: a "+4" trend badge, a notification bell, date arrows, "Doctor on call"
hours and a "Contact doctor" button (no on-call data and no messaging).

## Moved, not removed

| Previous dashboard | Now |
| --- | --- |
| Dark banner with the day's counts | KPI strip and the overview legend carry the same figures |
| "N abnormal results to review" banner button | KPI card and the Results inbox panel (both link to results) |
| Waiting room by stage (pipeline) | Overview legend (same states, same counts) |
| Waiting longest | Same list, same `data-testid`, in the lower row |
| Needs attention (up to 10) | First four, "Show all" for every item, plus the header button |
| Consultations per month, Recent activity | "Show trends and recent activity" |

## Deviations from the approved concept

| # | Concept shows | Built | Why | Needs |
| --- | --- | --- | --- | --- |
| 1 | Photograph of a doctor in the overview; stethoscope photo in the sidebar | Abstract artwork (cross and pulse line) drawn in SVG; no sidebar photo | No cleared medical photography; the concept's doctor is generated and could look like a real person | A licensed or owner-generated image (no identifiable people) — set `image` on the config |
| 2 | Embark logo top-left | The practice's monogram/name (or the client's logo when branded); Embark credited at the foot | That slot is what client branding replaces | — |
| 3 | "Rivermere Medical Practice", "Dr. Jordan Smith", 29 Apr 2025, 28 / 6 / 12 / 14 / 17, 71% | Acacia Family Practice (config), the signed-in user, the demo date, real figures | Config and records win | — |
| 4 | "Today's appointments", "Test results ready", "Follow-ups due" | Visits today, Abnormal results to review, Chronic reviews overdue, Claims outstanding | These are what the demo records; "follow-ups" maps to chronic reviews | — |
| 5 | "Patient activity" line chart by time | Bars of visits by booked hour | The visits have booked times; a smoothed line would imply continuous measurement | — |
| 6 | "Doctor on Call" + "Contact Doctor" | "Clinicians now" from today's visits; no contact button | No on-call data, no messaging | — |
| 7 | Recent patients | "Waiting longest" in that position | Handoff asked for waiting-longest to be kept; it is the more actionable list | — |
| 8 | Results summary: 14 ready, 12 normal, 2 need review | Received / abnormal / normal / at the lab | The demo's result states | — |
| 9 | No alert list | "Needs attention" full width below, plus a header button | Safety-relevant information must stay discoverable | — |
| 10 | Green theme (previous) | Blue, matching the concept | Concept is blue; branding still overrides | Confirm you want both health demos blue |

## Files

`src/industries/medical/pages/Dashboard.tsx`, `src/industries/medical/dashboardModel.ts`, `src/industries/medical/medical.css`,
`src/industries/medical/index.ts` (theme + `shell`), the shared kit files above, `src/core/types.ts` and
`src/core/IndustryLayout.tsx` (the `shell` option), `src/industries/optometry/*` (now using the kit),
`tests/medical-dashboard.test.ts`, `e2e/medical-dashboard.spec.ts`, `e2e/optometry-dashboard.spec.ts` (its
"other industries" check now uses mining and cleaning), `src/core/portal/media/cards/medical.jpg` (re-captured).

## Browser evidence (26 Nov 2026, Chromium)

Captures: `docs/design/evidence/2026-11-medical-dashboard/` — before (1440, 1024, 768, 390), after (1440, 1280, 1024,
768, 390, 360), everything expanded, 2× crops, receptionist and billing users, client-branded example, phone menu,
waiting room, and unchanged optometry and mining.

| Item | Observed | Status |
| --- | --- | --- |
| 1440 vs concept | Same order and character: navy sidebar, greeting + date, five-card strip with a dark featured card, overview with ring/legend/art and an hourly chart beside the schedule, three panels below | ORANGE (photo pending; alert list added) |
| 1280 / 1024 / 768 | Desktop layout to ~1,150 px; then the featured card takes its own line and the schedule moves under the overview | GREEN |
| 390 / 360 | No sideways scroll (0 px); alert button full width at the top; art hidden; touch targets 44 px | GREEN |
| Roles | Receptionist: 3 cards, no vitals alerts; billing: claims card, no results panel | GREEN |
| Branding | A branded link renames and recolours the dashboard and sidebar | GREEN |

Not checked: Safari, Firefox, real phones, an assistive-technology walkthrough.

## Rollback

Before merge: delete the branch. After merge: `git revert` the merge commit.
