# Asset manifest

Two groups: imagery made from Embark's own material (in use), and cover photos (all still pending).

## In use on the homepage (added 20 Nov 2026)

| Asset | File | Status | Source / creator | Licence / permission | Modification | Placement | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Embark mark | `src/core/portal/media/embark-mark.png` | GREEN — owner to confirm public use | Embark Digitals; supplied by the owner in the homepage handoff (1080×1080 transparent PNG) | Embark's own brand asset | Cropped to the mark and downscaled to 174×192. Not redrawn or recoloured. The wordmark in the source is white and is not used; "EMBARK / DIGITALS" is set as live text | Homepage header | Supplied for this homepage 20 Nov 2026; the full-size source is not in the repository |
| Hero laptop screen | `src/core/portal/media/hero-optometry-desktop.png` | GREEN | Browser capture of this repository's optometry demo at 1280×800, 20 Nov 2026 (`npm run capture:portal`) | Own software; fictional sample data only | None (walkthrough panel hidden with its own Hide button before capture) | Homepage hero, inside a CSS laptop frame | Self-generated |
| Hero phone screen | `src/core/portal/media/hero-optometry-phone.png` | GREEN | Same, at 390×844 | Same | None | Homepage hero, inside a CSS phone frame | Self-generated |
| Card captures ×12 | `src/core/portal/media/cards/<id>.jpg` | GREEN — interim | Browser capture of each demo's dashboard at 820 px wide, 20 Nov 2026 (same script) | Own software; fictional sample data only | Cropped to the top 520 px from the page heading; JPEG quality 84 | Homepage industry cards, until a cover photo is GREEN | Self-generated |

Re-captured 20 Nov 2026 (later the same day) after the optometry dashboard redesign: the two hero screens and
`cards/optometry.jpg` (`PORTAL_MEDIA_ONLY=optometry npm run capture:portal`). The other eleven card captures are unchanged.

| Asset | File | Status | Source / creator | Licence / permission | Modification | Placement | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lens-dial artwork | drawn in code (`OpticalArt` in `src/industries/optometry/pages/Dashboard.tsx`) | GREEN — interim | Original SVG written for this project; abstract dial with axis ticks, no third-party source | Own work | — | Optometry dashboard, right side of "Today's patient flow" | Stands in for the photo below |
| Optometry dashboard photo (phoropter or similar) | `industries/optometry.jpg` (same file as the cover photo row below) | GREY — pending | | | | Flow panel on the optometry dashboard, the optometry homepage card and banner | Needs a licensed or owner-generated image; the concept's phoropter and spectacles are generated reference art and are not used |

The captures show the capture date and that day's sample figures. Re-run `npm run capture:portal` after a visible
change to a dashboard, review the images, and update the dates above.

Not in the repository and never to be published: the approved concept image and the three inspiration images from
the handoff package (generated or third-party; composition reference only).

## Cover photos

One cover photo per industry is used on the homepage card and behind the dashboard banner.

**Rule:** only photos with a documented free-commercial-use licence or written permission. Pinterest pins are
reference only and are never used. No photo may show a real, identifiable business as if it were the fictional one.

To add a photo: save it as `public/industries/<id>.jpg` (about 1200 px on the long side, under ~200 KB), set
`image: 'industries/<id>.jpg'` (and optionally `imageFocus`) on the industry config, and fill in a row below.

| Industry | File | Status | Source / photographer | Licence | Class | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Optometry | `industries/optometry.jpg` | GREY — pending owner selection | | | | Wanted: eye exam or frames on display; calm, clinical |
| General practice | `industries/medical.jpg` | GREY | | | | Consulting room or stethoscope detail; no identifiable patients |
| Automotive | `industries/automotive.jpg` | GREY | | | | Car on a lift or mechanic at work |
| Tyre & fitment | `industries/tyres.jpg` | GREY | | | | Tyre racks or wheel being fitted |
| Mining | `industries/mining.jpg` | GREY | | | | Headgear, haul truck or underground tunnel |
| Construction | `industries/construction.jpg` | GREY | | | | Site with crane or structure going up |
| Real estate | `industries/realestate.jpg` | GREY | | | | Modern house exterior (as in reference R2/R3) |
| Law firm | `industries/legal.jpg` | GREY | | | | Library, desk or columns; sober |
| Security | `industries/security.jpg` | GREY | | | | Control room, gatehouse or officer from behind |
| Cleaning | `industries/cleaning.jpg` | GREY | | | | Clean office interior or floor machine |
| Education | `industries/education.jpg` | GREY | | | | Classroom or school building; no identifiable children |
| Shopping centre | `industries/mall.jpg` | GREY | | | | Mall interior or atrium; no readable real brand signage |

Status key (playbook A3): GREEN documented and cleared · ORANGE usable but needs a better crop or resolution ·
RED rights unverified, do not publish · GREY awaiting owner decision.

Temporary substitute until GREEN: on the homepage card, the industry's own dashboard capture on a wash of its colour
(`.icard-shot`), or its icon alone if no capture exists; on the dashboard banner, the colour tint.
