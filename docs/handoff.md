# Handoff for the next coding agent

**Website content settings implemented locally (2026-10-29):** connected Company settings → Website (`/#/website`) now gives the owning live Admin public identity/setup, four company themes, eight CMS fields, visibility, private Save draft, text-only Review content and direct Save & publish / Publish saved draft. Platform administration → Platform website (`/#/platform-website`) gives the Super Admin separate general-site content controls, independent of the selected company. Draft generations/site versions remain distinct, failed edits stay in the form, stale drafts need explicit recovery, and unsaved navigation is guarded. Services content now renders on the public About page. See [content settings guide](website-content-settings.md). Profiles, property publication selection/withdrawal, enquiry management and trusted eligibility/domain management screens remain the next packets.

Verification: 477 root unit/smoke tests and production build pass; eight new connected Website scenarios plus both existing navigation regressions pass across focused runs. Coverage includes draft/public separation, exact publishing and next generation, recovery/retry, scope denial without forbidden reads, native keyboard themes and 390/1280 light/dark screenshots. The updated real Next.js/API/storage browser flow passes, including published Services on About; 15 website model tests + one consumer integration, Next typecheck/build and all 39 disposable database contracts pass. English catalogue, formatting, boundaries and size baseline pass. Splitting the touched frontend test file preserved all 13 existing scenarios and reduced the strict size backlog from 37 to 36; strict audit still fails on those older files. Source security review found no concrete high/medium auth/privacy issue in this packet. No production/development migrations or deployment for this packet. The owner requested committing and pushing the content settings changes to `feature/connected-crm` on 2026-10-29, following website/backend checkpoint `f8675f9`. Hosted CI results must be checked separately.

**Website backend implemented locally (2026-10-29):** after the initial frontend-only assignment, the owner explicitly authorised Codex to build the backend and continue. Rust `sites`, `publications`, `catalogue` and `enquiries` now implement authenticated site/profile controls, private draft/direct Publish, immutable selected public listing/media versions, host-scoped public discovery and targeted enquiries saved transactionally as CRM leads. The Next.js website consumes the real contract, displays public copies, binds supported hero/About/Contact copy and submits through a same-origin relay without CRM cookies. See [backend setup and limits](website-backend.md), [implemented API contract](website-api-contract.md) and [website run instructions](../apps/website/README.md). Migrations 0081–0086 are for isolated synthetic tests in this packet, not applied to development/user data. No mandatory content approval is restored.

Lifecycle revocation is durable: source/identity/licence changes withdraw public rows and restoring eligibility does not auto-republish them or bypass capacity. Private draft generations also remain monotonic after publication. [Boundary decision W1](service-boundaries.md#website-owner-apis-and-lifecycle-guards-w1-2026-10-29) records the accepted transactional guards and future extraction path. Public files use separate image-only copies; private addresses/units/pins, CRM identity contacts and PDF originals remain private. The connected photo editor now permits 20 photos; the frozen demo remains eight.

**Current packet verification:** 13 focused website API scenarios, all 39 disposable database contracts and 335 Rust unit tests pass. Native website 15 model/shape tests + one public-consumer integration, typecheck/build and existing 471 CRM tests/build/English checks pass. The production Next.js browser flow against disposable API/database/storage passes: public image rendering, enquiry-to-CRM receipt/lead, private draft isolation, published hero/SEO updates and cross-origin rejection. Rust formatting/Clippy, repository formatting and boundary checks pass. The size baseline passes with the same 37 older oversized files; the strict repository size audit still fails on that backlog. No hosted GitHub jobs, deployment or production data verification is implied. Earlier sample-mode browser baseline covered 68 page/layout combinations, gallery focus and sampled contrast; that predates connected verification. External map tiles remain unverified in this environment.

**Remaining website work:** public profile consent/grant screens, listing selection/withdrawal and enquiry management around `src/services/crm/websites.js`, then richer content blocks and launch setup. Company/platform content controls are now implemented in the newer packet above. Generic platform enquiries without a selected listing/company/agent stay disabled pending the owner's recipient choice. DNS/SSL and authoritative licence/permit verification, canonical/sitemaps/indexing, production storage/CSP, trusted-edge client identity and scaling remain incomplete. Public reads currently scan at most 1,000 active candidate publications and fail closed above that bound; Next-relayed intake shares a conservative socket-derived budget. The owner requested committing and pushing this packet to `feature/connected-crm` on 2026-10-29; hosted workflow results must be checked separately. No deployment occurred in this packet. The old `design/website` prototype review controls are historical and must not restore approval.

**Direct website publishing (owner, 2026-10-28):** owner removed the approving step for both website types. [New authoritative decision](product-decisions.md#direct-website-publishing-decided-2026-10-28) supersedes prior mandatory Super Admin content/listing approval. Use Edit → Save draft / Preview → Publish, with scoped publisher permissions, immutable public versions and honest sync status. Preserve privacy, eligibility, listing limits, enquiry ownership and withdrawal/takedown; unrelated finance/marketplace approvals remain. Planning documents are updated; the older prototype review screens still need replacement when implementing this flow. No runtime implementation, commit or push in this decision packet.

**Property community maps (2026-10-28):** owner approved approximate maps on property detail pages on both website types. The shared location section uses community-only map extents without a property pin or private coordinates, clearly labels approximate location, and preserves the listing-specific enquiry for exact-location requests. Live maps require internet; standalone text/contact remain available offline. See [location design](website-location-design.md) and `dist/maps-preview.html`. This remains prototype work; no production API, exact-location publication, commit or push.

**Complete website filters and design review (2026-10-28):** owner requested all-emirate filters on homepage/results, budget ranges, missing filters and a full design review. Prototype searches now share all seven emirates/cascading communities, min/max AED budget, rooms, furnishing, sqft ranges, parking/multiple amenities, category/readiness/sale-market/representatives and holiday capacity/stay. Price sorting requires a purpose; Apply preserves sort, and purpose changes reset incompatible price criteria. General home search is in document flow. Fixed readable chips, Studio/holiday facts, mobile quick contact, enquiry ID ownership, area recovery, inline privacy, disclosure Escape/route focus, pagination and dark error contrast. See [filter design and verification](website-filters-design.md). Exports include `filters-preview.html`; screen index70/company gallery34. All work remains a synthetic design prototype; no production API/Next.js implementation, commit or push in this packet.

**UAE developer discovery (2026-10-28):** owner requested developers such as Emaar/Azizi/Sobha on both general and company websites and a homepage section. The design now includes 40 selected real reference names, dedicated home sections/navigation, paginated searchable directory/profiles, scoped sample counts and Developer property filters/links. Sample property associations are explicitly illustrative; no partnership/real listing is claimed. `developers-preview.html` is a new standalone entry point, and the company visual gallery grows to 31 examples. See [developer design](website-developers-design.md) for source-access limits, checks and future approved-data binding. No production CRM/publication/backend work or push occurred.

**Premium company website refinement (2026-10-28):** owner requested stylish, classic and professional company websites. The prototype now has a dedicated company wordmark/navigation/footer, four distinct architectural hero compositions, selected properties, editorial story, inventory-derived area cards/search choices, named team and enquiry close. Company property/profile/team pages share the styling; About and Contact have dedicated compositions. WhatsApp/Email additions remain intact. `build.mjs` exports `dist/company-preview.html` as well as `review.html`; the toolbar changes company theme without losing route/filter state. See [company website design](company-website-design.md). This is design work, with fictional content and no production Next.js/backend/domain integration.

**Website contact buttons (2026-10-28):** owner requested WhatsApp and Email on property cards/details, properties within company/agent pages, and agent profiles. Shared prototype links use the named listing agent's explicit public contact fields, prefill property context and omit invalid/missing channels; they never infer private account/provider contacts. Fictional reserved numbers and `.example` emails keep the design synthetic. Links open external apps without sending or writing CRM leads. See [website design preview](website-design-preview.md); production approved-contact binding remains part of WEB implementation.

**Complete website design prototype (2026-10-28):** the owner requested all website screens and clarified that companies/agents show **properties and public profiles, not performance statistics**. See [website design preview](website-design-preview.md) and `design/website/README.md`. The isolated portable HTML/CSS/JS prototype has 57 linked page/state examples, four company themes, public properties/profiles/enquiry journeys, grouped company editor and platform review. `node design/website/build.mjs` generates self-contained `design/website/dist/review.html`; `node design/website/serve.mjs` serves it locally on 4178. Production remains planned Next.js; no live CRM/provider/publication/domain work occurred. Local checks cover all 57 links at two widths, 40 extra theme/route combinations, interaction validation, price-basis separation and sampled dark-theme contrast. Existing 471 frontend tests/build and formatting/size baseline pass. The preview document records evidence limits, including blocked direct-file browser access and generated screenshots.

**Website planning final checkpoint (2026-10-28):** the owner accepted lightweight depth for the initial website and requested final updates be pushed. [Product decisions](product-decisions.md#website-scope-structure-and-motion-decided-2026-10-28) records the two-site scope, planned shared Next.js public application, structural redesign direction and static phone/reduced-motion fallback. Full interactive 3D is deferred; do not expose an Enhanced 3D setting in the initial editor. The settings plan, structure blueprint and visual/performance brief are planning artifacts, not implemented website code or measured performance. Domain, pricing, final rendered themes and the other listed open choices still need resolution before their dependent work.

**Website structure correction (2026-10-28):** the owner explicitly wants the website structure improved, not just the screenshot layouts preserved with cosmetic polish. Follow the [structure blueprint](website-structure-blueprint.md): task-led general/company navigation, lean purposeful homepage sequences, search/results/detail/enquiry continuity, four themes with shared behaviour, and six grouped company-settings areas. It supersedes earlier preserve-the-layout recommendations; brand, approval, privacy and performance constraints remain. This is a reviewed structural proposal, not a rendered prototype or website implementation.

**Website settings planning (2026-10-28):** the owner requested a complete plan and clarified **general Blaqks One website + company websites only**, with no standalone individual-agent websites. The [website settings proposal](website-settings-plan.md) maps the implemented CRM foundations to platform/company settings, public profiles, exact-version publication review, safe domains/previews, enquiry ownership, privacy, operations and WEB1–WEB9 delivery. It is planning only, with proposed defaults explicitly marked and open business choices listed. No website code, migration, hosting or public launch was performed. Preserve the existing per-property listing limits and resolve ambiguous shorthand before implementation.

**Website visual references (2026-10-28):** the owner supplied Claude artifact `LW62BWKAfGnnjGaCA5GrJG#page-dcb81aee8d83` and TikTok video `7679640080809479454`, requesting refined premium UI/UX and optional fast 3D. The [visual refinement brief](website-visual-refinement.md) records the full URLs, depth strategy and performance/acceptance budgets. Direct reference fetches were blocked with CONNECT 403, including permission retries. The owner then supplied a Claude canvas overview screenshot, which was inspected for composition; detailed artifact behaviour and the TikTok video remain uninspected. No prototype or website UI was built in this task.

**MK3 implemented locally (2026-10-26):** [Marketplace answers](marketplace-answers.md)
now has server matching and private own-inventory alerts, reviewed property offers with three
active slots, rejection/replacement, participant-only no-match broker conversations, selection
pause/notices, reopening with original expiry and history, and closing paused requests.
Migrations 0078–0079 add offer origin, answers, conversations/messages and generic notices.
They were applied only to disposable test databases, not the development database.
Listing shares keep exact locations, contact details and media sealed from recipients;
generic direct-share routes cannot bypass the marketplace lifecycle. **Next: MK4 accepted
co-broking and private-detail release**, not another redesign packet.

Verification: 468 frontend unit/smoke tests, production build, 323 Rust library tests,
all 39 database-backed contracts, Rust format/Clippy, English catalogue, boundaries and
formatting pass. Across the focused API runs, 42 distinct HTTP scenarios pass, including
existing direct-share/co-broking regressions. Final supplemental tests cover cross-company
capacity races, rejected/replacement offers, board expiry reconciliation and paused closure.
The new complete MK3 browser flow and existing MK2 flow both pass; four screenshots cover
390/1280 in light/dark and representative layouts were inspected. Source security re-review
found no remaining concrete high/medium blocker in the reviewed paths. The full line check
still reports 37 existing oversized files; the baseline passes with none new or growing.
No push or hosted CI was triggered; local commits only as the owner requested.

**Marketplace lifecycle confirmed by owner (2026-10-26):** when the requesting agent
chooses a property to proceed with, pause the request so it accepts no new property offers
or new broker-message initiations. Notify the other participating brokers that the requester
is proceeding with another property, without revealing the client, selected property's
private details or a reason. Selection is not deal completion. If the deal falls through,
the requester may reopen or repost the request and receive offers again. Include this in
MK3/MK4 design and security review, with explicit state transitions, notification recipients,
slot handling and duplicate/retry protection; preserve existing agreement evidence.

**MK3 owner clarification (2026-10-26):** a client request permits at most three active
property offers at a time. A rejected property frees capacity for another offer. A broker
without a matching property may privately message the request poster when the request has
fewer than three active offers, including when nobody has a matching property or rejection
has opened capacity. This is a broker-to-broker conversation, not client contact access.
Carry this into the MK3 design/security review: reconcile active-slot replacement with the
older per-round limits, define qualifying offer states and gate messaging on the server.
Do not claim an exhaustive search of other brokers' private inventory or expose that inventory.

**Owner priority change (2026-10-26):** pause the remaining UI redesign packets and return
to implementing the product roadmap. Retain the completed UI work; UI6 is not the next
active packet. Local commits are permitted; pushes require an explicit owner request.
The next independent feature packet is **MK3, marketplace answers and matching**, following
the built MK1/MK2 foundation. Start with its required bounded design and security review
because answers interact with private listing shares. MK4 choosing/co-broking follows MK3;
MK5 still needs the platform console and legal review. Real SendGrid verification and
WhatsApp remain dependent on owner/provider setup and outstanding decisions.

**UI5 — workflow records (2026-10-26):** explicit presentation configurations now cover
Follow-ups, Viewings, Shortlist, Interaction log and Client care. Phone cards retain their
task dates, state and linked-record context rather than truncating to two facts. Linked
names come only from already scoped records, alongside their IDs. Desktop columns retain
next-action/channel context and expose the existing follow-up/client-care due alerts.
Existing filters, schemas, mutations, assignment authority and deferred Calendar remain unchanged.

Verification: 466 unit/smoke tests, build, formatting, English catalogue, boundaries and
line-size baseline pass (37 existing oversized files remain). Four focused connected browser
scenarios pass: all five workflow layouts at 390/1280 in both themes, Follow-up permissions,
Viewing form/reload/link deletion protection, and Lead defaults. The existing workflow tests
remain intact. Screenshots were generated for all five modules; representative phone-dark
and desktop-light layouts were visually inspected. Full GitHub CI has not run for UI5:
the owner permits local commits but explicitly prohibits pushes. Next packet: UI6 finance.

**UI4b — Properties and matching (2026-10-26):** the connected Properties directory now
uses one count/action heading, a compact purpose/search/filter/view toolbar, initially closed
advanced filters and removable active-filter chips. Card and table views share the filtered,
sorted collection and twelve-record pagination. Property cards lead with resilient media and
price, show a labelled fallback when an image fails, and reflow to one column at 390px.
Client Desk selections expose their selected state, and matching cards show the listing image,
type, bedrooms and area without changing match rules, workspace scope or Shortlist authority.

Verification: 464 unit/smoke tests, production build, English catalogue, boundaries and the
line-size baseline pass. Four focused connected-browser scenarios pass, covering thirteen
properties across both views, pagination continuity, search/filter chips, media failure,
mobile width, scoped Client Desk matches and view-only permissions. The first rerun used an
unsupported comma-separated test selector and found no tests; the corrected focused run passed.

**UI review repairs (2026-10-26):** reviewed the UI1–UI4a changes and restored two
regressions: record cards now expose the desktop sort field/direction on phones,
and Settings navigation retains its distinct profile, team, channel and rule icons.
Mobile sorting shares the existing workspace state, resets pagination and preserves
keyboard order, Escape focus restoration and desktop sort continuity. It changes no
permissions or record data. The new sorting controls use the English catalogue;
the existing mobile first-record layout assertion remains unchanged.

Verification: 464 unit/smoke tests, the production build, formatting, the line-size
baseline and the English catalogue check pass. Six directory/sorting browser
scenarios pass, including pagination reset, desktop resize, focus restoration and
320/390px popup bounds. The three navigation/responsive scenarios also pass.

**CI repair (2026-10-26):** on `feature/connected-crm`, update Vite to 6.4.5 and
both Rust lockfiles to rustls-webpki 0.103.16, Tokio 1.53.3 and webpki-roots
1.0.10. These address the npm audit and RUSTSEC-2026-0381/0382/0386 findings;
the security policy and thresholds are unchanged. Mobile Leads filters now keep
search/reset and assignment controls on compact rows, preserving keyboard order
and the existing 520px first-record assertion. The Leads/Contacts and assignment
keyboard specifications pass (4 tests), as do 463 unit/smoke tests, the production
build, formatting and the shrink-only line baseline. Full API/browser CI remains
the broad validation pass; do not confuse earlier failures with this repair's
GitHub check results.

The npm audit reports zero vulnerabilities; cargo-deny 0.20.2 passes advisories,
licences, bans and sources for both crates against the current RustSec database.
CRM and Calendar Rust tests/Clippy pass. Focused API verification passes 23 HTTP
tests and all 39 database-backed Rust contracts in the disposable Docker project.

**New UI planning request (owner, 2026-10-24):** the owner wants the entire connected UI
organized to a professional standard and the work prepared for DeepSeek. The
[whole-product UI redesign plan](ui-redesign-plan.md) covers navigation, shared patterns,
every screen family, preserved contracts and bounded implementation packets. Give DeepSeek
[UI0: audit and blueprint](deepseek-prompts/UI0-ui-redesign.md) first. This is a prepared
plan, not an implemented or visually approved redesign; review the navigation/Clients
pilot before broad rollout. Keep the current palette and all working features. This
assignment overrides the old blanket Claude-only implementer note for this UI work;
English-only and connected-only decisions remain in force. No provider/domain/publication
work is authorized by this UI request.

Latest checkpoint (2026-10-24): after R1 (`4232ba5`), A3b (`a0b039b`) and the R2/A6/BO1
designs (`8ad0b58`), Claude built **R2a, sharing a listing with an agent at another
company** ([as built](record-sharing.md#r2a-as-built-2026-10-23)), then **co-broking from a
listing share** ([as built](record-sharing.md#co-broking-from-a-share-as-built-2026-10-23)).
Migrations run through **0077** (MK1 adds 0073–0076; MK2 adds 0077). The R2a review follow-ups (L6, L7 as the owner decided,
L8, L10; [record sharing](record-sharing.md#r2a-security-review-2026-10-23)) are built. Lead
referrals (R2b) are dropped (owner, 2026-10-24): only properties are shared with other
companies. A6 is revised (outside agents accept by creating a free basic account) and waits
for BO1. BO1, P1 and the broker marketplace (MK) wait until the owner says. R2a's code
security review is done and its Medium findings fixed (migration 0071, [record
sharing](record-sharing.md#r2a-security-review-2026-10-23)). A3b and the co-broking flow now
have separate specialist code reviews (2026-10-24): their Medium findings were fixed
(consistent payment-read snapshots and mandatory fee collector on every share-bound
revision). Regression tests cover the read interleaving, concurrent opposite-party sends,
unchanged versions on rejected revisions and introduction preservation through amendments.

Updated 2026-10-22, after commit `20955d8` on `feature/connected-crm`. Read this with
`AGENTS.md` (project rules), the [token-efficient delivery protocol](token-efficient-delivery.md)
and [roadmap §15](claude-implementation-roadmap.md#15-remaining-connected-crm-work-outside-the-integrations).
The owner chooses the next packet: nothing in §2 starts until they say so. **Broker
marketplace MK1** (2026-10-24) is assigned to DeepSeek with
[these instructions](deepseek-prompts/MK1-marketplace-entry.md) (migrations 0073–0075); Claude reviewed and fixed it (0076);
Claude reviews it before it is accepted. MK1 is committed (`6609603`). **MK2, client requests
and the board**, is assigned to DeepSeek with [these instructions](deepseek-prompts/MK2-marketplace-requests.md)
(migration 0077); Claude checks and tests it before it is accepted, then applies 0077 to the
development database. **MK2 is built (2026-10-24)**: client requests, the board and My requests
([as built](broker-marketplace.md#18-mk2-as-built-2026-10-24)). DeepSeek built it (`bdc56e5`);
Claude's review fixed seventeen problems and added regression tests, then applied 0077 to the
development database. The Board also lists the caller's own company, marked "Your company" (owner,
2026-10-24).

## 1. Done in this stretch (2026-10-21 to 2026-10-22)

| Area                                | What works now                                                                                                                                                                                         | Commits                                    | Details                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Company email through SendGrid (E3) | Each company connects its own SendGrid account (restricted key, verified domain); every member gets an address on the company domain; sending with delivery statuses; client replies land in the Inbox | `432c70a` … `77dc083`                      | [SendGrid design](sendgrid-design.md) §10–§13, [setup guide](connecting-platforms.md) |
| Archiving a company                 | Archiving an Admin disconnects every company channel in the same transaction                                                                                                                           | `1acdb49`                                  | [SendGrid design](sendgrid-design.md) §10                                             |
| Sending from the Inbox              | Inbox sends from the SendGrid address (not Google); labelled New email; the Admin can give themselves an address; an address never used can be removed                                                 | `705e9ba`, `8528d8d`, `e1f4e01`, `519c1c5` | [SendGrid design](sendgrid-design.md) §13                                             |
| Email attachments (F3)              | Sending photos and PDFs with an email (F3a); keeping the photos and PDFs clients email in, labelled "from outside the company", with daily budgets (F3b)                                               | `ea30219`, `68d9311`, `377a6a2`, `20955d8` | [Media storage](media-storage.md) F3                                                  |
| Conversation layout                 | Messenger-style: the thread fills the screen, one-line message box growing with the text, `+` outside the box, files inside it                                                                         | `f2b3c8e`, `a857aa7`, `d135e2a`, `e112de9` | `src/features/server/composer/`                                                       |

Migrations then ran through `0066` (now `0072`, see the checkpoint above). **Evidence limit:** all of this is proven against the local
SendGrid stand-in only; nothing has been tried with a real SendGrid account yet, and files
from clients are labelled but not virus-scanned.

## 2. Next packets, in the recommended order

### N1 — Real SendGrid check (waits for the owner's domain and SendGrid account)

The owner has no domain or SendGrid account yet (2026-10-22); everything up to the live
check is built and checked.

Proves E3 and F3 with the owner's real account before more is built on them. **Preflight
done (2026-10-22):** the calls were checked against SendGrid's documentation and three
mismatches fixed; [SendGrid design §14](sendgrid-design.md#14-preflight-against-sendgrids-documentation-2026-10-22)
lists what the live check must still prove.

- **Owner first:** steps 1–7 of [Connecting platforms](connecting-platforms.md#email-through-sendgrid-packet-e3)
  (domain, SendGrid account, domain authentication, MX and DMARC records, a Custom Access
  key, two-factor sign-in).
- **Agent:**
  1. In `.env`, remove `CRM_SENDGRID_ENDPOINT` (it points at the stand-in on 8793) so the
     API calls SendGrid itself.
  2. Start a tunnel to the API (port 8788; webhooks are under `/api/integrations/webhooks/`)
     and set `CRM_PUBLIC_URL` to its https address. Restart the API and worker.
  3. The Admin pastes the restricted key on Channels; check the domain shows verified, with
     delivery updates and incoming mail on.
  4. Send from the Inbox to an address the owner controls (never a real client); check the
     status reaches Delivered. Reply from that address with a photo and a PDF; check the
     reply joins the conversation with both files.
  5. Write a dated "Live check" section in [SendGrid design](sendgrid-design.md) with what
     matched and what differed; fix differences as their own small packet. Stop the tunnel
     afterwards and restore the stand-in setting for local work.

### N2 — Inbox time-savers: templates, quick replies, drafts (built 2026-10-22)

Built as [Saved replies and drafts](saved-replies-drafts.md).

Needs nothing from outside. Write a short design first and ask the owner: templates per
company (Admin-managed) and/or per member; placeholders such as the client's name.
Drafts are already planned as `status = draft` messages in
[Messaging design](messaging-design.md) §5; reuse that. A per-member email send limit is
queued in the roadmap and fits here. UI goes through `product_designer`, Messenger style.

### N3 — Move existing inline property photos into storage (built 2026-10-22)

Built as the `media-backfill` command; see [Media storage](media-storage.md) "F2 backfill as built". Run it on real data only after backing up the database and the bucket.

Photos saved before F2 still sit inside record JSON (`{name, src}`). A trusted command that,
per workspace, puts each into media storage and rewrites the entry to `{name, file, thumb}`
in the record's own transaction with its version check; repeatable, with a dry run first;
connected records only, never browser or demo data. Security review first (it rewrites
stored records). Test on the disposable database with synthetic records.

### Also built 2026-10-22

- **Agreements screens:** the Agreements page for the A2 server core; see
  [Agreements design](agreements-design.md) §13.
- **Team chat C3:** private groups (with adding people later) and in-app @mentions; see
  [Team chat](team-chat.md).
- **Agreements A3a:** every deal hand-over inside a company is recorded as an agreement;
  the receiver reviews the full offer before accepting; see
  [Agreements design](agreements-design.md) §14–§16. Next in this line: **A3b** (amend,
  complete, cancel, archive, the certificate and payment tracking between companies).
- **H2** (built 2026-10-22, design §17): a receiver reviews a hand-over (deal and
  property, client details hidden) before accepting or declining; Deals and Agreements
  badges; full hand-overs to the company Admin; an agent may tick Needs approval and choose
  the approver, and the deal moves only after the receiver accepts and the approver
  approves. Migrations 0059 and 0060.
- **H3** (built 2026-10-22, design §18): the client (with its conversations) and the
  listing move with an accepted deal; the sender keeps them view only with a badge; a
  listing other deals use stays and is shared view only; the review shows all listing
  details and photos. Migrations 0061 and 0062; code security and design reviews done.
- **R1** (built 2026-10-23, [Record sharing](record-sharing.md)): the holder or the Admin
  shares one client, property or contact with an assigned-only colleague, who accepts a
  view-only copy (no notes, no messaging) or declines; Copy link and Share on WhatsApp;
  shares end when the record changes holder. Migration 0063.
- **A3b** (built 2026-10-23, [A3b](agreements-a3b.md)): amend, complete, cancel and archive
  agreements between companies, the certificate (print and evidence file) and payment
  records (payer records, payee confirms). Migrations 0064–0066.
- **R2 and A6** are designed and reviewed ([R2/A6 design review](sharing-guest-design-review.md)),
  with the owner's answers in [Product decisions](product-decisions.md). Next: build R2,
  then A6 (live use needs a Blaqks One platform sender). P1 waits until the owner says.

### N4 — WhatsApp against a local Twilio stand-in (queued 2026-10-29)

The owner decided that each member connects their own WhatsApp number, with the owner
keeping their current number (D2 and D3, 2026-10-29), and asked for every social channel to be
built and tested locally against simulated providers first: W1/W2 WhatsApp, then S1 Facebook
and Instagram, then T1 TikTok ([product decisions](product-decisions.md#messaging-design-decided-2026-10-20)).
The build needs no owner setup; the live check needs D6, a Twilio account, approved
templates and coexistence support; see
[Connecting platforms](connecting-platforms.md#whatsapp-through-twilio-w1-w2).

### Smaller follow-ups already recorded

- Virus scanning of files from clients before hosting (F3b review M1).
- Showing the Admin how much mail the budgets dropped (E3c M2); rate limits for the public
  webhook routes at the hosting edge.
- Spam reports and unsubscribes becoming an email opt-out (with the consents table, W1).
- A test for an inbound file whose storage fails (hidden and counted, not yet automated).
- Address changes in Team activity.
- Database access rules (DB1, [plan](database-access.md)): separate owner and app roles,
  evidence tables add-and-read only; queued for the hosting phase (owner, 2026-10-24).
- Agreement screens (product designer, 2026-10-24): the certificate strip uses 24px padding
  against the 16px phone gutter and seems to cover the body; an unticked checkbox looks
  filled in light mode.

## 3. How a packet is run here

1. Take one owner-approved packet. Read its design doc and the code it touches.
2. Anything touching access, storage, sign-in, providers or incoming data gets a written
   design in its feature doc and a **separate security review** (`security_engineer` in
   `.codex/agents/`) before building; write the fixes into the design. Ask the owner only
   real business questions, each with a recommended option, and record the answers in
   [Product decisions](product-decisions.md).
3. Build in small modules: one owning module per table ([Service boundaries](service-boundaries.md)),
   150 lines per file, English text only ([English only](product-decisions.md#english-only-decided-2026-10-22)). UI changes go through
   `product_designer`; conversations keep the Messenger layout.
4. Test with synthetic data on the disposable Docker database. Add every new API suite to
   `scripts/crm-api-test-files*.mjs`.
5. Run a code security review of the diff; fix High and Medium findings; record what was
   accepted.
6. Write "as built" in the feature doc and the status in roadmap §15.
7. Run every check in §4, then commit with a plain-English subject. **Never push: the
   owner pushes.**
8. Apply new migrations to the dev database and restart the dev API and worker, so the
   owner can try the work at once.
9. Report to the owner in simple English: what they can now do, how to try it, and what is
   not done.

Owner preferences: simple English; everything in English, no Arabic or right-to-left work
(2026-10-22); function first, whole-app redesign later; connected
mode only (the demo is frozen); never real client data.

## 4. Running and checking

```sh
npm run db:up && npm run db:migrate   # Docker PostgreSQL and file storage
npm run dev:api                       # API on 127.0.0.1:8788
npm run dev:worker                    # outbox, inbound mail, media sweep
npm run dev:sendgrid                  # SendGrid stand-in on 8793
npm run dev                           # http://localhost:5173

cd services/crm-api && cargo fmt --check && cargo clippy --offline --all-targets -- -D warnings && cargo test --offline
npm test && npm run build && npm run check:lines:ci && npm run check:i18n && npm run check:boundaries
API_TEST_FILES="tests/api/a.test.mjs,tests/api/b.test.mjs" npm run test:api
PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only tests/server-browser/x.spec.js
```

CI runs the full `npm run test:api` and `npm run test:server:e2e`. The test harness uses
ports 8790–8792 and 5175; development uses 8788, 5173 and 8793.

## 5. Pitfalls met in this stretch

- `some-check | tail` hides a failing exit code; two commits once went in with failing
  checks. Read each command's own exit status.
- New index and constraint names must be listed in `scripts/boundaries-*.json`, and string
  arguments that look like table names (such as `crm_message`) trip the boundary check.
- PostgreSQL regular expressions allow repeat counts up to 255 only.
- Renaming a translation key onto an existing one clashes silently; the browser suites
  catch it.
- The outbox gives each provider call 30 seconds; storage reads and the send must fit
  inside it (F3a review M1).
- Inbound files are stored after the commit in a background task; tests wait with
  `filesStored` in `tests/api/sendgrid-inbound-helpers.mjs`.
- Browser suites get flaky when the machine is loaded (other Docker projects); every spec
  passes alone, so retry when the load drops before suspecting the code.
