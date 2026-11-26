# Public website API v1 — implemented local contract

Date: 2026-10-29. The owner initially assigned frontend and backend separately, then explicitly asked Codex to build the backend. The Next.js consumer in `apps/website` and Rust modules `sites`, `publications`, `catalogue` and `enquiries` now implement this contract locally. See [backend setup, private controls and limitations](website-backend.md). This is not a hosted launch, a production migration or a complete CRM Website editor.

Changes to public responses must update frontend types, decoders and tests together. Public read models and contact fields remain separate from private CRM identity/records. No publication approval queue is used.

## Binding and authentication

- Base: `/api/public/v1`. Read requests are anonymous. Website server calls use the fixed server-only `WEBSITE_API_ORIGIN`; only JSON Accept headers are sent, with no CRM cookies, credentials or forwarded visitor authentication.
- `GET /sites/resolve?host=harbour.example.com` returns `{ "data": Site }`. Resolve only exact active platform/verified-company hostnames; unknown, removed or ineligible hosts return 404. Do not use a fallback company. A forwarded-host header is not trusted by the website.
- Every subsequent request includes the resolved `siteId` in its path and **the same normalized `host` query value**. The backend must validate that pair on every request. A caller changing either cannot select another company or access private inventory.
- `Site` fields: `id`, `kind` (`platform|company`), `name`, `company` (company ID or null for platform), `theme` (`1|2|3|4`), and optional `content` with the eight plain-text CMS fields below. Responses never carry backend credentials, session IDs or private settings. Sample mode is a separate explicitly enabled local fixture adapter, never a response-error fallback.

## Read endpoints

All paths below start `/sites/{siteId}` and require `?host=...`.

| Method/path                                                              | Response                                                                  | Purpose                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /home`                                                              | `{ data: Catalogue }`                                                     | Up to six featured/recent eligible listings and public discovery/lookup content |
| `GET /listings`                                                          | `{ data: Listing[], included: Catalogue, pagination, errors?: string[] }` | Filtered, sorted, paginated public results; 12 items/page                       |
| `GET /listings/{id}`                                                     | `{ data: Listing, included: Catalogue }`                                  | Public listing and representative/company/area relations                        |
| `GET /companies`, `/agents`, `/developers`, `/areas`                     | `{ data: Entity[], included: Catalogue, pagination }`                     | Searchable directory, 12 items/page                                             |
| `GET /companies/{id}`, `/agents/{id}`, `/developers/{id}`, `/areas/{id}` | `{ data: Entity, included: Catalogue }`                                   | Public profile/community with up to 12 related listings                         |

`Catalogue` contains arrays `listings`, `companies`, `agents`, `areas`, `developers`. `included` is a public relation/lookup set, not the entire private inventory: include the company, agent and area for every supplied listing. Include selected filter options even when the current result is empty. Array bounds in the initial consumer are 500 entries per included collection, not a promise that the whole directory fits in one response; large searchable option sets need paginated option endpoints in a later contract revision. Do not truncate required relations silently.

`pagination` is `{ total: nonnegativeInteger, page: positiveInteger, pageSize: 12 }`; clamp an out-of-range page to the last valid page (at least 1), preserve filters, and never widen a search. `publicListingCount` on directory entities is the **total eligible count for this host**, not the size of the included listing subset. All counts must respect destination/membership/site eligibility and never expose private CRM totals.

### Public entity shapes

The exact field types consumed today are in [`types.ts`](../apps/website/src/lib/types.ts); [`public-shapes.ts`](../apps/website/src/lib/public-shapes.ts) projects those fields and drops all extra properties.

- **Company:** `id,name,mark,area,note,publicListingCount?,publicAgentCount?`. The agent count is distinct public agents with eligible listings on this host, never the private staff total.
- **Agent:** `id,name,company,specialty,publicWhatsApp?,publicEmail?,social?,publicListingCount?`. Only deliberately public, consented contacts; never infer from account/login/provider fields.
- **Social links:** site `content.social` (company and general site) and agent `social` hold any of `instagram,facebook,tiktok,linkedin,youtube,x,website` as https strings, re-checked by the API as served; consumers drop any link that fails the [link rules](website-social-links.md#3-link-rules-server-and-website-both-check) one at a time and never fail the response. A member's `website` is omitted on the general site.
- **Area:** `id,name,city,emirate,image,note,publicListingCount?`.
- **Developer:** `id,name,emirate,website?,publicListingCount?`. An association must be factual; sample associations are explicitly illustrative. Do not imply agency partnerships.
- **Listing:** `id,agent,company,developer,area,title,type,purpose,emirate,category,bedrooms,bathrooms,size,price,image,photos,floorPlans,description,ready,furnishing,market,parking,amenities,guests,minimumStay,publishedAt,reference,advertisingPermit?`.
- `price`: AED numeric value, never formatted text; purpose `buy` means sale price, `rent` annual rent, `holiday` nightly rate. `size`: sqft. `bedrooms`: zero for Studio, null for commercial. Non-holiday `guests/minimumStay`: zero. Dates are ISO-8601 strings. Optional developer IDs may be an empty string.
- Images are deliberately selected processed public copies, relative paths or HTTPS URLs. `photos` contains up to **20** selected images, cover first; `floorPlans` up to **3** processed image URLs. PDF originals stay private until a safe public conversion path exists. The connected CRM editor now permits 20 photos; the frozen browser demo retains its earlier 8-photo limit.
- **Never include** private unit/address/pin, GPS/EXIF, access notes, landlord/client/contact IDs, commission/finance, mixed original documents, private record payloads, sessions or provider tokens. A public listing ID is not permission to read the private Property record.

### Search query

Supported names are `q,purpose,emirate,area,type,category,minPrice,maxPrice,bedrooms,bathrooms,minSize,maxSize,furnishing,parking,amenities,ready,market,company,agent,developer,guests,nights,sort,page`. Option IDs live in [`options.ts`](../apps/website/src/lib/options.ts).

- Emirates: `abu-dhabi,dubai,sharjah,ajman,umm-al-quwain,ras-al-khaimah,fujairah`.
- Inclusive budget/sqft bounds must be finite, nonnegative, at most two decimals and ordered min ≤ max. A purpose is required for any budget or price sort. Do not compare annual, nightly and sale values.
- Bedrooms is `studio,1,2,3,4,5plus`; bathrooms/parking/guests are minimums; nights means required stay length must meet the listing's minimum stay. Holiday criteria are holiday-only, sale market is buy-only.
- `amenities` accepts repeated query keys or comma-separated IDs; match **all** selected amenities. Repeated other scalar keys use the first value.
- Sort: `newest,name,price-asc,price-desc,size-asc,size-desc`. Newest uses `publishedAt`, not fixture order or ID.
- Listing query errors should return an empty listing result with bounded actionable `errors` strings and required included lookups so visitors can correct filters. Do not turn invalid filters into a broad search or a successful default result.
- Directory filters: `q` (name), `emirate` and `availability=available` (at least one eligible listing), plus page.

## Publication and enquiries

The owner **removed separate approval**. Follow [direct publishing](product-decisions.md#direct-website-publishing-decided-2026-10-28): scoped Edit → Save draft / Preview → Publish, immutable selected public versions, validation/capacity checks, honest sync status and withdrawal/takedown. No mandatory Super Admin approval queue. The frontend must never call private CRM APIs from public visitors to implement this.

### Private website controls

Authenticated endpoints live under `/api/crm`; their session, CSRF and workspace checks are separate from anonymous public routes. The detailed endpoint/permission table is in [website backend](website-backend.md#private-controls). Company owning Admins control site content; the Super Admin controls the general site and eligibility. Members explicitly consent to their own public profiles; Admins cannot consent for another person. Staff publication additionally requires the Admin's explicit publisher grant. Owning Admins have their normal publication authority.

Site input is `{version,name,theme,slug?,host?,company?,content?,active?}`. `company` allows only `mark,area,note`. `content` allows only `tagline,about,services,contactText,heroTitle,heroSubtitle,seoTitle,seoDescription`, each plain text up to 4,000 characters. Name and theme are validated. No free HTML/scripts, arbitrary embeds, uploaded logos or custom-page blocks are implemented. The website binds the supported hero/About/Contact copy and page SEO metadata; storage of a field does not establish every planned page block is rendered.

A version of zero creates a new resource. Direct `PUT` saves and publishes a site version. For a private draft, `PUT /website/draft` accepts `{version,site: SiteInput}` and `POST /website/publish` accepts `{version: draftVersion}`. GET returns `{version,draft}`; `draft` is null when none is active. Draft generation is monotonic even after publishing: consumers must use the returned generation rather than reset to zero. Draft publishing also checks the embedded live site version, so concurrent direct changes cannot be overwritten. Published site/profile snapshots and public listing revisions are immutable.

Listing publication accepts `{recordId,recordVersion,agentProfileId,version,destination,permitReference,developer?,market?,photos,floorPlans?}`. Destinations are `general_and_company` and `company_only`; optional market is `primary|resale`. Source facts, live access, permitted media and capacity are checked again in the commit transaction. Advertising permit is the deliberately supplied publication reference, not an inference that an authority verified it. Private edits do not silently replace the frozen public version; status/identity/source eligibility changes can withdraw it immediately. Republish explicitly after correcting eligibility.

### Public media

Public URLs have the form `/api/public/v1/sites/{siteId}/media/{copyId}?host={normalizedHost}`. Every fetch rechecks the exact host/site pair and currently eligible publication owning that opaque copy. Old revision files, outside-share copies and private property file routes are not public. The Next.js server rebases only this precise URL form to its fixed `WEBSITE_API_ORIGIN`; that origin must be reachable by the visitor's browser for images as well as by the Next.js server. Responses use no-store; a future CDN must preserve withdrawal semantics.

### Enquiry intake

`POST /sites/{siteId}/enquiries?host=...` accepts an `Idempotency-Key` of 16–128 ASCII letters/digits/underscore/hyphen and `{ listingId?, agentId?, companyId?, name, email?, phone?, message, contactPreference?, privacyAcknowledged }`. JSON is bounded at 16 KiB. A valid email or international phone, name, 1–4,000 character message and privacy acknowledgement are required. `contactPreference` is `email|phone|whatsapp` and requires that contact channel. Unknown keys are rejected.

The backend derives the owning company/representative from current public relationships. Visitors cannot supply private workspace/member IDs, destination addresses or routing overrides. Contradictory company/agent/listing references fail. A company-site contact can target that company without a property. A general-site enquiry requires a public listing, agent or company; **unscoped general-platform intake stays disabled pending the owner's recipient decision**.

The submission creates one enquiry and one CRM Clients/Leads record in the same transaction. The lead has source `Website`, stage `New` and marketing contact permission `Unknown`; privacy acknowledgement is not marketing consent. Assignment goes to the named representative if they may hold Clients, otherwise the same company's Admin. The enquiry records source host/site version and selected publication revision. These are durable local CRM writes, not email/WhatsApp provider delivery or an implemented external notification outbox.

Success is `201 {receipt: opaqueUuid,status:"received"}`. An identical normalized retry with the same site/key returns 200 with the same receipt and no additional lead. Reusing a key for a different payload returns 409. Attempt, site, client and contact budgets apply; see backend operations notes. Errors never return private lead or workspace IDs.

The Next.js `/api/enquiries` POST relay requires a matching Origin/Host and forwards JSON plus Idempotency-Key to the fixed public API origin, without cookies or untrusted proxy/client-IP headers. The form displays received only after committed API success, retains its key for unchanged retries and refuses sample-mode sends. The relay currently shares one socket-derived client budget across visitors; trusted edge identity must be designed before public traffic.

## Failure, freshness and launch checks

Unknown/withdrawn/foreign entities: uniform 404. Oversized/malformed public bodies fail closed; current client bounds each response at 2 MB and requests have an 8-second timeout. The backend enforces its own route body limits. Provider/network failure is an unavailable state, never sample content. Public reads currently use `no-store` so a future cache cannot bypass takedowns; backend must also gate current eligibility. Versioned caches/outbox projections, canonical domains, sitemaps, complete content blocks and launch indexing need later integration work. This initial app deliberately disallows indexing.

Focused isolated API/browser checks exercise host/company isolation and enquiry/publication flows; see the handoff for current results. Before launch validate operations and production configuration as well as host/company isolation, forged IDs, revoked listing/media/profile removal, exact-location absence, no CRM cookie/session leakage, concurrency listing limits, unknown-host 404, enquiry idempotency/routing, CSP/provider allowlists and public image processing. Passing sample browser tests is not evidence that these backend controls exist.
