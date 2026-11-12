# Asset manifest — cover photos

One cover photo per industry is used on the portal card and behind the dashboard banner.

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

Status key (playbook A3): GREEN documented and cleared · ORANGE usable but needs a better crop or resolution ·
RED rights unverified, do not publish · GREY awaiting owner decision.

Temporary substitute until GREEN: a colour wash in the industry's own colour with a line icon (`.pcard-art`).
