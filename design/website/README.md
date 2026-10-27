# Blaqks One website design prototype

A standalone, clickable visual design preview for the general website, company websites, public properties/profiles, company Website editor and platform website review. It does not modify or import the live CRM application.

All properties, people, companies and public counts are fictional. Images are the repository's existing labelled sample photography. Forms demonstrate validation and confirmation without delivery or CRM writes. Domain, moderation, entitlement and save controls are simulations. Legal pages are content placeholders requiring review.

## Open the preview

From the repository root:

```bash
node design/website/serve.mjs
```

Open <http://127.0.0.1:4178/#/index> for the screen directory, or <http://127.0.0.1:4178/> for the general homepage.

To create a standalone HTML file that can be downloaded and opened without installing packages:

```bash
node design/website/build.mjs
```

Open `design/website/dist/review.html`. It contains the bundled script, styles and sample images and works without a server. No external font, tracking, image or API request is required.

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
