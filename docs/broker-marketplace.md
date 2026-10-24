# Broker marketplace (MK)

Status: decided by the owner on 2026-10-23 after discussion; queued in
[roadmap §15](claude-implementation-roadmap.md#15-remaining-connected-crm-work-outside-the-integrations);
not built. The summary is in [Product decisions](product-decisions.md) ("Broker
marketplace"). It needs an architecture and security review before MK1, because it is the
first board every company can browse, and a UAE lawyer must review the terms and the
dispute display before launch.

## 1. What it is

A board inside Blaqks One where brokers post what their clients are looking for, and
brokers who have a matching property in their own CRM answer privately. The model is a
crypto peer-to-peer board (such as OKX P2P), adapted to real estate: instead of holding
coins in escrow, Blaqks One holds the **information**. The exact unit and each broker's
phone appear only after both brokers accept a commission split recorded as an agreement.

- **Blaqks One users only:** members of a company, including independent agents. Agents
  outside Blaqks One cannot join.
- **Client requests only.** Property ads were considered and dropped (owner, 2026-10-23):
  listings belong on the general website. The rules agreed for them are kept in §9.
- **No licence** is needed to join or post. A licence number may be added to the profile.

## 2. Joining

A one-time entry before first use:

1. **Profile:** photo, areas covered, property types (residential or commercial, sale or
   rent), years of experience and an optional licence number (shown when given). Members
   have coloured initials today; the photo upload is new and uses private media storage
   (F1).
2. **Commitments**, each answered yes:
   - "I only post requests for real clients I'm working with."
   - "I agree the commission split in Blaqks One before sharing client details."
   - "I pay agreed commissions on time."
   - "I understand Blaqks One can suspend my access after a dispute I lose."
3. **Terms and conditions**, ticked. The accepted terms version and time are recorded; a
   new version must be accepted before the next post.

## 3. Client requests

- **Posted from a client in the poster's CRM**, within normal visibility (staff post only
  for clients assigned to them).
- **Shown:** buy or rent, emirate, areas, property type, bedrooms and budget, plus
  preferences: ready or off-plan, furnishing, cheques, building age (new or off-plan,
  under 5 years, 5–10, over 10) and move-in date. Pre-filled from the client's
  requirements (`records::outside_facts::lead`); preferences the client record lacks are
  stored on the request. The board shows a frozen copy made when the request is posted or
  edited, never a live read of the client record.
- **Never shown:** the client's name (not even a first name), phone or email, or anything
  on R2b's "never sent" list.
- **With every request:** the broker's name, photo, company and stats, linking to their
  profile.
- **Limits:** 5 open requests per agent; one open request per client.
- **Expiry:** 30 days, with a **Renew** button and a reminder a few days before. An
  expired request leaves the board and frees its slot.
- **Board:** browse and filter by buy or rent, emirate, area, property type, bedrooms and
  budget.
- **No answers:** the requester sees "No answers yet" and a hint to widen the request (for
  example nearby areas or a higher budget). Blaqks One never shows how many brokers have a
  matching property, which would reveal other companies' stock.

## 4. Answering and matching

- **An answer is a property from the answering broker's own CRM**, sent only to the
  requester as an [R2a listing share](record-sharing.md#r2a-as-built-2026-10-23): frozen
  snapshot, photos as copies, never the owner's contact, exact location off, recorded as
  proof of introduction.
- **Up to 3 brokers answer per round**, one answer each. A full request leaves the board
  and its match alerts stop.
- **Must match.** The server refuses the answer if any check fails:

| Client request | Broker's property                                                           |
| -------------- | --------------------------------------------------------------------------- |
| Buy or rent    | Sale or rental                                                              |
| Emirate        | Emirate                                                                     |
| Property type  | Property type                                                               |
| Bedrooms       | Bedrooms                                                                    |
| Budget         | Price or yearly rent within the budget, or up to 10% over it, labelled      |
| Areas          | Community is one of them, unless the requester ticked "open to other areas" |
| —              | Listing status is available (not sold or rented)                            |

- **Nice to have:** ready or off-plan, furnishing, cheques, building age and move-in date
  are shown to the requester as a checklist (for example "✓ JVC ✗ 2 cheques (wanted 4)")
  and never block an answer. Building age shows "unknown" until Properties gets a
  completion year (a new column appended at the end of the workbook columns).
- **Not a match:** the requester can reject an answer, which frees its slot at once.
  Blaqks One can see brokers who are rejected repeatedly.
- **Private match alerts:** when a broker creates or updates a property that passes the
  must-match checks for an open request with a free slot, that broker is told. Only their
  own CRM is read.

## 5. Choosing, rounds and closing

- The requester may **choose more than one** answer, with a separate agreement for each
  broker.
- Brokers not chosen get a polite notice ("The broker chose another option") and may
  answer again only with a different property.
- **Still available:** if no answer suits, or a chosen deal falls through, the requester
  reopens the request for 3 new answers. This does not reset the 30-day expiry.
- A request closes when the requester marks it done, or when it expires.

## 6. Commission and contact

- **Choosing an answer starts a co-broking agreement** between the two brokers (the
  Agreements `co_broking` type, through "co-broking from a listing share").
- **After both accept:** the exact unit and both brokers' phone numbers appear, with a
  **Chat on WhatsApp** button. The client's contact stays with their broker, and the
  owner's with the listing broker, unless the brokers share them. In-app chat between
  companies comes later with deal rooms.
- **Talking on WhatsApp is fine**, but disputes are possible only for deals with an
  agreement in Blaqks One. The terms say so plainly.
- **Completion** uses the Agreements completion and payment records (A3b).

## 7. Profiles and stats

Facts only, no star ratings (owner, 2026-10-23): deals completed, completion rate,
response time and commission disputes lost. They appear next to every request and on the
profile. A link to the broker's listings on the general website is added once it exists
(WEB packets). Exact definitions (for example completion rate over the last 12 months)
are settled in the MK4 design.

## 8. Disputes and access

- **No agreement, no dispute:** a dispute can be opened only on a marketplace deal with an
  accepted agreement.
- **Blaqks One decides:** both brokers send evidence and the Blaqks One platform team
  decides (the BO1 console). The other broker never decides.
- **Facts, not judgements:** "Commission disputes lost: 1" and "Marketplace access
  suspended". Never "untrustworthy" or "scammer": a public judgement risks defamation
  claims under UAE law and invites competitors to abuse it.
- **Appeal**, and the record fades after a set period once the commission is paid. The
  period and suspension length are set with the lawyer's review.

## 9. Dropped: property ads (kept for reference)

Agreed before property ads were dropped on 2026-10-23: at most 2 ads per company in total
(an independent agent also 2; to be raised later); the same unit cannot be posted twice by
one company or agent; a company cannot have two ads in the same building; a unit another
company has posted is blocked without saying who; 30 days, renewable.

## 10. Build shape (for the architecture review)

- **A new `marketplace/` module** in `services/crm-api/src` with its own tables, routes
  under `/marketplace/...` and the client `src/services/crm/marketplace.js`
  ([service boundaries](service-boundaries.md): large features are separately owned
  modules).
- It calls `records` for client requirements and property facts, Agreements for listing
  shares and co-broking agreements, and media for photos. It never reads `crm_records`
  and adds no foreign keys into it.
- Matching runs on the server only. Request IDs are not guessable, the board is rate
  limited against scraping, and requests carry no client identity.

## 11. Packets

| Packet | Scope                                                                               | Needs                                |
| ------ | ----------------------------------------------------------------------------------- | ------------------------------------ |
| MK1    | Entry: profile photo, marketplace profile, commitments, versioned terms acceptance  | Architecture and security review     |
| MK2    | Requests: post from a client, limits, expiry, renew, reminders, board and filters   | MK1                                  |
| MK3    | Answers: must-match checks, 3-answer rounds, Not a match, Still available, alerts   | MK2; R2a (built)                     |
| MK4    | Choosing: co-broking agreement, release after acceptance, completion, profile stats | MK3; co-broking from a listing share |
| MK5    | Disputes, appeals and suspension                                                    | MK4; BO1 console; UAE lawyer review  |

## 12. Still open

- ~~Whether a company Admin can switch the marketplace off~~: yes, decided 2026-10-24
  (§13).
- The terms text, the dispute fade period and the suspension length (lawyer review).
- Exact stats definitions (MK4 design).

## 13. Technical design (proposed 2026-10-24, for the architecture and security reviews)

MK1 is designed in full; MK2–MK4 are outlined so the data model fits from the start. Each
later packet gets its own short design before it is built.

### Ownership

- **Module `marketplace/`** in `services/crm-api/src`, owning the PostgreSQL schema
  `marketplace` and the routes under `/api/crm/workspaces/{workspace}/marketplace/...`.
  Frontend: `src/features/server/marketplace/` and the client
  `src/services/crm/marketplace.js`. A new **Marketplace** screen in the navigation.
- It calls `auth` for live membership and names, `workspaces` for company names, `media` for
  the profile photo, `records` (from MK2) for client requirements and property facts, and
  Agreements (from MK3) for listing shares and co-broking. It never reads another module's
  tables, and adds no foreign keys into them (rule 9, decision D6).
- **Who:** any active member of a live company. Never the Super Admin (one identical
  not-found on every route, as in R2). A member's own company is always their session's.

### MK1 tables

- `crm_market_terms` (insert-only): `version` (primary key, for example `2026-10-24.1`),
  `body` (the terms text), `commitments` (the four statements as JSON), `published_at`.
  The newest published row is current. The first version is a **draft marked for UAE lawyer
  review**; launch needs the reviewed text.
- `crm_market_profiles`: `member_id` (primary key), `workspace_id`, `areas` (1–12
  community names, each up to 80 characters), `property_types` (from residential sale,
  residential rent, commercial sale, commercial rent; at least one), `experience_years`
  (0–60), `licence_number` (optional, up to 40), `licence_authority` (RERA, ADREC or other;
  required with a number), `photo_id` (optional media object), `status` (`active`, or
  `suspended` from MK5), `joined_at`, `updated_at`, `version` (optimistic).
- `crm_market_acceptances` (insert-only evidence): `id`, `member_id`, `workspace_id`,
  `terms_version`, `commitments_digest` (SHA-256 of the four statements as accepted),
  `accepted_at`. Joining writes the first; a new terms version needs a new one before the
  member can post or answer (MK2), but they can still read.

### MK1 routes

| Route                                        | What it does                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /marketplace/me`                        | The caller's profile (or `null`), the current terms version and whether they accepted it                                                                                         |
| `GET /marketplace/terms/{version}`           | One terms version's text and commitments                                                                                                                                         |
| `POST /marketplace/join`                     | Profile fields, `commitments: [true, true, true, true]` and `termsVersion`, in one transaction: profile plus acceptance. Refused if already joined or the version is not current |
| `PATCH /marketplace/me`                      | `expectedVersion` plus profile fields                                                                                                                                            |
| `POST /marketplace/terms/accept`             | `termsVersion`: accept a newer version                                                                                                                                           |
| `PUT` / `DELETE /marketplace/me/photo`       | Attach an uploaded image (`mediaId`) as the profile photo, or remove it                                                                                                          |
| `GET /marketplace/profiles/{memberId}`       | Another member's marketplace profile, for members who joined                                                                                                                     |
| `GET /marketplace/profiles/{memberId}/photo` | Their photo, for members who joined                                                                                                                                              |

- **What another member sees:** name, company name, photo, areas, property types, years of
  experience, licence (when given), joined date and, from MK4, the stats. Never email or
  phone: brokers' phones appear only after a co-broking agreement is accepted (MK4).
- **Hidden profiles:** a member who is suspended, archived or has left their company, or
  whose company is suspended or archived, is not shown (checked on every read, as the
  listing-share pause does).
- **The photo:** uploaded through the existing media upload (images only, metadata removed,
  size limits), then attached with owner kind `market_profile`. Served only to members who
  joined, with the media module's safe headers. Removing or replacing it hides the old file.
- **Writes** check CSRF and the caller's live profile after the workspace lock, like every
  other connected write. Activity: "Joined the marketplace", "Accepted the marketplace
  terms {version}", "Updated their marketplace profile" (no field values).

### MK1 screens

- **Not joined:** a short introduction ("Post what your clients are looking for; brokers
  with a matching property answer privately") and **Join the marketplace**: a stepped form
  (profile → commitments → terms), each commitment its own tick, and the terms readable in
  full before accepting.
- **Joined:** the Marketplace screen shows "My marketplace profile" (edit, photo) and, until
  MK2, an empty board ("Client requests arrive with the next update"). A newer terms
  version shows a banner and **Review and accept**.
- **Another broker's profile** opens in a dialog from anywhere their name appears.

### MK2–MK4 outline

- **MK2 requests:** `crm_market_requests` (random ID, company, poster, the source client's
  ID kept on the poster's side only, a frozen copy of the allowed requirements from a new
  `records` function, preferences, state `open`/`full`/`closed`/`expired`, round,
  `expires_at`, version). At most 5 open per member and 1 per client. The board is paged,
  filtered on the server, limited per member against scraping, and never shows the client
  or the source ID. A worker job sends the expiry reminder.
- **MK3 answers:** `crm_market_answers` (request, round, answering company and member, the
  listing share it created, the match checklist, state `waiting`/`chosen`/`not_chosen`/
  `not_a_match`). The request row is locked to count 3 per round; one answer per broker per
  round, never the same property twice. The must-match rules run on the server against the
  property's facts. Sending the answer reuses the listing-share sending path as a function
  (to be split out of the R2a route). Match alerts come from a worker job that checks
  recently changed listings against open requests, so `records` gains no trigger.
- **MK4 choosing:** choosing an answer accepts its listing share for the requester and opens
  "co-broking from a share" (built). When the agreement is accepted, the exact unit and
  both brokers' phones appear. Stats come from Agreements (completed, accepted, response
  times) and disputes from MK5.

### Decided before MK1 (owner, 2026-10-24)

1. **Company switch:** an Admin may turn the marketplace off for their whole company; it is
   on by default. When off, the company's members neither browse nor post, and their open
   requests leave the board. The switch belongs to the marketplace module
   (`crm_market_companies`: company, on or off, who changed it and when).
2. **Draft terms:** the first terms version is a placeholder written by us and marked for
   UAE lawyer review; development and testing use it, launch does not.

## 14. Review amendments (2026-10-24)

The architecture and security reviews of §13 found two High issues and asked for the
changes below. They override §13 where they differ.

### MK1

1. **One gate on every route.** `marketplace::gate` refuses with the one not-found unless
   the caller is not the Super Admin; is an active member of a live company (`active`,
   `owner_active`, same workspace, not archived); the company is not frozen and is not the
   organisation workspace; the company switch is on; **the company may use the marketplace**
   (security High 1, owner decision pending); and, for anything beyond joining, the member
   has joined with the current consent and terms. MK5 adds "not suspended". The same
   condition, written once in SQL, decides which profiles anyone can see, and the MK2 board
   reuses it.
2. **Company switch:** `crm_market_companies` (company, on or off, version, who and when;
   no row means on) with insert-only history; Admin-only `GET`/`PUT /marketplace/company`
   with `expectedVersion`, under the workspace lock. Off hides the company's members and
   requests when read; it does not change their stored state.
3. **Consent and leaving.** Joining also records a separate, versioned **publication
   consent**: "My name, photo, company, areas, experience and licence are shown to members
   of every company on Blaqks One." `POST /marketplace/leave` removes the profile and
   photo at once; acceptances and events stay as evidence; joining again asks for consent
   and the current terms again. A UAE lawyer confirms the legal basis (PDPL, Decree-Law
   45/2021) with the terms.
4. **Terms bound to their text.** `crm_market_terms` gains `digest` (SHA-256 of the body,
   the consent and the canonical commitments), `draft` and a unique `published_at`;
   current is the newest `published_at` up to now, never a sort of the version text.
   Terms are inserted only by migrations. Acceptances store `terms_digest` (foreign key to
   the terms row, same module) with one acceptance per member and version; the client sends
   the version, the digest it showed and one `true` per stored commitment; any mismatch is
   409 `terms_outdated`. `accepted_at` is the database clock. Insert-only and no-truncate
   triggers on terms, acceptances and events. Draft terms are refused when hosted.
5. **Events, not team activity:** an insert-only `crm_market_events` (joined, left, terms
   accepted, profile updated, photo changed, company switched), naming the member and the
   action only. `crm_activity` belongs to records and is not used.
6. **No `status` column.** MK5 suspensions are an insert-only `crm_market_suspensions`
   table (start, end, decision) that the gate reads.
7. **The photo:** JPEG, PNG or WebP only, at most 2 MB and 2048 × 2048 pixels, checked
   before the attach commits (uploads also accept PDFs). Owner kind `market_profile` with
   the member as owner; replacing attaches the new file, removes the old one and updates
   `photo_id` in one transaction. Served as `GET /marketplace/profiles/{memberId}/photo`
   (no media ID in the path) through `media::serve::file` in the profile's own company.
   This is the first original upload served to another company; image uploads already have
   their metadata removed.
8. **Free text cannot carry contacts:** areas are the emirates covered (fixed list) plus up
   to 12 communities (up to 60 characters; letters, digits, spaces and `' - . &`), each
   stored with a normalised key for MK3 matching. The licence number has a format per
   authority. Every text runs the listing-share contact check and refuses links. Company
   names and licences are labelled "declared by the broker, not verified by Blaqks One".
9. **Read limits:** profile and photo reads are limited per member and per company each
   hour (`throttle::consume_window`), against scraping.
10. **Migrations:** 0073 (marketplace eligibility, switch and events), 0074 (terms, acceptances and profiles), both with error codes `P0M…` mapped in `marketplace::errors`, and 0075 (media: the `market_profile` owner kind).
    Update `scripts/boundaries*.json`, the domain map and rule 9 list in
    [service boundaries](service-boundaries.md), and the backend-foundation module map.
    DB1 lists the terms, acceptances and events as add-and-read only.

### MK2–MK4 (for their own designs)

- **MK2:** a new client-requirements allowlist in `records` (the planned
  `outside_facts::lead` went with R2b), with a Rust test that sorts every client field;
  fixed choices only, budget in bands, move-in by month; the source client ID in a
  poster-side table no cross-company response reads; a client-consent tick; paging with no
  totals and per-member and per-company read limits; a request closes when its client
  changes holder or is deleted, or its poster leaves (lazily or by trigger, with a
  decision-log entry). A test scans every response for the client's ID and name. Ask the
  owner whether to build a fixed UAE community list for exact matching.
- **MK3:** listing shares gain `origin` (`direct` or `marketplace`); marketplace shares
  keep the exact location in the snapshot but withhold it and the sender's contact until the
  linked co-broking agreement is accepted, and the generic accept, decline and withdraw
  routes refuse them. An answer's liveness comes from its share through an agreements read
  function (offers lapse after 14 days today; the marketplace offer length is decided in
  MK3). The send path is split into `listings/send.rs` (`prepare` in the caller's
  transaction; `run`, which keeps the copy clean-up, with a callback in the same
  transaction), with every R2a check kept, the recipient taken from the request and exact
  location forced on for the snapshot only. Lock order: caller's workspace, listing,
  request, answer, share, members; never the other company's workspace. The database
  enforces 3 slots per round (slot 1–3, unique per request, round and slot; one per member
  per round; never the same listing twice). Must-match runs on the frozen request in the
  same transaction; "Not a match" ends the share. Rounds and rejections are limited.
- **MK4:** the exact unit and both phones are released only once the agreement is
  accepted, each release an insert-only event; stats filter on the share origin.
- **Reminders and match alerts** are worked out when the member opens the Marketplace (a
  records read within what they may see) and shown as a badge; there is no worker job
  until a separate `notifications` module exists.

## 15. Company eligibility (owner decided 2026-10-24)

The security review's High 1 (a throwaway company could read the marketplace) is answered
by three filters, all needed before a company's members can use the marketplace:

1. **Age:** the company was created at least **7 days** ago.
2. **Real use of the CRM**, counted automatically from the company's own records (Deals and
   Agreements do not count): at least **5 listings** (Properties), **5 clients or leads**
   (Clients), **3 contacts**, **3 follow-ups** and **1 viewing**, and something created or
   changed in those collections in the **last 30 days**.
3. **Blaqks One approval:** when all of the above are met, the company's Admin presses
   **Apply**. The platform team sees the company's name, type and age, who applied and the
   checklist counts, **never its records**, and approves or declines with a reason. A
   declined company may apply again after **3 days**. The platform team can also revoke
   access later (MK5 adds appeals). Phone verification is added once a Blaqks One SMS or
   WhatsApp sender exists.

Until approved, members see the checklist with ticks (the Admin can apply; staff see "Ask
your Admin to apply"), "Waiting for Blaqks One approval", or the decline reason with the
date they can apply again. The approval controls live in the platform account today and
move into the Blaqks One console (BO1) later.

## 16. MK1 as built (2026-10-24)

Migrations **0073–0075**; module `services/crm-api/src/marketplace/`, schema `marketplace`.

- **Eligibility and application.** `records::market_activity::counts` returns five record counts
  and "something changed in 30 days" from the company's own `crm_records` rows; `workspaces`
  supplies the company's age. The Admin applies (`POST …/marketplace/application`, five an hour
  per company); the application stores the checklist. The platform's queue
  (`GET …/super-admin-workspace/marketplace/applications`) shows name, type, age, applicant and
  counts only. `POST …/{company}/marketplace/decision` approves or declines the pending
  application, or revokes an approved company, always with insert-only evidence. A declined
  company may apply again after three days.
- **The company switch.** `PUT …/marketplace/company { enabled, expectedVersion }` under the
  workspace lock; no row means on, and every change writes history and an event.
- **Joining.** The first terms row (`2026-10-24.1`) is a draft for UAE lawyer review; its digest
  is SHA-256 over the canonical `{body, commitments, consent, version}`. `POST …/join` writes
  the profile, one acceptance and the `joined` event in one transaction; a newer version or a
  changed digest answers `terms_outdated`; a draft is refused on a hosted server
  (`secure_cookie`). `PATCH …/me` needs `expectedVersion`; `POST …/terms/accept` records a newer
  version; `POST …/leave` removes the profile and photo while acceptances and events stay.
- **Photo and profiles.** `PUT …/me/photo` attaches an image the caller uploaded (JPEG, PNG or
  WebP, 2 MB at most) under `market_profile`, replacing the old one in the same transaction;
  `GET …/profiles/{memberId}` and `…/photo` run one visibility rule (live member, approved,
  switched-on, unfrozen company, never the organisation workspace) and are limited to 300 an
  hour per member and 1,000 per company. No email or phone is ever returned; company names and
  licences show "Declared by the broker, not verified by Blaqks One".
- **Screens.** Marketplace (checklist, application states, switch, join stepper, my profile,
  preview, leave) and the Super Admin's "Marketplace applications" settings screen; English
  catalogue `marketplace` and `marketplaceJoin`.
- **Tests.** `tests/api/marketplace-{eligibility,guards,join,profiles}.test.mjs` (21),
  `tests/unit/marketplace-model.test.js`, `tests/server-browser/marketplace-apply.spec.js`, and
  Rust tests for the state rules, the 3-day wait, the digest, the profile validation and the
  commitments count.
- **Review and fixes (Claude, 2026-10-24).** DeepSeek built MK1 and stopped before committing,
  with the MK1b server files moved aside; Claude restored them and the hooks, then a code
  security review found no High issues. Its five Medium and the useful Low findings are fixed:
  community names are English letters, digits, spaces and `' - &` only, with no dots and no
  phone number even across names (`marketplace::free_text`); the photo is at most 2048 × 2048
  pixels (`media::dimensions` reads the header) and is renamed "profile-photo"
  (`media::neutral`), so its uploaded name never reaches another company; every join and every
  acceptance of newer terms records the consent (`crm_market_consents`, migration **0076**);
  accepting newer terms needs a joined member and every tick again; the terms digest is
  recomputed from the row on every read; leaving needs a profile; staff see ticks, not counts,
  and cannot use up the Admin's application tries; reads take no workspace lock and a frozen
  company gets the shared not-found; a profile shows only while its owner accepted the
  current terms. Tests: `tests/api/marketplace-review{,-access}.test.mjs`. Not done: a
  licence format per authority (the formats are not known; one format for all).
- **Screens (designer review, 2026-10-24).** The join form's emirate and property-type ticks
  had no labels or styles (wrong text group; the themed field rule sized them as fields) and
  seven classes were unstyled. Fixed: labelled ticks in a grid, the shared form grid and
  review grid, a round photo with an initials fallback, the join card's heading, flat steps
  instead of cards inside a card, scrollable terms that keep their paragraphs, the
  newer-terms banner, Leave on its own row, sized dialogs, one page subtitle and a separate
  navigation icon. The browser test covers the whole journey with screenshots of each step.
- **Not in MK1:** client requests, the board, answers and matching (MK2–MK4), suspensions
  (MK5) and the lawyer-reviewed terms.

## 17. MK2 plan (2026-10-24)

The owner asked for MK2 to be built by DeepSeek and then checked and tested by Claude. The
instructions are in [MK2 prompt](deepseek-prompts/MK2-marketplace-requests.md): migration
**0077** (`crm_market_requests` and the poster-side `crm_market_request_sources`), a
`records::market_requirements` allowlist with a test that sorts every client field, posting
from a client the member holds (or any client for the Admin) with a client-consent tick,
editing, renewing and closing, My requests, and a paged board of other companies' requests
with server filters, no totals and read limits. Answers, matching and alerts stay in MK3.

Defaults proposed by Claude and approved by the owner (2026-10-24):

- Areas stay typed community names, normalised for matching, under the MK1 free-text rules;
  a fixed UAE community list can come later.
- Budgets show as bands (six for buying, six for yearly rent); the exact numbers stay on
  the server for MK3.
- A request whose client changes holder or is deleted is hidden from the board at once and
  closed (`client_changed`) on the poster's next My requests read, so `records` gains no
  trigger; leaving the marketplace closes the member's requests in the same transaction.
- Editing keeps the expiry date; Renew sets 30 days from now and is offered in the last 7
  days or within 30 days after expiry.

MK3 (answers and matching) and MK4 (choosing) change listing shares and agreements, so each
needs its own design and security review before it is handed out; MK5 needs the BO1 console
and a UAE lawyer's review.

## 18. MK2 as built (2026-10-24)

- **Tables (migration 0077).** `marketplace.crm_market_requests` holds the frozen request: purpose,
  emirate slug, up to twelve communities with their matching keys, property type label, bedrooms,
  the budget and its band, ready, furnishing, cheques, building age and a move-in month, the
  client consent time, the expiry, the close time and reason, the round and the version. The
  poster-side `crm_market_request_sources` keeps the client and whether the request holds its
  slot; no cross-company response reads it. The events check gained `request_posted`,
  `request_edited`, `request_renewed` and `request_closed`.
- **One allowlist.** `records::market_requirements` is the only reader of a client's
  requirements: `buy_rent`, `emirate`, `preferred_communities`, `property_type`, `bedrooms`, the
  two budgets and `target_date`. A Rust test sorts every Clients workbook field, so a new column
  fails the build until it is classified. The same module answers which source clients a page of
  posters still holds, in one query.
- **Routes.** `GET /requests/draft`, `POST /requests` (consent tick, five open per member, one per
  client, twenty a day), `GET /requests/mine` (closes `client_changed` on read),
  `PATCH /requests/{id}` (version, expiry kept), `POST /requests/{id}/renew` (30 days from now)
  and `/close` (`done`), and `GET /board` (other companies only, 20 a page, opaque cursor, no
  totals, filters on the server, 120 reads an hour per member and 600 per company). Every route
  runs the MK1 gate and answers the shared not-found to everyone outside.
- **Board privacy.** A card carries the request and the broker (`memberId`, name, company,
  whether a photo exists). It never carries the client, the client's record ID, the exact budget
  or a phone; a test scans the whole response for those.
- **Leaving** closes the member's open requests with `left` in the same transaction as the
  profile.
- **Screens.** The joined member's Marketplace screen has Board and My requests tabs below the
  profile: five wrapping filters, cards in the review grid with the band as a chip, the broker
  opening their profile, and Load more; My requests with Post a request (pick a client, the
  pre-filled form, a review, the consent tick), Edit, Renew in the last week or after expiry,
  Close behind a confirmation, and "No answers yet".
- **Deviations from the packet.** `records::market_requirements` drops community names that look
  like contact details rather than refusing the whole draft. My requests carries the poster's own
  exact budget, because the edit form needs it; the board still never does. My requests rows carry
  their `version` so an edit can repeat it.
