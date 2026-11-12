# Design lock — portal and interior (v2)

Follows the Embark Digitals Living Web Experience Playbook (ED-WEB-001 v1.1 candidate): reference-led, tokens
recorded, real build judged from browser captures, owner acceptance before release.

**Status: released 12 Nov 2026.** The owner reviewed the preview and asked for it to be implemented. Cover photos are still pending (temporary artwork in place).

## Visual authority

Selected by the owner on 12 Nov 2026 (pasted in the working session; files not stored in the repository).

| Ref | What it is | Governs | Principles taken (not copied layouts) |
| --- | --- | --- | --- |
| R1 | Three tall destination cards (photo, title, white "Change" pill) | Portal cards | Tall rounded card; full-bleed photo; title over a dark fade; one white pill action |
| R2 | Mixed listing cards (food / property) | Portal cards | Small badge top-left; meta chips; dark-tinted lower third |
| R3 | Three stay cards with colour-matched tint | Portal cards | The fade takes its colour from the image; description + chips + full-width white pill |
| R4 | "Jobgio" admin dashboard | Interior shell | Cool grey canvas; white cards with large radii; pill navigation with round icon chips; near-black active item and primary actions; pill status tags |
| R5 | Vehicle "Purchase Inspection" screen | Interior detail pages | Large soft cards; pill tabs; light typography; generous spacing |

Immovable: tall photo cards with tint fade and white pill; grey canvas with white rounded cards; pill nav with
black active state. Allowed substitutions: Inter instead of the references' geometric sans (already licensed and
loaded); industry colour as the tint (R3 samples the photo; ours uses each industry's own colour so client branding
still drives it).

Owner statement: the portal is mainly for Embark Digitals; clients receive a direct industry link. It should
"welcome a person to choose". The owner noted loving the first three card references most.

## Tokens

| Family | Token | Value |
| --- | --- | --- |
| Canvas | `--bg-app` / portal `--p-canvas` | `#f1f2f4` |
| Surface | cards, sidebar | `#ffffff`, subtle fill `#f4f5f7` |
| Ink | `--ink` / `--ink-2` / `--ink-3` | `#14181a` / `#23292c` / `#454d52` |
| Muted | `--muted` / `--muted-2` / `--muted-3` | `#646c71` / `#838b90` / `#a3a9ad` |
| Lines | `--line` / `--line-2` / `--line-3` | `#e6e8eb` / `#eceef0` / `#d9dce0` |
| Dark | `--bg-dark` (active nav, primary button) | `#15191b` |
| Industry | `--accent*` (six tokens per industry or per client brand) | unchanged; see `IndustryConfig.theme` and `core/brand.ts` |
| Tint | `--tint` | `color-mix(in srgb, var(--accent-text) 62%, #090b0b)` |
| Embark | portal mark / kicker | `#28697a`, warm dot `#f09364` |
| Radii | portal card 28 · panel 24 · board column 20 · inner card 16 · input 14 · buttons, nav, chips 999 | |
| Shadow | panel | `0 1px 2px rgba(20,24,26,.04), 0 14px 30px -20px rgba(20,24,26,.22)` |
| Shadow | portal card | `0 22px 44px -18px rgba(20,24,26,.28)`; hover lifts 4 px |
| Type | Inter 400–800; portal H1 `clamp(34px, 5.2vw, 58px)` / −2px; card title 27px / −0.8px; body 13–16px | |
| Layout | portal max 1280px; grid `auto-fill, minmax(272px, 1fr)`, gap 24; card min-height 468 (440 on phones) | |
| Media | cover photo occupies the top 66% of the card; fade starts at 26% and is solid tint by 66%; `object-fit: cover` with a per-photo focal point | |
| Motion | card lift + 4% photo zoom on hover; module panel fades in 180 ms; all disabled under reduced-motion | |

Files: `src/styles/portal.css` (portal), `src/styles/skin.css` (interior; overrides tokens and shapes only, no markup),
`src/core/pages/Gallery.tsx`.

## Screen map

| Screen | Basis | Status |
| --- | --- | --- |
| Portal `#/` | R1–R3 | Built; temporary artwork in place of photos |
| Dashboard banner (all industries) | R3 tint + cover photo | Built; shows tint only until photos are supplied |
| Shell, registers, boards, forms (all industries) | R4 | Built via shared skin |
| Signature detail screens per industry | R5 | Not started — next pass, one industry at a time |

## Deviations and substitutions

1. **Photos pending.** Cards show a colour wash and an icon. See `04_asset_manifest.md`.
2. **Module list behind a chip.** References have no equivalent; "N modules" on each card opens a list laid over the card.
3. **Filter chips** by business family replace the previous family headings.

## Browser evidence (12 Nov 2026)

Captured with Chromium at 1440, 1024, 768 and 390 px: portal and optometry dashboard at each; lab board, mining
dashboard and real-estate listings at 1440. No horizontal page scroll at 390. Full browser suite: 108 passed
(12 client-link checks run against the built site only). Layout and typography reviewed; photographic realism
cannot be judged until photos are in.

## Planned next (owner direction, 12 Nov 2026 — planning only, not yet scheduled)

> "Each of these pages needs its own divided attention. I love the consistency across, but they need their own
> individual touch that communicates that this is a system that does what it says. Right now it's text — pictures
> sell. People need more pictures than words."

What this means for the next design pass:

1. **Keep the shared frame** (shell, cards, pills, tint) — consistency stays.
2. **Give each industry a visual signature**, led by imagery rather than text:
   - a cover photo on the portal card and dashboard banner (asset manifest);
   - one "hero" screen per industry designed individually in the style of reference R5 — the thing that industry's
     people recognise at a glance (optometry: eye/prescription view; tyres: the four-wheel diagram; mall: the stacking
     plan; real estate: listing cards with photos; construction: programme and site photos; security: roster wall;
     school: class register with learner avatars);
   - pictures inside records where a real system would have them (vehicle, property, product, person avatars).
3. **Replace words with visuals** on dashboards: fewer sentences, more diagrams, progress rings, photo thumbnails,
   status illustrations and empty-state artwork.
4. Run it **one industry at a time** through the playbook gates (references → lock → build → browser captures →
   owner acceptance), starting with the industries closest to a real client conversation.

Needs from the owner per industry: 3–5 reference images for its hero screen and a set of licensed photos.
