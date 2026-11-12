# Sharing demo links with clients

## Links

| Who | Link | Shows |
| --- | --- | --- |
| Optometry client | https://ndumiso-y.github.io/embark-business-systems/optometry/ | Northgate Optometry only |
| GP practice client | https://ndumiso-y.github.io/embark-business-systems/medical-practice/ | Acacia Family Practice only |
| Workshop client | https://ndumiso-y.github.io/embark-business-systems/automotive/ | Torque Lane Auto Services only |
| Mining client | https://ndumiso-y.github.io/embark-business-systems/mining/ | Ridgeback Minerals only |
| Law firm client | https://ndumiso-y.github.io/embark-business-systems/law-firm/ | Mahlaba & Rossouw Attorneys only |
| Estate agency client | https://ndumiso-y.github.io/embark-business-systems/real-estate/ | Kestrel Property Group only |
| Construction client | https://ndumiso-y.github.io/embark-business-systems/construction/ | Ironbark Building & Civils only |
| Tyre fitment client | https://ndumiso-y.github.io/embark-business-systems/tyre-fitment/ | TreadRight Tyre & Fitment only |
| Security company client | https://ndumiso-y.github.io/embark-business-systems/security/ | Sentinel Ridge Security only |
| Cleaning company client | https://ndumiso-y.github.io/embark-business-systems/cleaning/ | BrightPath Cleaning Services only |
| School client | https://ndumiso-y.github.io/embark-business-systems/school/ | Marula Ridge Academy only |
| Shopping centre client | https://ndumiso-y.github.io/embark-business-systems/shopping-centre/ | Harbour Crossing Mall only |
| Embark Digitals (internal) | https://ndumiso-y.github.io/embark-business-systems/hub-k7q3m9/ | Portal with all twelve, filterable by family |
| Anyone at the root | https://ndumiso-y.github.io/embark-business-systems/ | Neutral page, lists nothing |

## Branding a link for a client

Add the client's name and colour to any client link, e.g.
`…/optometry/?name=Acme+Eye+Care&accent=1a73e8`, or publish a brand file so the logo travels too
(`…/optometry/?brand=<key>`). See `docs/BRANDING.md`.

## How the separation works

- `npm run build:pages` builds each industry as its own site with `DEMO_INDUSTRY=<id>`. The other industries are
  not compiled into it at all, so there is nothing to navigate to: no gallery, no "All industry demos" link, and
  typing another industry's address inside the app redirects back to the client's own dashboard.
- The root page and the 404 page are a plain Embark Digitals notice with no links.
- Each browser keeps its own demo data, so clients never see each other's changes.

## What this does not do

This is separation by design, not security. The repository is public, so someone who reads it or guesses a
folder name (for example `/mining/`) can open another demo, and the hub address is unlisted rather than secret.
All content is fictional, so the exposure is low. If a client must not be able to reach other demos under any
circumstances, the next step is one of:

1. **Unguessable folder names** per client (e.g. `/optometry-4fq8t2/`) — change `CLIENT_SLUGS` in
   `scripts/build-pages.mjs`. Same hosting, harder to guess.
2. **Separate hosting per client** (one repository or Netlify/Cloudflare Pages site each).
3. **Real access control** (password or sign-in in front of the site, e.g. Cloudflare Access) — needed for any real
   client data, together with a backend.

## Adding a client link

Add the industry to `CLIENT_SLUGS` in `scripts/build-pages.mjs`, push to `main`, and the workflow publishes it.
