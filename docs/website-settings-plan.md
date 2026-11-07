# Website settings: Blaqks One general website and company websites

Planning date: **2026-10-28**. Implementation update **2026-10-29**: the [local website backend](website-backend.md), public Next.js websites and [company/platform content settings](website-content-settings.md) are implemented. This document retains the broader proposal; profile/listing/enquiry management, richer blocks and hosted launch work remain unfinished.

**Latest owner decision — direct publication:** [2026-10-28](product-decisions.md#direct-website-publishing-decided-2026-10-28) removes separate Super Admin approval for website content, profiles and listings on both websites. The current flow is Edit → Save draft / Preview → Publish. Earlier approval/submission language elsewhere in this plan is superseded; “approved public” describes deliberately selected, validated public content, not a required human review. Private data, scoped grants, eligibility and listing limits remain enforced. The existing prototype's review screens are historical; the connected content editor now publishes directly with private drafts and version checks.

Final planning checkpoint: two website types, improved structural direction and lightweight initial depth are recorded in [Product decisions](product-decisions.md#website-scope-structure-and-motion-decided-2026-10-28). The planned public application is shared Next.js; the CRM remains React/Vite. Full interactive 3D is deferred. Open detailed business choices in section 17 remain explicitly unsettled.

The owner requested a complete settings plan and clarified the scope: **only the Blaqks One general website and company websites**. There are no separate individual-agent websites. Agents have approved profiles and listings within these websites. Existing company-site and public-listing decisions remain authoritative; proposed defaults below are not new owner decisions.

Read with [Product decisions](product-decisions.md#public-listings-decided-2026-10-12), [Public website plan](public-website-plan.md), [Implementation roadmap](claude-implementation-roadmap.md), [Service boundaries](service-boundaries.md), and [Design standards](design-standards.md). Where older roadmap/system-design recommendations conflict with confirmed product decisions, the confirmed decisions win.

**Design refinement request (2026-10-28):** the owner supplied a Claude design and TikTok real-estate inspiration and wants a smooth, striking, high-quality UI/UX with possible 3D that stays fast. See the [visual refinement and motion brief](website-visual-refinement.md) for both source URLs, the current access limitation, progressive depth, screen direction and measurable performance targets. Refine the actual source once it can be inspected; preserve approved branding. Preview desktop/mobile, both supported themes, keyboard/reduced motion and realistic loading/error/draft/review states.

## 1. The two website types

| Site                       | Purpose                                                                                              | Controlled by                                                         | Inventory                                                       | Enquiries belong to                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| General Blaqks One website | Public property discovery, company/agent discovery, platform information and CRM product information | Platform Super Admin and future explicitly delegated platform editors | Every eligible approved listing selected for the general site   | Listing's original company; separate platform queue proposed for general platform enquiries |
| Company website            | A company's branded public presence, services, team and properties                                   | Company Admin; explicitly delegated website staff                     | That company's eligible approved listings selected for its site | That company                                                                                |

Agent profile pages can show approved professional information and their eligible listings inside the general/company website. They are not standalone sites and have no separate theme, domain, subscription or personal-site entitlement. An Admin who is also a listing agent manages the company website and their public agent profile as separate tasks within the same company.

“Private website” in older notes means separately branded public company website. It does not mean password-protected customer access. Private customer portals are outside this release.

Recommended general-site structure: property discovery at `/properties`, companies at `/companies`, agents at `/agents`, and clearly separated Blaqks One product pages such as `/crm`, `/plans` and `/contact`. The home-page emphasis between property search and CRM sales needs owner review. Published plan prices must come from an approved commercial catalogue, never invented marketing text.

## 2. What exists in the CRM and what must be added

This is a review of repository code and product documentation, not an inspection of customers' private records or a production-data audit.

| Existing foundation                                                                                                                                | Website use                                                            | Missing work / restriction                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Connected sessions, Admin-owned workspaces, staff grants, suspension/archive and record assignment                                                 | Authorise website editing and preserve enquiry ownership               | Add website/publication permissions; membership alone never permits publishing                                                      |
| Company profile: display name, emirate, Free-plan seat limit                                                                                       | Prefill a company setup draft                                          | Public logo, description, contacts, services and address need separate public versions; a seat limit is not a website entitlement   |
| My profile: name, phone, positions, account settings                                                                                               | Prefill selected agent draft fields after explicit review              | Never automatically expose login email, personal phone or account/security data                                                     |
| Marketplace profile, photo, areas, optional licence and factual statistics                                                                         | Optional explicitly selected starting content for public agent drafts  | Marketplace publication consent is not website consent; optional declared licence is not verified public-listing eligibility        |
| Properties: purpose/type, emirate/community/building/unit, price/basis, availability, readiness, amenities, descriptions, permits, map/media links | Prepare allowlisted public listing drafts                              | Implement frozen public revisions, verified eligibility, approval and catalogue; never publish the whole Properties object          |
| Private media storage and processed private uploads                                                                                                | Source for selected public image derivatives                           | Public assets need independent approved derivatives, immutable versions and takedown rules; mixed document URLs remain private      |
| Clients/Leads, assignees, Follow-ups, activity and assignment history                                                                              | Store enquiries as leads and handle response work                      | Implement durable public enquiry intake, authoritative routing, idempotency and delivery status                                     |
| Inbox, Channels, personal/business email, outbox worker and team chat                                                                              | Reuse authorised response resources and durable jobs                   | Provider availability remains conditional; contact-button clicks are not received messages; Team chat is never a public chat widget |
| Agreements, listing shares and marketplace offers                                                                                                  | Preserve the distinction between private collaboration and advertising | A received share, accepted agreement or marketplace offer is never publication permission                                           |
| Finance, payments, expenses, reports, imports and exports                                                                                          | Website plan entitlement is a separate future platform concern         | No commissions, landlord/client details, private reports, staff permissions or original documents enter public APIs                 |
| Current navigation/settings                                                                                                                        | Existing account, team and channel contexts remain                     | No Website settings, public catalogue, publication approval or customer website is currently implemented                            |

## 3. Confirmed rules to carry forward

- English only; AED prices with explicit sale, annual-rental or nightly basis; dates/times use Asia/Dubai where relevant.
- Authorised publishers publish an **exact public revision** directly after validation; no separate Super Admin approval is required on either website.
- Company sites are optional paid add-ons or higher-plan features. Exact names/prices are undecided. The existing plan allows operator-controlled entitlement until billing exists.
- A company site may go live without a verified licence; public property listings still require verified licensing/permit eligibility. Proposed profile rule: an approved informational agent profile may appear without verified licensing, with accurate declared/verified labels; any associated public listing still requires the separate verified licensing/permit gate. Confirm this profile rule before implementing it.
- Four owner-reviewed themes, logo and one brand colour; fixed Home, Listings, Listing detail, About and Contact pages, with extra structured pages planned.
- Company sites get a platform subdomain and may connect an ownership-verified custom domain with automatic SSL; buying domains is deferred.
- Listing enquiries go first to the approved listing agent, falling back to the **same company's** Admin queue. Agent departure cannot transfer historical enquiries to a new company.
- Private CRM changes do not automatically overwrite approved public content. A company website is another display destination for an approved publication, not a new copy of that property.

### Listing-limit wording requiring care

The explicit 12 October public-listing rule is **at most two live listings of the same physical property per Admin team**, with at most two Admin teams for that property on the general site. In-flight publication reservations also hold capacity atomically until activation or failure/cancellation; there is no human-approval reservation state. It is not a cap of two total properties in the company's inventory.

The 20 October company-site decision shortens this to “2 live listings per team,” creating ambiguity. Recommended interpretation: preserve the per-property team limit across all destinations; apply the two-company limit only to the general site. Owner confirmation is needed before implementing any different total-inventory cap. Website plan quotas, if introduced later, must be separate, explicitly priced settings.

Showing the same approved agent listing on the general and company websites counts as one publication slot, not two. Company sites do not provide a route around the per-property team limit.

## 4. CRM navigation and permissions

Add **Website** for company Admins and delegated website staff, and **Platform → Websites** for the operator. Eligible staff access their approved **Public profile** through company-publication controls, without a My website menu. Put listing preparation/status in **Properties → Public listings**, with links from Website; do not mix content settings with everyday private property editing.

| Action                                 | Platform operator                                     | Company Admin                                    | Delegated company website manager                                          | Listing agent                                          |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| General-site branding/pages/navigation | Yes                                                   | No                                               | No                                                                         | No                                                     |
| Grant company-site entitlement         | Yes, audited platform operation                       | Request/view own entitlement                     | View if permitted                                                          | No default access                                      |
| Company theme/content/pages            | Review public submissions; no routine company editing | Own company                                      | Explicit `site.manage` in own company                                      | Only if explicitly delegated                           |
| Draft professional public profile      | Review submitted snapshot                             | Coordinate opted-in members                      | Explicit profile-content grant                                             | Own profile draft, consent and submission if permitted |
| Connect/remove company domain          | Operator emergency removal                            | Own company                                      | Separate `site.domain.manage`, off by default                              | No default authority                                   |
| Draft/submit public listing            | No new private-record access                          | Own permitted records                            | Requires publication grants and record scope in addition to website access | Eligible records plus representation/submission grant  |
| Publish public listing/content         | General-site editorial content; no new private access | Own company content and eligible scoped listings | Explicit scoped publication grant                                          | Eligible records with listing/publication permission   |
| Read enquiries                         | Platform enquiries only; restricted recovery metadata | Own company                                      | Only if separately granted CRM lead/inbox access                           | Own assigned enquiries                                 |
| Pause/withdraw public material         | Operator across public surfaces, with reason/history  | Own company material                             | Explicit scoped withdrawal grant                                           | Publications only with withdrawal grant                |

Proposed permission names are planning contracts, not existing permissions. Website editing must not grant record visibility, inbox access, financial access, sending authority or staff administration. Add domain-management and publication capabilities explicitly; positions only suggest defaults. Staff grants start off.

The operator reviews submitted public snapshots and operational metadata, not private Property/client rows. Preserve the product decision against expanding routine Super Admin access to company business data. A later support-access flow must be company-consented, time-limited and audited.

## 5. Shared settings layout

**Navigation refinement:** the owner subsequently requested a better structure. Group the sections below into **Overview, Design, Content, Properties, Enquiries, Settings**, following the [structure blueprint](website-structure-blueprint.md#8-website-settings-group-the-work-into-six-areas). The table remains the field/workflow inventory, not eleven equally prominent sidebar items. Platform Websites has its own General site, Review queue, Company sites, Policies & access, and Health & recovery hierarchy.

Company sites share one editor and four theme options. Platform settings use the same interaction patterns with additional governance controls.

| Section            | Main fields and controls                                                                                                                          | Behaviour                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Overview           | Site name/type, preview/live URL, setup checklist, saved/submitted/live revision, moderation, entitlement, domain and sync health                 | Each status is independent; identify the next actionable issue                                  |
| Identity & contact | Public company name, tagline, short/long description, logo, business address precision, office hours, phone/WhatsApp/email, approved social links | Explicit publication consent; public contacts separate from login/provider credentials          |
| Appearance         | One of four themes, one brand colour, logo variants, favicon, hero image/crop, supported display mode                                             | Safe options only; contrast validation; reset and draft preview                                 |
| Pages & navigation | Fixed pages, section order, extra pages, menus/footer, CTA choices                                                                                | Structured blocks; active internal destinations; no executable HTML/scripts                     |
| Listings           | Destination selection, eligibility/status, selected featured listings, default sort, visible filters                                              | Only eligible approved publications; no “publish all CRM properties” switch                     |
| Public people      | Company directory members, approved public profiles and brokerage attribution                                                                     | Consent and version approval; selecting a member does not grant that member private data access |
| Enquiries          | Form configuration, approved contact buttons, confirmation text, response hours, notification preferences, routing explanation                    | Server fixes company/listing recipient; notifications use separately authorised resources       |
| Domains            | Platform address, custom domain, ownership/DNS/SSL state, primary host and redirects                                                              | Separate authority; guided DNS; no arbitrary redirect destination                               |
| Search & sharing   | Page title/description, social image, path, indexing status, sitemap/canonical health                                                             | Platform-generated canonical/sitemaps; no conflicting tenant overrides                          |
| Privacy & consent  | Privacy/contact links, separate marketing choice, optional analytics status, form notice                                                          | Platform minimums cannot be removed; no preselected marketing consent                           |
| History & access   | Who changed/submitted/approved, public revision history, collaborators, pause and restore                                                         | No tokens, message bodies or visitor contact details in audit                                   |

Use a full settings workspace for substantial editing, phone-friendly section navigation and a persistent draft status. Avoid one enormous modal. Every save retains a draft; preview and review are separate actions. Dirty forms survive navigation warnings, validation errors and version conflicts. On concurrent edits, show a conflict with a comparison; do not silently overwrite.

Use the current CRM forest-green/neutral/gold design and shared controls. The public themes can have distinct composition within their supported brand options; the actual four designs need owner approval before coding. Keyboard use, 390/1280 widths, both supported display modes, long names, empty content and reduced motion are acceptance requirements.

### First setup and recurring work

Company setup is a stepper: entitlement check → public company details → theme/branding → pages/contact → address/domain → phone/desktop preview → Publish. Listings have their own checklist and can follow later; a site can launch with an honest empty Listings page. Domain setup can be completed after the platform subdomain is live. Avoid forcing an Admin to buy a domain or add a property to finish setup.

Returning Admins land on Overview, which shows the live version, any newer draft and outstanding issues. Editing About does not require restarting setup. Company staff see only sections their explicit grants allow. Platform operators manage publication health, history and exceptional takedowns without a routine approval queue.

Recommended validation contracts to finalise in WEB6: public display name up to 100 characters, tagline 160, short description 500, page title 100, menu label 40 and SEO description 160. Character counts should guide good copy; metadata lengths are editorial targets, not search-engine guarantees. Use bounded page/block counts and upload-byte/pixel limits from the media contract. Require alt text for meaningful images, allow safe HTTPS links only, strip image metadata, and reject executable/SVG uploads unless an explicitly reviewed processing path supports them. Office addresses/maps and public contacts are optional individually, but a Contact page needs at least one approved usable contact method or durable enquiry form.

Long descriptions should use structured text with safe formatting. Validate on the server as well as in the form. Never allow external URL imports to make unrestricted server-side fetches. A removed image produces a clear draft error and cannot be silently replaced with a real-looking sample photo on a live website.

## 6. General Blaqks One website settings

Platform sections cover:

1. **Platform identity:** Blaqks One name, approved logo/favicon, official business/support contacts, office details, social profiles, default social image and footer. Keys with Simoni is one customer company, never the platform identity.
2. **Public pages:** home/search, results, listing detail, company directory/profile, agent directory/profile, platform About/Contact, privacy, terms and unavailable/not-found pages. CRM product/pricing/help pages sit in a distinct navigation group with accurate capability claims.
3. **Discovery:** controlled UAE emirate/community taxonomy, sale/rent/holiday bases, residential/commercial subtype, readiness and primary/secondary fields, bedrooms, price bounds and sorting. Do not merge off-plan with primary or nightly with annual prices. Never show private stock totals.
4. **Editorial home sections:** selected locations, approved listings and approved agents/companies. Editorial selection changes placement only; it cannot approve a listing or bypass eligibility. Label paid placement if introduced; paid ranking and pricing require separate approval.
5. **Publication management:** public profile/site/listing/page status, version preview/diff, validation and permit eligibility, sync health, history, withdrawals and emergency public takedown. No prepublication approval queue.
6. **Site directory/entitlements:** site type, company, responsible Admin/editor, plan feature, enabled/paused/lapsed status, renewal date if known and reason history. No customer business-record browsing from here.
7. **Platform contact intake:** separate categories for platform sales, customer support and website/report-listing concerns. Proposed destination is a platform support queue; property-specific requests always remain company enquiries. Do not distribute general visitors to paying agencies without an explicit routing/consent policy.
8. **Search and trust:** generated sitemaps, redirects, canonical policy, index health, privacy/terms versions and approved advertising disclosures. A manually typed licence is never displayed as verified.
9. **Operations:** domain/SSL health, catalogue sync lag, failed publish/takedown jobs, bot controls, rate limits, enquiry storage/notification health and operator alerts. Credentials stay in deployment secrets/provider configuration, not website content forms.

No general-site editor may enable a company feature, change private tenant ownership or send from a company's mailbox merely by editing website settings.

## 7. Company website settings

### Identity and presentation

Start with the company's name/emirate prefilled into a draft. Require explicit public company display details, logo or supported text-logo fallback, brokerage description and approved business contacts. Optional office address/map, services, areas served and social links are individually selectable. Public trade/ORN/ADREC claims use approved structured fields; uploaded licences remain private evidence.

Fixed pages:

- **Home:** hero, buy/rent/holiday search, manually selected eligible featured listings, service/area highlights, approved team teaser and contact CTA.
- **Listings:** all company-destination publications, public filters, sort and pagination; an honest empty state without other companies' stock as a substitute.
- **Listing detail:** approved property content, price basis, gallery/floor plans, public agent and permitted contact/enquiry actions.
- **About:** approved company story, services, areas and optional team directory. Do not invent achievements, testimonials or verification badges.
- **Contact:** approved business contact methods/hours and general company enquiry form.

Company Admin can decide which opted-in approved public profiles appear in the team directory. Membership or a staff photo alone is not permission to advertise a person. Each public agent profile identifies the correctly approved brokerage.

Recommended initial extra-page limit is the existing plan's **10**, using heading, text, image/gallery, approved listing grid, approved team block and contact form. Navigation labels/order and footer links are controlled; unpublished pages cannot be linked as live. Deleting a live page requires a redirect/retirement decision and does not delete CRM records.

### Listings and destinations

Preserve the current choices: **General site + company site**, or **Company site only**. General-only companies without an optional site continue to publish on the general site. No individual-agent website destination exists. Eligible agent profile pages list the same approved publications within their host website.

A company chooses its own approved publications for homepage features and may hide an eligible listing from its optional site without changing the underlying private record. A listing removed from all selected destinations is withdrawn rather than left misleadingly marked live.

### Enquiries and access

Property enquiries follow the listing's approved agent. General company-page enquiries go to that company's Admin queue. The company can give staff separate lead/inbox access using existing scope rules. Notifications may target active authorised company members, but delivery addresses must not change lead ownership. A visitor's contact preference is not blanket marketing permission.

## 8. Agent profiles inside the two websites

Profiles contain deliberately approved professional name, title, photo/text fallback, short bio, experience, service areas, specialties, optional permitted credentials and professional contact methods. Existing My profile or Marketplace content may prefill a draft after explicit field review; it is never automatically public or kept linked to mutable private account fields.

A profile is published as an exact public version with consent from the represented member and scoped publishing authority, without a separate approval stage. A company can nominate directory members, but cannot turn internal staff contact information into public content merely by selecting a checkbox. Public listing representation remains an explicit Admin grant; staff titles do not grant it.

General-site profiles show that agent's eligible publications selected for the general site. Company-site profiles show that agent's eligible company-destination publications in that company. Shared view-only records, marketplace offers and colleagues' private listings are not added to either public profile automatically. No separate site editor, domains, billing or individual website portability is needed.

Recommended profile-page CTA is to enquire about a displayed listing. If a generic “Contact this agent” form is enabled, it routes to that agent within the displayed company, with the same company's Admin fallback; visitors see the receiving company. It never follows a staff identity into a different tenant.

On departure/suspension, remove the member's current public representation and stop new ineligible enquiries. Existing enquiries retain their original company and attribution and move to its Admin queue when required. A replacement listing agent needs a new approved public revision. Rejoining does not revive withdrawn/expired listings automatically. No historical company leads or private records transfer because a profile changes.

## 9. Public listing and profile content rules

Public allowlist: title/description, purpose, asset/subtype, approved location precision, price/currency/basis, bedrooms/bathrooms/area/parking, readiness/furnishing, permitted availability facts, selected amenities/media/floor plans, advertising permit fields and approved professional profile/contact version.

Private by default: unit reference/exact access instructions, landlord/contact IDs, client identities/requirements, notes, commission/margins/finance, original documents, mixed photos/documents URLs, account email, staff grants, internal IDs and authentication/provider data. Approved public business email may deliberately equal a login address, but requires separate explicit selection/approval; never infer it.

Recommended location default is emirate + community + permitted building/project, with approximate map location. Exact address/pin and advertising permit/QR display must be settled against applicable advertising requirements before listing launch. The website cannot rely on marketplace contact-release rules as public approval: MK4 release is participant-only.

Each public profile/contact change gets a new public revision. Publishing an agent/company name, photo or contact change identifies and updates dependent live public snapshots after validation, without a separate approval. An urgent incorrect contact can be removed promptly. Draft/private profile edits never silently mutate published versions.

## 10. Save, preview and direct publishing

Separate **entitlement**, **site lifecycle**, **content revision**, **publication eligibility**, **domain/SSL**, and **catalogue sync** status. A site may be live on a subdomain while its custom domain is still pending, or have a new draft while its older published content remains live.

| User action              | Result                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Save draft               | Private version saved; visitors see no change                                                                                  |
| Preview                  | Authenticated, non-indexed preview of a specific draft/site/viewport; no public cache or CRM cookies on visitor domains        |
| Publish / Save & publish | Validate scoped authority, public content, media, eligibility and capacity; freeze a public version and sync selected websites |
| Publishing / Sync failed | Show actual catalogue/cache progress; retain draft and recovery action on failure; never claim premature success               |
| Pause site               | Stop that site's public exposure and intake; show effect on company-only listings before confirming                            |
| Withdraw listing         | Stop enquiries immediately and remove it across all selected destinations                                                      |
| Restore earlier version  | Publish a new revalidated version of still-eligible content; never undo withdrawal/suspension with a rollback                  |

Logo, text, public contacts, hero media, extra pages, profiles, SEO, theme and safe brand colour publish directly through explicit scoped commands and validation/version/history checks. Navigation cannot expose draft pages. Private CRM record saves remain separate from public publishing; a theme change does not change listing destinations or eligibility.

Recommend a short-lived preview served from a dedicated authenticated preview boundary with protected assets. Do not place public draft tokens in normal analytics, indexing or referrers. An expired/foreign preview shows a generic unavailable state. Preview enquiry submits are disabled or use an explicitly labelled synthetic test flow.

## 11. Domains, URLs and SSL

Use one rendered application with explicit site kinds: `platform` and `company`. Example only: `company.<platform-domain>`; final domain and URL scheme need owner approval. Reserve platform/application/system names, offensive/impersonating names and collisions. Unknown hosts return 404, never another tenant's default site.

Carry forward the existing proposal: company slugs are lowercase, unique and changeable at most once every 30 days, with a redirect from the old slug. Keep the old slug reserved while its redirect exists; do not reassign it to a different company. Show the current address and destination before confirming a change.

Domain flow: enter hostname → validate → prove ownership → show exact DNS records → verify provider and certificate → activate → set primary → redirect other verified hosts. States include Pending DNS, Verifying, SSL pending, Active, Action needed, Removing and Removed. Show last check, useful reason and Retry; never show success because DNS input was saved.

Use the existing proposed Cloudflare for SaaS adapter behind a provider boundary; verify current availability/pricing before procurement. Keep the subdomain working while a custom hostname is pending. Initially one active custom domain/site, recommended `www`; apex support depends on registrar/edge capabilities. Redirect only among verified aliases for that site. Display billing/domain expiry as unknown until authoritative provider data exists.

Changing a hostname requires fresh ownership verification. An old verification token or stale worker cannot claim/re-add a removed domain. Prevent subdomain takeover; never release/reassign a hostname while old origin routes or unverified DNS still point to another tenant's content. Emergency withdrawal must work without waiting for normal DNS TTL.

Company-site lapse follows the existing proposal: unavailable page on its platform address for 14 days, then 404; custom domain unbound promptly at the edge. Company-only listings stop showing and cannot silently move to the general site. Moving to general uses current slot/eligibility checks without reapproving unchanged content. Loss of member eligibility always disables that member's affected public representation immediately.

## 12. Enquiry forms, response work and analytics

Initial forms: name, at least one usable reply contact, preferred response method and bounded message. Listing forms bind the displayed publication/revision; company contact forms bind the verified site/company, while general platform contact forms bind the platform queue. Optional structured budget/purpose fields can be added when useful without copying a private client form to the public page. No public attachments or self-booked confirmed appointments initially.

Display who receives the enquiry and the applicable privacy notice. Acknowledge only after durable storage and idempotency checks. Link/create the lead within the destination company; matching is company-scoped and must not overwrite verified contacts based on an unverified guest match. Notification failure does not lose an accepted enquiry or create it again.

Guest retry retains the draft and idempotency key. Unavailable/stale listings refuse new intake clearly without silent rerouting. Accepted enquiries keep original company, listing revision, agent, site, timestamp and allowed source attribution. Quarantine later events for archived companies without writing into a frozen workspace or exporting visitors to another team.

Response settings: working hours, honest expected response text, approved call/email/WhatsApp buttons and authorised staff notification subscriptions. Notifications and reply resources are separate; never imply message delivery from a link click. Public live chat, automated marketing, AI, calendar booking and telephony remain separate roadmap work.

Recommended launch analytics: aggregated views, listing-detail opens, form starts/completions, contact clicks and intake/notification health, scoped by site and time. Company Admin sees their company-site aggregates; listing agents may see permitted listing-level totals, not a personal-site dashboard. No raw visitor contact details in settings dashboards, no cross-company visitor identity, no fingerprinting or session replay. UTM/referrer data is allowlisted and stripped of query secrets/contact information. Optional third-party analytics/advertising requires consent/provider review and explicit enablement; no arbitrary tracking-script field.

## 13. Search engines, accessibility and public trust

Stable rendered URLs, per-page metadata, validated social images, generated sitemap/robots and honest structured data. Draft/preview/staging content is protected and non-indexed; `noindex` alone is not protection. Customer settings may suggest metadata but cannot remove platform canonical/eligibility rules.

The existing company-site plan prefers the company URL as canonical when a listing is there, otherwise general. Preserve that rule for one publication on both websites. Reconcile it with the older proposed “one canonical physical-property page” grouping during SEO contract design: physical-property duplicates across companies are not the same thing as one publication displayed on two hosts. Use stable listing IDs, never infer equivalence from title alone, and do not let companies type cross-tenant canonical URLs.

Map licence/permit facts, “declared” versus “verified” labels and truthful active availability explicitly. No marketplace dispute facts, customer testimonials, star ratings, invented success totals or claimed verified badges enter public sites without a separately approved policy. No private commission/agreement evidence is published.

## 14. Architecture and data contracts

Retain the CRM React/Vite application and Rust/Axum modular backend. The public rendered web application follows the existing Next.js proposal, with one shared component/theme system, a catalogue API and no CRM session access. Public hosts never receive CRM cookies; CRM cookies must remain host-scoped. A trusted edge resolves verified hosts, including correct handling of forwarded hosts, before catalogue selection. Visitors cannot choose a company by payload.

| Module owner                                                       | Proposed owned data                                                                                                                                        | Integration                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `sites/`                                                           | Site identity/kind and company ownership; settings/content/page revisions; destinations/navigation; host bindings; entitlement references and site history | Live identity/workspace checks through owners, public projections via outbox                  |
| `publications/`                                                    | Public agent/company profile revisions, listing revisions/decisions, eligibility and per-property capacity                                                 | Records/media owned APIs, active representation checks, no private tables in public catalogue |
| `catalogue/`                                                       | Approved active site/profile/listing projections, host map and cache generation                                                                            | Its own read model only; public reads gate current takedown/membership generation             |
| `enquiries/`                                                       | Durable intake/idempotency, source site/listing revision, original workspace, routing and notification states                                              | Lead creation/assignment through existing domain commands and transactional outbox            |
| Platform entitlement owner (to be assigned in BO1/platform design) | Features, company-site entitlement/counts, history and eventual billing references                                                                         | `sites/` consumes explicit access result, not finance or staff-seat guesses                   |
| `media/` and `outbox/`                                             | Approved derivatives; durable projection/domain/takedown jobs                                                                                              | Domain functions; immutable asset IDs; stale-job guards                                       |

Indicative private APIs stay under `/api/crm/.../sites`, publication/profile commands under their domain, and public-profile commands verify the authenticated member plus current company. Platform review/entitlement commands get an explicit operator scope; clients cannot set site kind, owner, workspace, approval or verification flags. Public site catalogue and enquiry routes use `/api/public`, with a separately scoped preview surface. Exact route/schema design belongs to the first architecture packet.

All mutations check expected version and live permissions. External side effects follow committed outbox work. An old approved event cannot reactivate a withdrawn listing, lost membership, removed domain or expired entitlement. Access/cache generations must gate origin reads immediately; enqueueing a removal without a read-side guard is insufficient. Cache keys include canonical host, site and public version; public media approval and revocation remain explicit.

## 15. Operational defaults proposed for review

| Item                                              | Proposed initial target / policy                                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New intake after withdrawal/suspension            | Refused immediately by origin checks                                                                                                                                                   |
| Removal from controlled pages/search/sitemaps/CDN | Target within 60 seconds; measure and confirm with selected edge before launch                                                                                                         |
| Enquiry success receipt                           | After durable commit, target p95 within 3 seconds under agreed load                                                                                                                    |
| Failed notifications/domain/projection jobs       | Visible state, bounded retries and an operator recovery queue; no fabricated success                                                                                                   |
| Draft saving                                      | Explicit save first; autosave only if its failure/conflict/recovery behaviour is designed                                                                                              |
| Site pause vs removal                             | Reversible pause with visible effect; permanent deletion/retention requires separate reviewed flow                                                                                     |
| Storage and hosting                               | UAE-region managed database/object storage, backups/restore verification; no private CRM CDN caching                                                                                   |
| Retention                                         | Document per class: visitor attribution, abandoned drafts, submitted enquiries, approved evidence and domain verification; exact durations need owner/legal decision before production |

A slow CDN or domain provider must not weaken intake eligibility checks. Define load/traffic/image volume, alert recipients, backup RPO/RTO, outage pages and measured performance before buying hosting. Do not present proposed timings as verified service guarantees.

## 16. Build sequence and acceptance

Keep WEB1–WEB9 dependencies from the existing plan, extended rather than replaced:

1. **Planning/WEB4 design:** settle section 17 decisions; prototype the two settings contexts and four public theme compositions for owner review. No hosting/provider changes are implied.
2. **WEB1 public media readiness:** explicit selected derivatives, image processing, immutable ownership and revocation.
3. **WEB2 publication foundation:** consented public profiles, immutable listing revisions, scoped direct Publish commands, capacity/licence/permit rules and withdrawal; no human approval queue.
4. **WEB3 catalogue and enquiries:** projections/host contract, durable intake and original-company lead routing; general enquiries get an explicit destination.
5. **WEB5 general site:** useful discovery, details/public profiles, form, SEO and takedown; launch gates remain separate.
6. **WEB6–WEB7 company settings/sites:** entitlement, versioned content, subdomains, safe themes, contact/pages and lapse.
7. **WEB8 custom domains:** verified company-domain binding, DNS/SSL states, redirects and safe removal; one active custom hostname per company site initially.
8. **WEB9 extra pages:** reusable structured blocks and per-page revisions for company sites. Richer analytics, billing automation and additional themes follow measured needs.

Minimum acceptance scenarios:

- Company A's manager and marketer have separate approved public listings; company B's records and enquiries never appear in A's settings or public projection.
- Company editors and listing agents can publish only with the appropriate scoped grants; website access cannot expose hidden record pickers/totals or grant private CRM access.
- Agent profile pages list only the approved representative publications eligible for that host; received shares and private coworker inventory never leak.
- One publication on both websites reserves one slot; simultaneous same-property submissions enforce existing team/general-site limits without revealing rival records.
- Private client, landlord, exact access, finance, original media and authentication fields are absent from public HTML, JSON, SEO, image metadata and errors.
- Draft/private profile/contact/media edits never mutate a live public version; explicit Publish creates its successor. Emergency withdrawal overrides queued activation and rollback.
- Listing, company-contact and optional agent-profile contact forms route from trusted publication/site/company relationships; repeated taps produce one durable enquiry and response work item.
- Departure removes ineligible agent representation and future intake; prior leads remain with their original company.
- Unknown/forged host, foreign preview, expired token and domain reuse cannot show another site's content. CRM cookies never reach public hosts.
- Domain/SSL/provider failures preserve the working subdomain and draft state; removed domains cannot be restored by stale jobs.
- Permission loss while editing blocks the next write, preserves recoverable drafts appropriately and cannot be bypassed by a queued publish.
- Phone/desktop previews, keyboard focus, long copy, contrast, image alternatives, empty states, slow sync and retry flows are tested with fictional data.
- Measure takedown across every destination, cache and sitemap and intake failure; test worker/database restart and provider outage.

This plan has had source-based product and security review. No rendered public website or production configuration has been implemented or runtime-verified by this planning task.

## 17. Owner decisions to settle

The owner confirmed only the general website and company websites; earlier questions about individual-agent sites are withdrawn. Pending company/platform decisions remain visible:

| Decision                                | Recommendation                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Company-site plans/prices and quotas    | Paid add-on or higher-plan entitlement as decided; define price and optional page/media quotas separately from publication limits |
| Per-property limit shorthand            | Preserve two listings of the same property/team; no two-properties-total cap unless separately decided                            |
| General-site home priority              | Property discovery leads, separate CRM sales navigation; confirm business emphasis                                                |
| General contact requests                | Platform queue, never auto-distributed to agencies                                                                                |
| Platform domain and company slug format | Owner supplies registered domain; unique company subdomains with reserved system names                                            |
| Public map/contact/permit display       | Approximate location and deliberately approved professional contacts; confirm advertising requirements                            |
| Canonical precedence                    | Company, then general; profile pages link to the corresponding eligible listing                                                   |
| Four visual themes                      | Owner reviews designs before implementation; names/layouts are not yet selected                                                   |
| Featured/paid placements                | Editorial approved content only at first; paid promotion separate                                                                 |
| Operational/legal launch values         | Confirm takedown target, retention, response expectations, hosting budget/volume, privacy/terms and responsibility for domains    |

Record accepted choices in [Product decisions](product-decisions.md) with their actual confirmation date; do not infer acceptance from saving this proposal.
