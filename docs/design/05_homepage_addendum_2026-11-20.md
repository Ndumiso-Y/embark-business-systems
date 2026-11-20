# Design-lock addendum — owner hub homepage (ED-HOME-2026-11-20)

**Status: built on branch `design/homepage-coverflow-2026-11-20` — HOLD FOR OWNER APPROVAL. Not merged, not deployed.**

This addendum supersedes the *homepage / portal presentation only* of `02_design_lock.md` (v2, released
12 Nov 2026). Everything that document says about the interior of the demos (shell, cards, pills, tint, tokens in
`skin.css`) is unchanged. The v2 portal decisions are kept there as history.

Process: Embark Digitals Living Web Experience Playbook ED-WEB-001 (v1.0 active; v1.1 candidate used as delivery
discipline only).

## Authority

| Item | Detail |
| --- | --- |
| Visual authority | `APPROVED_homepage_visual_authority.png` (1448×1086), supplied in the owner's handoff package of 20 Nov 2026. A generated concept: approved for composition, not a production asset and not a capture of real software. |
| Supporting inspiration | Three third-party images (cover-flow depth, peeking neighbours, editorial card). Reference only; not licensed, not in this repository. |
| Owner approval | Recorded in the handoff package (`OWNER_APPROVAL_AND_DESIGN_LOCK.md`, 20 Nov 2026). The package is not stored in this public repository. |
| Scope | The hub's root page `#/` only. No "Demos" page, no change to industry demos, client links or routing. |

## What was built

| Area | Decision |
| --- | --- |
| Header | Supplied Embark mark (cropped, not redrawn) + wordmark set as live text; in-page navigation **Home · Demos · How it works**; the "Demonstrations · fictional data" label on the right. |
| Hero | Eyebrow `BUSINESS INTEGRATION SYSTEMS`; H1 `Run your business in one connected system.` with a thin curved underline under "system."; supporting sentence as drafted in the brief; `Explore Demos` (scrolls to and focuses the carousel) and `See How It Works` (scrolls to the explanation section). |
| Devices | A laptop and a phone drawn in CSS around **real browser captures** of the optometry demo (`npm run capture:portal`), on a pale-blue arc. Captioned `DEMONSTRATION … fictional business`, with a link into that demo. |
| Carousel | "Explore by Industry": Cover Flow-style, one large centred card, two smaller neighbours each side (one each side on phones). All 12 industries, in the configs' existing `priority` order. |
| Card | Picture on top (≈69% of the height), opaque white band below with a colour marker, the industry name, one factual line, and an arrow on the centred card. |
| Module shortcuts | Under the controls: position (`01 / 12`), industry, fictional business name and an "N modules" disclosure that lists direct links into each module of the centred industry. |
| How it works | Three plain steps plus the caution paragraph carried over word for word from the previous homepage ("no real sign-in, no server, and no medical, legal, safety or financial compliance"). |

## Carousel behaviour (frozen for this release)

- **Circular.** Next after the last industry is the first. The indicator has exactly one dot per industry (12).
- **Controls.** Previous / next buttons (44 px), dots, keyboard Left / Right / Home / End while focus is anywhere in
  the carousel, mouse drag and touch swipe (starts after 8 px of mostly-horizontal movement; moves after 36 px;
  at most three cards per swipe). Vertical page scrolling is unaffected (`touch-action: pan-y`).
- **Neighbours focus first.** Clicking a side card centres it and never opens it. On the centred card the whole card
  is the link (`Open <industry> demo`).
- **Click versus drag.** A drag never also counts as a click.
- **Accessibility.** `aria-roledescription="carousel"`; each card is a labelled slide ("Optometry, 1 of 12"); only
  the centred slide is exposed to assistive technology and the tab order; a polite live region announces the
  centred industry. All 12 are reachable by keyboard alone.
- **Motion.** 420 ms ease on transform, 300 ms on opacity. No autoplay, no parallax. Under
  `prefers-reduced-motion` all of it is switched off and the carousel still works.
- Not included: mouse-wheel / trackpad horizontal scrolling of the carousel.

## Tokens (homepage only, `src/styles/portal.css`)

| Family | Token | Value | Source |
| --- | --- | --- | --- |
| Ink | `--hp-ink` / `--hp-body` / `--hp-muted` | `#111927` / `#3a4556` / `#5d687a` | Brief (charcoal near `#111927`) |
| Surfaces | page / `--hp-ice` / `--hp-line` | `#ffffff` → `#f6f9fd` → `#f7f9fc` / `#f5f8fc` / `#e2e8f0` | Brief |
| Embark blue | `--hp-navy` / `--hp-blue` / `--hp-sky` / `--hp-wash` | `#244572` / `#2472b4` / `#7cd4f1` / `#dcebf9` | Navy and sky sampled from the supplied mark (foot `#244572`, crown `#7cd4f1`); `--hp-blue` is a mid-point chosen to reach 4.5:1 on white |
| Dark action | `--hp-dark` | `#0f1a2b` | Reference |
| Type | Inter 500–800 (already loaded) | H1 `clamp(36px, 3.62vw, 54px)` / −0.035em; H2 `clamp(30px, 3.2vw, 46px)`; card title up to 28px | Reference uses a geometric sans; Inter kept as in v2 |
| Card | radius 26; width `clamp(264px, 32.4vw, 468px)`; picture height 44% of width; band 94px (104px on phones) | | Measured from the reference (468×295 at 1448) |
| Carousel | neighbour scale 0.78 / 0.62; offsets 0.862 / 1.535 card widths; tilt 6° / 9° | | Tuned against the reference |
| Industry colour | `--accent*` from each `IndustryConfig.theme` | card marker and picture wash only | Unchanged |

## Deviations from the approved reference

| # | Reference shows | Built | Why | Needs |
| --- | --- | --- | --- | --- |
| 1 | Photographs on the cards | A browser capture of each demo's own dashboard set into that industry's colour, with its icon | No cover photo is GREEN in `04_asset_manifest.md`; the reference photos are generated and not licensed | 12 licensed photos (drop-in: set `image` on the config and the card uses the photo) |
| 2 | Angled, photographic laptop and phone | Front-facing devices drawn in CSS | No rights-cleared device photography; a flat frame keeps the real capture legible | Owner decision whether to commission/licence device art |
| 3 | Invented laptop UI ("Optometry System", "18" appointments, eye photo) | The real optometry dashboard as captured (16 appointments on the capture date) | The reference UI is not real software | — |
| 4 | Full logo with dark "EMBARK" lettering | The supplied mark as an image; "EMBARK / DIGITALS" as live text | In the supplied PNG the word "EMBARK" is white, so it disappears on a light header | A light-background version of the logo |
| 5 | `Chat on WhatsApp` button | Omitted; the "Demonstrations · fictional data" label sits there | No verified WhatsApp number supplied | The number |
| 6 | `About` in the navigation | Omitted | No About content exists; no dead links | Content, when in scope |
| 7 | `Demos` goes to a Demos page | `Demos` scrolls to the carousel on this page (interim) | The Demos page is the next project | Owner acceptance of the interim behaviour |
| 8 | Play icon on `See How It Works` | Down chevron | A play icon would promise a video | — |
| 9 | Three dots under the carousel | Twelve dots | The indicator must map honestly to 12 industries | — |
| 10 | Arrow on every card | Arrow on the centred card only | (The reference also shows it only on the centred card; noted because side cards are still clickable — they centre) | — |
| 11 | Nothing below the carousel | Module shortcuts line and the "How it works" section | Keeps the module links and the factual caution from the previous homepage; gives `See How It Works` a real destination | Owner review of the wording |
| 12 | One-line descriptions such as "Patient care and optical dispensing." | Short lines that name real modules (`src/core/portal/cardLines.ts`) | Must be accurate to what each demo contains; configs' `summary` untouched | Owner review of the 12 lines |

## Files

| File | Role |
| --- | --- |
| `src/core/pages/Gallery.tsx` | Homepage composition |
| `src/core/portal/CoverFlow.tsx` | Generic carousel (knows nothing about industries) |
| `src/core/portal/coverflow.ts` | Position maths, unit tested |
| `src/core/portal/IndustryCard.tsx` | The card. Layout-neutral, so the future Demos page can lay the same cards out in a grid |
| `src/core/portal/cardLines.ts` | One short line per industry |
| `src/core/portal/media.ts`, `src/core/portal/media/` | Mark, hero captures, card captures |
| `scripts/capture-portal-media.mjs` | Regenerates the captures from the running demos |
| `src/styles/portal.css` | All homepage styles, scoped to `.hp`, `.cf`, `.icard` |
| `vite.config.ts` (`virtual:hub`) | Client (single-industry) builds contain no homepage code or imagery |
| `e2e/homepage.spec.ts`, `tests/coverflow.test.ts` | Tests |

Notes for the Demos-page project: render `IndustryCard` for every item of the same sorted list inside a CSS grid
(`.icard` sizes itself from its container; set `--cf-media` or leave the 44cqw default). `CoverFlow` takes any
`{ id, label }` items and a render function, so nothing in the carousel needs rewriting.

## Browser evidence (20 Nov 2026, Chromium)

Captures in `docs/design/evidence/2026-11-20-homepage/` at 1440, 1024, 768, 390 and 360 px.

| Item | Observed | Status |
| --- | --- | --- |
| 1440 vs reference | Same composition: header, two-line headline with underline, two actions, laptop + phone on arc, section head with divider, centred card with two neighbours each side, controls below. Differences are the deviations above; the page is about 90 px taller to the bottom of the controls | ORANGE (photos, device art, logo variant pending) |
| 1024 | Hero stays two-column; actions on one row; nothing overflows the header | GREEN |
| 768 | Hero stacks: copy, then devices; carousel shows centre + neighbours | GREEN |
| 390 / 360 | No sideways page scroll (measured 0 px); headline wraps to three lines unclipped; one neighbour edge visible each side; controls 44 px | GREEN |
| Arrows, dots, keyboard, drag, touch swipe, neighbour-click, reduced motion | Automated in `e2e/homepage.spec.ts` | GREEN |
| Logo proportions | Image shown at its natural ratio (asserted in the test) | GREEN |
| Device captures | Real captures of the optometry demo, regenerated by script | GREEN |
| Licensing | See `04_asset_manifest.md` | GREEN for what is used; photos GREY |

Not checked: Safari and Firefox, real phones, a screen-reader walkthrough with assistive technology.
