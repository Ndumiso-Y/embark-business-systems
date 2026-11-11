# Branding a demo for a client

Any industry demo can be shown in a client's own name, logo and colours. The modules, data and workflows
stay the same; only the identity changes.

## What changes when a demo is branded

- The client's **logo** replaces the initials at the top of the menu.
- The client's **name** replaces the fictional business name everywhere (menu, page headings, browser tab).
- One **brand colour** (picked from the logo automatically) drives the whole accent palette: active menu
  item, buttons, highlights, charts, tags.
- The footer reads "Demonstration prepared for <client> by Embark Digitals".
- Status colours (green / amber / red) do not change, so warnings keep their meaning.
- Sample people, records and figures stay fictional.

Very light or neon brand colours are shown in a deeper shade of the same hue so that text stays readable
(all derived text/background pairs are kept at 4.5:1 contrast or better).

## Three ways to brand, from quickest to most complete

### 1. On your own laptop (for presenting in person or on a call)

1. Open the industry demo → **Settings & reset** → **Brand this demo for a client**.
2. Type the company name and click **Upload logo** (PNG, JPG, SVG or WebP).
3. The colour is taken from the logo. Adjust it with the colour picker if the wrong one was chosen.

It applies instantly and is remembered in that browser, per industry, until you click **Remove branding**.
Resetting the demo data keeps the branding.

### 2. A branded link (name and colour, no logo)

After step 1, copy the **Branded link** shown in the same panel, for example:

```
https://ndumiso-y.github.io/embark-business-systems/optometry/?name=Acme+Eye+Care&accent=1a73e8#/optometry
```

Anyone opening that link sees the name and colours with no setup. You can also write one by hand:
`?name=` is the company name and `&accent=` is a six-digit colour without the `#`. A logo is too large to
fit in a link.

### 3. A published brand file (name, colour and logo in the link)

1. After step 1, click **Copy brand file (with logo)**.
2. Save it in the repository as `public/brands/<key>.json` (lowercase letters, digits and hyphens, e.g.
   `public/brands/acme-eye-care.json`) and push to `main`.
3. Share `…/optometry/?brand=acme-eye-care`.

`public/brands/example.json` is a fictional example: try
`https://ndumiso-y.github.io/embark-business-systems/optometry/?brand=example`.

## Things to know

- **Permission:** only use a client's logo and name with their agreement. The repository and the site are
  public, so a published brand file is visible to anyone who has the link or reads the repository.
- **It is still a demo:** branding does not add sign-in, security or real data.
- **Some sample text is fixed:** seeded records (for example a history note written by a fictional staff
  member) keep their original wording.
- **Unknown or invalid values are ignored**, so a mistyped link simply shows the default look.

## For developers

- Logic: `src/core/brand.ts` (`themeFromHex`, `dominantColor`, `brandedConfig`, `parseUrlBrand`), unit tested in
  `tests/brand.test.ts`. UI: `src/core/components/BrandStudio.tsx`. Applied in `src/core/IndustryLayout.tsx`, which
  provides the branded configuration to every page through `useIndustry()`.
- Pages must read the business name from `useIndustry().businessName` and colours from the `--accent*` CSS
  variables; never hard-code either.
- Brands are stored in the persisted store under `brands[industryId]`, separate from demo data.
