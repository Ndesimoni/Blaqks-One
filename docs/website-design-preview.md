# Complete website design preview

**Native implementation:** the approved public designs now have an initial Next.js frontend in [`apps/website`](../apps/website/README.md), with a [public API handoff](website-api-contract.md). This document continues to describe the older portable HTML prototype, not live publication or the production backend.

**Workflow update (owner, 2026-10-28):** [direct website publishing](product-decisions.md#direct-website-publishing-decided-2026-10-28) replaces mandatory approval. The existing prototype's Submit for review and platform Review queue controls depict the older design and are not the current publication target. They need replacement with direct Publish, sync status and publication management in the next UI implementation packet. No live publishing exists yet.

Date: **2026-10-28**. Status: **interactive design prototype; not a production website or public backend**.

The owner requested all website pages and the properties/profiles journey, explicitly excluding professional performance statistics. The prototype follows the [structure blueprint](website-structure-blueprint.md), [settings plan](website-settings-plan.md) and [visual direction](website-visual-refinement.md).

## Review the design

- Source and instructions: [design/website/README.md](../design/website/README.md).
- Start: `node design/website/serve.mjs`, then open `http://127.0.0.1:4178/#/index` on that same machine.
- Generate the downloadable, self-contained preview: `node design/website/build.mjs`.
- Output: `design/website/dist/review.html`, containing the script, styles and sample images.
- Dedicated company export: `design/website/dist/company-preview.html`, with the refined company homepage as its starting page. The preview toolbar's Company theme selector preserves the current page and filters; see [company visual refinement](company-website-design.md).
- Developer directory export: `design/website/dist/developers-preview.html`. Both websites now have Developers homepage sections, profiles and property filters; see [developer design](website-developers-design.md).
- The **All screens** directory links to 70 page/state examples. The preview toolbar links to the general website, company website, editor and platform controls.

This portable review prototype uses plain HTML/CSS/JavaScript, separately from the CRM. The production public website remains planned in **Next.js**, with the Rust/Axum publication, catalogue and enquiry contracts. No framework migration, live hosting or production publication was performed.

## Screen coverage

| Family                  | Designed pages and states                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General website         | Home, all properties, Buy, Rent, Holiday homes, property detail, company directory/profile and its Properties/Agents/About/Contact tabs, agent directory/profile, areas and area details |
| Contact and information | Listing enquiry, company enquiry, confirmation, platform About/Contact, business information, undecided plan information, Privacy and Terms templates                                    |
| Company website         | Home, properties, property detail, team, agent profile, About and Contact; four themes across the same page system                                                                       |
| Company Website editor  | Overview, Design, Content, Properties, Enquiries and Settings; draft, submitted, changes requested, save error/conflict and domain/SSL examples                                          |
| Platform administration | General-site presentation, public review queue/diff, company sites/entitlements, policies/access and health/recovery                                                                     |
| Public system states    | No matching properties/companies/agents, unavailable property/site, setup pending, generic failure, not found and private CRM boundary                                                   |

Every sample company and agent public-listing count is calculated from the fictional inventory. Counts do not represent private CRM stock or staff performance. Company-site pages reject sample property/profile IDs outside that company. Price filters require a selected purpose so sale, annual rent and nightly rates are not compared as a single price basis.

## Interaction design

- Main navigation, profiles, directories, company tabs, property cards, theme switching and page links connect the journeys.
- Complete emirate/range/advanced search and the broader design corrections are recorded in [filter design and review](website-filters-design.md); `dist/filters-preview.html` opens an applied example.
- WhatsApp and Email buttons appear on every property card, the property's representative panel and agent profiles, on both general and company websites. Property links use the named listing agent's deliberately public contacts and prefill the property title/reference. Profile links contact that profile's agent. Missing or invalid public contacts are omitted; private login/provider contacts are never inferred.
- Contact links open WhatsApp or the visitor's email application; a click does not send a message or create a CRM lead. This prototype uses reserved fictional UK mobile numbers and `.example` email addresses, with sample-contact labels on the representative/profile panels. Production must bind approved public contact revisions, not these synthetic addresses.
- Search/filter/sort/pagination state appears in the URL; Back preserves filters and scroll position.
- Mobile menu and filters expand without losing the current query. Property gallery opens as a native modal and closes with Escape.
- Enquiry forms demonstrate required fields, reply-contact validation, separate optional marketing choice and a clearly labelled confirmation. No message is sent, lead created or visitor details saved.
- Draft values are held only in the current open preview. Save, submit/review, DNS/SSL and approval actions are explicitly simulated; no real account, entitlement or provider is changed.
- Legal text is a placeholder for review, not launch-ready legal terms.

## Verification and limits

Completed locally:

- 70 direct page/state links checked at **1440px and 390px**; no JavaScript exceptions or horizontal page overflow.
- An earlier **320px** pass found no horizontal overflow on the original 57 links. Current company and developer checks also cover 320px, as detailed in their design documents.
- 40 additional route/theme combinations across the four company themes and those two widths.
- Search → property → gallery → enquiry validation → confirmation, simulated draft save/submission and self-contained bundled navigation checks pass.
- Additional checks prevent unlike price-basis filtering and measure sampled dark-theme header/search/card/profile text contrast above 4.5:1.
- Contact checks cover listing-agent ownership, property context, public-only fields, invalid/missing contacts, keyboard order, 44px targets and 42 route/theme combinations at 1440px, 390px and 320px. Checks inspect links without contacting external recipients.
- Returning to filtered results preserves the query and the tested scroll position.
- Representative desktop/mobile screenshots were generated and inspected. A source/product review identified dark-theme inheritance and price-basis issues; both were corrected and retested.
- Existing CRM frontend unit/smoke tests: **471 passed**. Existing CRM production build: **passed**.
- Formatting, prototype file-size checks, repository shrink-only size baseline and whitespace checks pass. The strict whole-repository size audit still has its existing 37-file backlog; this prototype adds no oversized hand-written file.

The environment browser blocks direct `file://` navigation by policy, including permission retry. The self-contained HTML bundle was therefore exercised through the loopback server; its bundled navigation requires no further local assets. It uses inline script/styles/images for portability, but direct-file opening in a user's own browser was not tested here. Property community maps now make a deferred external OpenStreetMap request; location text/contact remain available offline. See [location design and provider-testing limits](website-location-design.md).

The checks are not a full WCAG audit, field Core Web Vitals result, production security review or completion of WEB1–WEB9. The imagery and content are fictional/illustrative, and the repeated sample images do not establish real property photography. The prototype is a connected review of the page system, not a claim that every future microstate, custom content block, domain provider or billing workflow is implemented.

## Next implementation boundary

Review composition, terminology, company themes and the end-to-end customer journey using this artifact. Approved visual patterns can then be implemented in the Next.js public application through the existing WEB packets. Retain exact-version publication review, scoped public profiles, original-company enquiry ownership, static phone/reduced-motion baseline and deferred full interactive 3D.
