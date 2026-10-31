# Blaqks One website design prototype

A standalone, clickable visual design preview for the general website, company websites, public properties/profiles, company Website editor and platform website review. It does not modify or import the live CRM application.

Agency profiles, people, properties and inventory counts are fictional. Developer names refer to real organisations; developer-property associations are explicitly illustrative. Images are the repository's existing labelled sample photography. Forms demonstrate validation and confirmation without delivery or CRM writes. Domain, moderation, entitlement and save controls are simulations. Legal pages are content placeholders requiring review.

Property cards/details and agent profiles include WhatsApp and Email links to that listing agent's public sample contacts. Property drafts include the title and reference. The preview uses reserved fictional phone numbers and `.example` addresses; links open an external application but never send automatically or create CRM leads. Real contacts require approved public profiles in the future production website.

## Open the preview

Property search now includes all seven emirates, cascading communities, min/max budgets and grouped advanced filters on both website types. `dist/filters-preview.html` opens an applied example after building. See [filter design/review notes](../../docs/website-filters-design.md).

The refined company websites have a dedicated export: after running `node design/website/build.mjs`, open `design/website/dist/company-preview.html`. Use **Company theme** in the preview toolbar to compare the four compositions on any company page. See [company design notes](../../docs/company-website-design.md).

To review every company page as a full-length image, keep the preview server running and run `node design/website/export-company-review.mjs`. This generates self-contained `design/website/dist/company-all-pages.html` with 34 page/state examples at desktop and mobile widths. Use its Page selector, Desktop/Mobile buttons and Previous/Next controls. It includes the four home compositions, property journeys, profiles, About/Contact, legal placeholders and system states. This visual gallery contains screenshots; `company-preview.html` is the interactive website prototype.

From the repository root:

```bash
node design/website/serve.mjs
```

Open <http://127.0.0.1:4178/#/index> for the screen directory, or <http://127.0.0.1:4178/> for the general homepage.

To create a standalone HTML file that can be downloaded and opened without installing packages:

```bash
node design/website/build.mjs
```

Open `design/website/dist/review.html`. It contains the bundled script, styles and sample images and works without a server. Live community maps load from OpenStreetMap near the property location section and require internet access; the remaining design and location/contact information work offline. No external fonts, tracking scripts or CRM API calls are required.

`dist/maps-preview.html` opens the property location example. Both website types show the community/emirate, an approximate-location notice, community map and listing-specific **Ask agent for exact location**. No exact property pin is published. See [location design and limitations](../../docs/website-location-design.md).

## Design scope

- General homepage, property search, property detail/gallery and listing enquiry.
- Company/agent directories and profiles, with counts derived from public sample inventory.
- Company profile tabs, areas and area details, About/Contact and professional-information pages.
- Four company themes across home, listings, details, team/profiles and contact.
- Company editor: Overview, Design, Content, Properties, Enquiries, Settings.
- Platform: General website, Review queue, Company sites, Policies & access, Health & recovery.
- Confirmation, no matches, unavailable, pending setup, generic error, not found, save conflict/error and domain states.

The screen index provides direct links to every designed page/state. Use its theme links to compare company-site variants. Browser Back retains the query; filters and sorting are represented in the URL. Draft values remain only within the current open preview; they are not persistent product data.

## Verify or export screenshots

With the preview server running:

```bash
node design/website/build.mjs
node design/website/check.mjs
```

The check script uses the repository's installed Playwright browser. If necessary, set `PLAYWRIGHT_BROWSERS_PATH` to its installed location or install Chromium through the existing Playwright tooling. Generated screenshots go into `design/website/screenshots/`; the test summary is `design/website/dist/check-results.json`. Generated files are ignored by Git and can be rebuilt.

This design uses plain browser code to make review portable. The production public application remains planned in **Next.js**, using the Rust/Axum public catalogue and enquiry contracts. The prototype does not substitute for those WEB delivery packets, authentication, approved public data or production accessibility/performance verification.

Developer discovery is available on both homepages and through `dist/developers-preview.html`: 40 selected reference names, directory/profile pages, search and property filters. See [developer design notes](../../docs/website-developers-design.md).
