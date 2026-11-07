# Approved marketplace design in Next.js

The main public website (`apps/website`, platform hosts) now mounts the recovered approved
Blaqks One presentation inside the Next.js App Router. It replaces the earlier partial
marketplace reconstruction. Company websites retain their independent compositions;
`apps/marketing` and the CRM are unchanged.

## Design source and implementation

The canonical source is the original Site `appgprj_6aeba4d0ffb08191ac1948cb6b0c29d4`,
revision `b939501e40fb3e1a5319c8f1f401ec138bed2fc9`, previously published at
<https://blaqks-one-welcome-design.cocoamoat2.chatgpt.site/>.
Its complete source is retained in `apps/website/reference/approved-source.tar.gz`.
All five original JPG assets are copied without modification; tests compare their bytes
with the archive. The original typography, styles, layouts and interactions are reused.

This is a Next.js integration of the recovered renderer, not a JSX rewrite of every
original template. A React client boundary mounts the original view engine, with Next
routing, public catalogue binding and a native connected enquiry form. There is no iframe.
Build preparation generates sample SSR snapshots, scoped CSS, a browser bundle and fixture
JSON. Generated files are ignored and rebuilt by predev/pretest/pretypecheck/prebuild.
The earlier partial platform components/styles have been removed. Existing company styles
are loaded separately, so they cannot blend into the approved marketplace presentation.

To inspect or edit the original source, extract the archive into a temporary directory:

```bash
mkdir -p /tmp/blaqks-approved
 tar -xzf apps/website/reference/approved-source.tar.gz -C /tmp/blaqks-approved
```

The original files live under `dist/`. Repack intentional canonical edits using
`tar -czf apps/website/reference/approved-source.tar.gz -C /tmp/blaqks-approved dist`.
Integration adjustments belong in `apps/website/scripts/reference-*.mjs`; do not edit
generated `public/approved` or `src/generated` outputs.

## Included presentation

The recovered home, property results/details, gallery, filters, agents/companies and
profiles, deals, featured sections, headers/footers, About/Contact/help/professional pages,
saved/recent/compare tools and account/onboarding screens are included. Agent pagination
and the compact featured-agent strip retain the original design. Existing community and
developer routes use the same recovered visual components.

Sample mode is explicit and restricted to recognised local hosts. Sample data, deals and
account/social/verification screens are design previews, with the original preview notices;
they do not create real accounts or send provider messages. Browser-local property tools
are scoped by site identity. Live professional signup/signin entry links use the configured
CRM URL. A direct account preview route is not evidence of real authentication.

API mode still resolves the host and public page through the existing server-only API
adapter before rendering. Unknown hosts/foreign IDs fail closed; API errors never fall
back to fictional catalogue data. Only projected public records reach the browser.
Live enquiry intake retains the existing Next endpoint and target/ownership validation.
The public contract does not expose verified discount/distress metadata, so live deals
are not fabricated. Final legal text, provider authentication/delivery, broader content
binding and production deployment remain separate work.

## Polish pass (7 November 2026)

A review of the rendered main site fixed these mistakes without changing the palette:

- **Navigation.** Next remounts `#app`/`#overlay` on every route change, so the renderer now
  re-queries both at the start of `render()`. Community, developer, pagination and footer
  links are real paths; `ReferenceWebsite` sends plain clicks on `#app a[href^="/"]` through
  the router, and footer Buy/Rent/Commercial shortcuts keep their purpose filter.
- **Communities and developers.** Directories use the approved company-card grid (search,
  count, 12 per page, page links); community cards take a cover photo from their first
  listing and developer cards a navy monogram tile. Profiles list only their own listings,
  with an empty state. Sample mode lists the 40 reference developers; the six sample homes
  carry illustrative, labelled associations. The home page shows six developer tiles after
  Featured Agents, and the footer links Communities, Developers, Privacy and Terms.
- **Readability.** Body-level `.estate-page` selectors are scoped to `<body>` itself, so the
  approved 3px gold focus ring and modal styles apply. Gold buttons and the header menu use
  navy text (6.7:1). Navy bands, breadcrumbs, addresses, deal details, gold text links and
  the main secondary copy now meet 4.5:1 through the existing tokens; some tiny decorative
  labels in illustrative mock-ups (CRM preview, portrait placeholders) remain lighter.
- **Sample and connected labels.** The sample-only design preview pill sits bottom-right on
  desktop and at the page end on phones; connected mode removes it. Connected mode also
  replaces design-preview and "sample" wording, removes sample badges and hides the empty
  distress-deal strip. A navy/gold `icon.svg` and `favicon.ico` end the favicon 404.
- The saved/recent/compare tabs mark the current tab.

Integration code lives in `scripts/reference-*.mjs` and `reference-{native,polish,contrast,directory}.css`;
`tests/reference-polish.test.ts` covers the data, patches and generated styles.
`tests/check-browser.mjs` (set `WEBSITE_BROWSER_CHANNEL=chrome` on machines without the
Playwright browser) checks main-site routes, click navigation, directories, focus, the pill
and overflow at 390/1280, plus company-host overflow.

## Verification and limits

The focused website suite includes 48 model/design checks plus one synthetic public API
consumer integration. The tests cover original image bytes, page snapshots, route mapping,
site-scoped identity and embedded JSON escaping, alongside existing public-contract checks.
Type generation/typecheck and the production webpack build pass. The repository file-size
baseline has no new violations; 36 pre-existing oversized files remain. CRM source and
private data were not changed.

A browser security-policy rejection prevented the final rendered browser review in this
session. Pixel-for-pixel parity, hydrated navigation across every route, mobile visual QA
and connected end-to-end delivery are therefore not certified. The recovered assets and
presentation source are exact; the Next integration still needs that visual acceptance pass.
This change does not deploy the website, activate domains or merge the default branch.
