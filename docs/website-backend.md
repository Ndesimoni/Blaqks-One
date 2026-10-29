# Website backend: implemented local foundation

Date: 2026-10-29. The owner authorised building the backend after the Next.js frontend. This implements local website configuration, public profiles, direct property publication, host-scoped public discovery/media and durable targeted enquiries in `services/crm-api`. The public consumer contract is [website API v1](website-api-contract.md). No content approval stage is required.

This work has not provisioned hosting, applied migrations to development/production data, verified real domains/licences/advertising permits, connected provider delivery or completed the CRM Website settings screens. Test results belong in the current [handoff](handoff.md); sample-mode screenshots do not prove backend operation.

## Ownership and storage

| Module         | Owns and exposes                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sites`        | `sites.crm_website_sites`, public profile snapshots, immutable content versions/site events and private drafts; own-company/Admin and platform/operator controls; host resolution and scoped public company/profile projections |
| `publications` | `publications.crm_website_listings`, immutable selected revisions and lifecycle events; source-version checks, destination/capacity, publication and withdrawal                                                                 |
| `catalogue`    | Anonymous public read composition, validated search, host-scoped counts and developer reference registry; no private table ownership or copied CRM inventory                                                                    |
| `enquiries`    | `enquiries.crm_website_enquiries` and immutable received events, source revision/host evidence, idempotency, intake budgets and scoped private enquiry list                                                                     |
| `records`      | Private source lookup/projection and `records::website_lead::create_in`; no other domain reads or writes private record payloads directly                                                                                       |
| `media`        | Original private media and separately reserved `public_snapshot` copies; only owner functions attach, verify and serve public copies                                                                                            |

Migrations 0081–0086 introduce these structures and lifecycle guards. The boundary registry is split between `scripts/boundaries.json` and `scripts/boundaries-website.json`. [Decision W1](service-boundaries.md#website-owner-apis-and-lifecycle-guards-w1-2026-10-29) records the deliberately accepted transactional trigger coupling. There are no new foreign keys into private CRM identities/records. A public UUID never grants access to a private property/member ID.

## Private controls

All paths below start `/api/crm`. Mutations use the existing session/Origin/CSRF protection, lock the target workspace and recheck live membership. Reads also enforce current ownership. Optimistic version conflicts require reloading; they do not silently overwrite another edit.

| Method and path                                                                       | Authority and behaviour                                                                                                                                  |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET/PUT /workspaces/{workspace}/website`                                             | Owning Admin only; read or directly save/publish company site content                                                                                    |
| `GET/PUT /workspaces/{workspace}/website/draft`                                       | Owning Admin only; private draft without changing public content                                                                                         |
| `POST /workspaces/{workspace}/website/publish`                                        | Owning Admin only; publish the exact current draft and live-site versions                                                                                |
| `GET/PUT /workspaces/{workspace}/website/profiles/{member}`                           | Own member or owning Admin; members assert their own consent, an Admin cannot set another person's consent true                                          |
| `PUT /workspaces/{workspace}/website/profiles/{member}/grant`                         | Owning Admin grants/revokes staff publication; own Admin authority remains inherent                                                                      |
| `GET/POST /workspaces/{workspace}/website/listings`                                   | Scoped live member; list permitted publications or publish a source property represented by an eligible public profile; staff publish only as themselves |
| `POST /workspaces/{workspace}/website/listings/{id}/withdraw`                         | Authorised representative or owning Admin; exact publication version required                                                                            |
| `GET /workspaces/{workspace}/website/enquiries?page=1`                                | Owning Admin with Clients access; paginated 50-row private company enquiry history                                                                       |
| `GET/PUT /platform/websites/general`                                                  | Live Super Admin; general site content and platform host                                                                                                 |
| `GET/PUT /platform/websites/general/draft`, `POST /platform/websites/general/publish` | Live Super Admin; same draft/version semantics for general site                                                                                          |
| `PUT /platform/websites/companies/{workspace}/eligibility`                            | Live Super Admin; versioned entitlement/licence flags and optional externally verified host                                                              |

The private browser client is `src/services/crm/websites.js`, composed into the existing scoped client. It is ready for CRM settings UI binding; adding a client function does not create a settings screen.

## Content and draft behaviour

Site fields are a name, theme 1–4, active state, public company mark/area/note and selected plain-text CMS fields: tagline, hero title/subtitle, About, services, Contact text and SEO title/description. Unknown fields and HTML are refused. This is a bounded initial CMS, not the planned arbitrary structured-page builder, logo uploader, navigation editor or media library. Hero/About/Contact rendering and page SEO metadata consume the supported published text; consult the frontend for remaining composition fields.

Direct Save & publish writes a new immutable content version. Save draft writes a separate private body; it remains invisible to public reads. Publishing marks that draft inactive and increments its generation instead of deleting it. GET returns the current generation even when `draft` is null. A later editor must use that generation: reusing zero or a pre-publish generation fails rather than allowing an old browser tab to publish somebody else's new draft. Publication also checks the live site version embedded in the draft.

A company Admin initially selects a lowercase slug under the configured platform host. They cannot enter an arbitrary custom host or assert entitlement/licence eligibility. Only the trusted operator eligibility endpoint can install a host after external verification; automated DNS proof, TLS issuance and licence checks are not implemented. Those flags are setup eligibility, not per-content approval.

## Selected property publication

A publisher chooses source record and version, their permitted public representative, destination `general_and_company` or `company_only`, advertising reference, optional factual developer/sale market, 1–20 photos and up to 3 image floor plans. An Admin may publish on behalf of their own eligible member; staff may only use themselves. Both source visibility and live representative permissions must hold.

Records alone projects the public source allowlist: title/description, purpose/type, emirate/community, room/size/price and supported listing facts. It excludes private unit/address/pin, landlord/client identities, notes, finance and raw record payload. Available/Under offer status, valid positive values, readiness, purpose-specific price basis and any recorded permit expiry are checked. Studio is zero bedrooms; commercial and holiday facts remain distinct. An advertising reference is explicitly supplied for publication; no authority verification is implied.

Publication freezes those selected facts. Later ordinary CRM copy/price edits remain private until an explicit republish. Publication and source versions are separate. A normalized, private hashed physical identity (emirate/community/building/unit) coordinates a global advisory lock: at most two current publications within one company and at most two companies on the general site for the same property. Company-only publication requires an active entitled company site; eligible general-site participation can continue without that paid company site.

Media reservation/copy happens outside the final transaction to avoid holding a database connection across storage I/O. Commit reacquires the workspace lock and rechecks source version, permissions, eligibility and capacity before attaching the exact copied bytes and immutable revision. Failed finalisation discards the new copies. Public files are neutral-named processed JPEG/PNG/WebP copies, never an original document or outside-sharing copy. Public PDFs are refused until safe conversion exists; private PDF floor plans still work in the CRM. The connected photo editor allows 20 photos, while the frozen browser demo keeps eight.

Withdrawal, profile consent/grant loss, identity suspension/archive, source reassignment/removal/ineligible status or physical/permit identity changes revoke publication durably. Licence loss revokes all company publications; company-site activation/entitlement loss revokes company-only publications and hides the host. Immutable lifecycle events retain the reason and generation. Restoring eligibility does not automatically republish a withdrawn row or reclaim occupied capacity. Public reads/media also check current eligibility, including date-based expiry, and reject unavailable publications.

## Enquiries and CRM ownership

Anonymous intake validates exact site/host and referenced public company/agent/listing relationships. Company contacts without a listing go to that company's Admin. General-site visitors must select a listing, company or representative; unscoped general-platform contact remains disabled until the owner chooses its recipient. Visitors cannot supply private routing IDs, recipient addresses or assignees.

Under one transaction, intake writes an enquiry, immutable received event and one records-owned Clients lead (`Website`, `New`, marketing permission `Unknown`). The current listing agent receives assignment only if they may hold Clients; otherwise the same company's Admin does. The enquiry saves source host/site version and publication revision. A privacy acknowledgement is not permission for promotional WhatsApp/email.

A site-scoped idempotency key and normalized payload hash ensure identical concurrent/retried submissions return one receipt and create one lead; changed payload with the same key conflicts. The public response contains no CRM IDs. Received means persisted in the CRM, not sent through an external provider. No notification worker/outbox delivery has been added for this flow.

The initial budgets are 60 attempts per client/5 minutes, 100 successful submissions per site/hour, 10 per client/site/15 minutes and 5 per contact/site/hour. Client identity uses the API's configured trusted-client policy. The Next relay intentionally forwards no arbitrary visitor IP headers; until a trusted edge policy exists, relay users share its socket-derived budget. This is conservative local behaviour, not production traffic tuning.

## Running and verifying

Use the existing CRM [backend setup](backend-foundation.md), Docker PostgreSQL/SeaweedFS and trusted local test accounts. Do not apply these migrations to user/development data as part of routine verification. The harness below creates and removes its own synthetic database/storage project.

```bash
# Repository root, with Rust 1.89+ and Node 24 available
npm ci
npm --prefix apps/website ci
API_TEST_FILES=tests/api/website-publication.test.mjs,tests/api/website-enquiries.test.mjs,tests/api/website-lifecycle.test.mjs,tests/api/website-settings.test.mjs npm run test:api
npm --prefix apps/website test
npm --prefix apps/website run typecheck
npm --prefix apps/website run build
# Production Next.js + real disposable API/database/storage browser flow
API_TEST_FILES=tests/api/website-next.test.mjs npm run test:api
```

Install the root Playwright Chromium once, or set `PLAYWRIGHT_BROWSERS_PATH` to its installed location, before the connected browser flow. Website suites are in the default API set; the Next browser integration is explicitly selectable and has its own CI workflow so the normal CRM harness does not require a Next build. A focused CI definition is not evidence a hosted run passed.

For a manually configured local API/site, set server-only `WEBSITE_DATA_MODE=api` and `WEBSITE_API_ORIGIN=http://127.0.0.1:8790` (use the actual API port), then run `apps/website`. Configure the platform/company hosts through authenticated controls and ensure those hostnames resolve locally. Public media is rebased to that fixed API origin, so it must be browser-reachable too. Never point sample fixtures at real clients or infer that the local `.env.example` sample mode sends enquiries.

## Remaining launch work

- CRM Website settings/profile/publication/enquiry management screens and complete content-block editing; current private APIs and browser client do not provide the full UI.
- General-platform unscoped enquiry recipient decision and its queue; provider notifications are a separate integration.
- Actual DNS/SSL/custom-domain proof, hosting, entitlement operations and authoritative licence/advertising permit checks.
- SQL-backed public pagination/projections and load measurements: reads currently scan at most 1,000 active candidate publications and fail closed above that bound; each media access rechecks eligibility. This is not a scaled public catalogue/cache.
- Trusted edge client identity/rate tuning, production storage/scanning/image delivery, cache invalidation/takedown operations, CSP, monitoring, backups and restore rehearsal.
- Final legal copy, canonical domains/per-host sitemaps, accessibility/performance review and launch indexing. Robots currently disallow indexing.
