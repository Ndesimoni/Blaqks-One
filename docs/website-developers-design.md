# UAE developer discovery design

Date: **2026-10-28**. Status: **implemented in the website design prototype**, not production catalogue/CRM integration.

The owner requested UAE developers, including Emaar, Azizi and Sobha, on the general Blaqks One website and company websites, with a dedicated section for them.

## What is included

- A shared selected directory of **40 developer reference names** in `design/website/developer-data.js`, including Emaar, Azizi Developments, Sobha Realty, DAMAC, Aldar, Nakheel, Meraas, Ellington, Binghatti, Danube, Arada and others. This is a curated starter set, not a complete UAE registry or a claim of partnerships.
- A six-entry Developers section on both homepages, linking to the complete directory. Navigation and footers also link to Developers. Company themes preserve their own visual treatment.
- Twelve directory entries per page, name search, base-emirate filter and an option to show developers with properties on the current website. “Base” does not mean the developer operates only in that emirate.
- Developer profiles with the reference name, base, available website reference and the current site's property collection. No fabricated projects, delivery promises, reviews, verified badges, awards or developer logos are added.
- Developer filters on property results, human-readable removable filter chips and links from property cards/details. Filters remain in the URL through sorting and theme changes.
- Clear empty profiles, unknown-developer handling and no-results states. Company pages never broaden to another company's inventory to fill an empty developer collection.

## Truthful sample data and contact routing

Developer identities are real reference names. Agencies, agents and properties remain fictional. The sample properties have explicitly illustrative developer associations, labelled on cards/details and in the developer section/directory/profile notices. They are not an assertion that those real developments, units or relationships exist.

Counts are calculated from the fictional property collection after company scoping. For example, Azizi has three sample associations on the general website but zero with the fictional Harbour & Palm company. A profile with no company properties still permits browsing that company's current properties or contacting that company. Property WhatsApp/email links continue to target the listing agent; developer website references do not replace the enquiry recipient.

Official-site fetches for Emaar, Azizi, Sobha, Aldar, Nakheel and DAMAC were blocked by the environment's CONNECT 403 response. No live website-content or link-availability verification is claimed. Known website references are provided without project/availability claims; uncertain URLs are omitted. Recheck names, base details, domains and any future supplied brand assets before production publication.

## Review and rebuild

Run `node design/website/build.mjs`:

- `dist/developers-preview.html` opens the general developer directory.
- `dist/review.html` opens the general website, including its new homepage section.
- `dist/company-preview.html` opens the company website, including its new homepage section.

With the local preview server running, `node design/website/export-company-review.mjs` refreshes `dist/company-all-pages.html`. It now contains **31 desktop/mobile page/state examples**, including developer directory/profile/empty/search/filter screens. The general All screens index has **64 examples**.

## Verification and production boundary

Local browser checks pass for 64 existing/new page-state routes, 40 theme-route combinations, 42 contact combinations, 160 company combinations, **80 developer-profile/site combinations** and **48 developer responsive combinations**. Developer checks cover all 40 unique entries across four directory pages, case-insensitive search, scoped counts, theme/filter retention, an empty company collection despite general-site matches, mobile navigation and the standalone export. Representative light/dark desktop/mobile screenshots were inspected.

Existing frontend tests **471/471**, production build, formatting, prototype file sizes and shrink-only repository size baseline pass. The strict size audit retains its existing 37-file backlog. No CRM API, database, real public approval or hosting configuration is changed.

Production work must use a curated developer reference ID within approved public listing revisions. Company counts/grids must use only that host's eligible approved publications; an unknown developer cannot widen results. Real contact data continues to come from the approved listing-agent public profile. Directory inclusion is not brokerage authorization, a verified credential or an advertising-permit guarantee. This task does not publish listings or establish developer partnerships.
