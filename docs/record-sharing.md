# Record sharing (R1 and R2)

Status: R1 designed 2026-10-23 for its security review; R2 follows R1. Owner decisions are
in [Product decisions](product-decisions.md) ("Record sharing (R1)", "Sharing outside
(R2)"). Builds on the view-only keeps of [Agreements design](agreements-design.md) §18.

## R1 — sharing one record with a colleague

### Owner decisions (2026-10-23)

1. A member shares **one record at a time** — a property, a lead (a Clients record) or a
   contact — with **one colleague in the same company**.
2. The colleague **accepts or declines**. Accepting gives a **view-only copy** with a
   badge ("Shared with you by {name} on {date}"), never a move.
3. Sent in the CRM, or by **Copy link** or **Share on WhatsApp** (the phone's own
   WhatsApp, no provider). The link carries only an ID and opens only for that colleague,
   signed in to the same company; everyone else gets "not found". The message never names
   the client or shows a price.
4. The sender can **stop sharing**; the copy disappears.
5. **View only, no messaging**: the colleague reads the record (phone and email included)
   but cannot message the person from the CRM; to work a lead they ask for a hand-over.
6. **Shares end when the record changes holder** (reassignment, hand-over, departure); the
   new holder decides whether to share again.
7. Other companies are R2 (and Agreements).

### Proposed build (for the security review)

- **Owner and table.** The records module (it owns `crm_records`, visibility and keeps).
  New `crm_record_shares`: `id`, `workspace_id`, `record_id` (foreign key to
  `crm_records`, `ON DELETE CASCADE`), `collection` (`Clients`, `Properties`,
  `Contacts`), `from_id`, `to_id`, `status` (`pending`, `accepted`, `declined`,
  `withdrawn`, `stopped`, `ended`), `created_at`, `expires_at` (14 days), `decided_at`,
  `closed_at`; one open (`pending` or `accepted`) share per record and colleague; the
  sender is never the colleague. A guard trigger allows only the steps below and freezes
  identity.
- **The copy.** Accepting writes a keep (`crm_record_keeps`, new reason `colleague`, with
  the `share_id`, no deal reference, kind or share). It reads like every keep: the record
  list (now Clients, Properties and **Contacts**) and the record's photos and floor
  plans, view only, never its children, projections, pickers, recipients, Inbox, writes or
  finance links. Ending a share deletes its keep in the same transaction.
- **Who may share.** A member who sees the record under the strict rule (its holder, team
  scope or the Admin) and holds the collection grant — never from a keep. **Who may
  receive.** An active member of the same company (not the Super Admin) with the
  collection grant who cannot already see the record (not its holder, not team scope, no
  keep of it), and not the sender. Both checked live under the workspace lock.
- **Routes** under `/api/crm/workspaces/{ws}/shares`:
  - `POST /shares {collection, recordId, toId}` → the pending share;
  - `GET /shares` → `{incoming, outgoing}` for the caller (every share of the company for
    the Admin): ID, type, a label (the listing title and community; a person's first name
    and last initial), the other member's name, status, dates — no other record field;
  - `GET /shares/{id}` → the same view, for its colleague, its sender or the Admin only;
    one 404 for everyone else (the link's target);
  - `POST /shares/{id}/accept` and `/decline` (the colleague, while pending and before
    its end); `/withdraw` (the sender, while pending); `/stop` (the sender or the Admin,
    once accepted);
  - `GET /shares/waiting` → pending, unexpired counts for the caller per collection, for
    the sidebar badges.
- **Ending.** A records trigger on a change of `assignee_id` ends every open share of the
  record and deletes its colleague keeps (owner decision 6). Departure ends the shares from
  and to the leaving member. Record deletion cascades. A colleague who loses the grant no
  longer lists the copy; the share is ended when they next act on it.
- **Links.** The screen builds `{origin}/#/shares/{id}`; WhatsApp opens
  `https://wa.me/?text=` with "{sender} shared a property with you in Blaqks One:
  {link}". The share ID is a random UUID; nothing else is in the link.
- **Screens.** The record's details get **Share** (choose a colleague, send, then Copy
  link and Share on WhatsApp) and the list of its shares with Withdraw or Stop sharing.
  Clients, Leads, Properties and Contacts show a "Shared with you" panel with Accept and
  Decline, and their sidebar entries show the pending count. The link route opens the
  offer. Accepted copies carry the "View only" chip and badge from H3.
- **History.** The share rows are the record of who shared what with whom and when; no
  record content is stored in them.

### Owner answers (2026-10-23)

Only the record's **holder or the company Admin** may share it. A copy leaves out **notes**
(and a listing's viewing instructions); the sender can add context in Team chat.

### Security review amendments to R1 (2026-10-23)

A separate security review approved R1 with these changes, which override the proposed
build where they differ.

1. **Sender.** The record's holder (`assignee_id` = caller) or the company Admin only:
   seeing a record (through a held property, team scope or a keep) is not enough — 403
   when the caller sees the record, the usual 404 when not. The Super Admin is shut out of
   every share route (`inbox::access::ensure_member` pattern); writes check Origin and
   CSRF and refuse frozen workspaces.
2. **Receiver.** An active staff member of the company with record scope "assigned" who
   passes `eligibility::can_hold` for the collection, cannot already see the record under
   the strict rule, has no keep of it and is not the sender. Accept re-checks the receiver
   and that the sender still holds the record (or is the Admin); a failed check ends the
   share and answers 409. Every receiver failure, including unknown or other-company IDs,
   answers "This colleague can't receive this record."
3. **The strict rule stays untouched**: predicate, lookups, recipients, link checks,
   targets, projections, deal links and the Inbox. Tests: a kept property never reveals its
   owner contact; a kept contact reveals no properties; a kept client reveals no children
   or deal links; linking a follow-up, viewing, shortlist or log entry to a shared record is
   `link_missing`; writes on a copy are not-found.
4. **Copy content per collection** (`records/share_fields.rs`, applied in `keeps::listed`
   by reason): Properties exactly `listing_fields::shared`; Clients every field except
   notes, `referred_by_client_id`, `record_check`, `duplicate_contact` and the `*_auto`
   fields; Contacts `contact_id`, `full_name`, `contact_type`, `company`, `phone`, `email`,
   `building_project`, `community`, `emirate`, `address`, `map_link`. A Rust test sorts
   every workbook field into shared or withheld, so a new column fails until classified.
   `assignee` stays null.
5. **No messaging on screen either**: copied clients and contacts show no Start message,
   WhatsApp preview or bulk selection, and phone and email are plain text (no tel:,
   mailto: or wa.me links). Pickers and recipients read only the caller's own entries.
6. **One way to end a share.** A records function sets the closing status and `closed_by`;
   the share guard deletes the colleague keep whenever a share leaves `accepted`.
   - **Holder change:** trigger `crm_records_shares_on_holder` (AFTER UPDATE OF
     `assignee_id`, any change including to NULL) ends the record's open shares as
     `ended`, never touching H3 keeps.
   - **Departure and grant loss:** `departure::release` calls
     `records::shares::end_for_member` before `keeps::forget` — on departure the shares
     from and to the member, on `access_removed` the shares they received in the removed
     collections.
   - **H3 clash:** `keeps::insert` first ends any open share of that record to that
     member, and its upsert sets `share_id` to NULL, so a hand-over never fails on a copy.
   - **Lock order:** workspace lock, then the share row `FOR UPDATE`, the record `FOR
SHARE`, member rows `FOR SHARE`.
   - **Expiry:** `expires_at` applies to pending shares only; status `expired`; reads treat
     a pending share past its end as expired and writes mark it so under the lock first.
7. **Link and `GET /shares/{id}`.** A server-made UUID, only in the fragment
   `#/shares/{id}`; after sign-in the app returns only to a route matching that shape.
   Parties: the colleague, the sender, the record's current holder and the Admin; everyone
   else (Super Admin included) gets one identical 404 on every share route. Before
   accepting, the page shows only the type, label, sender, dates and status; a closed
   share shows no label. The WhatsApp text is built from the sender's name, the type word
   and the link only (tested). The Admin may withdraw or stop any share; the current holder
   may stop shares of records they hold.
8. **Table** `crm_record_shares` (migration 0063): `UNIQUE (id, workspace_id, collection)`
   on `crm_records` and a foreign key `(record_id, workspace_id, collection)` to it with
   `ON DELETE CASCADE`; checks on collection, sender ≠ colleague, the seven statuses
   (`pending`, `accepted`, `declined`, `withdrawn`, `stopped`, `ended`, `expired`),
   `expires_at = created_at + 14 days`, `closed_at` null exactly while open; `closed_by`
   (null when the system ended it); a partial unique index on open shares per record and
   colleague; a guard that freezes identity, allows only pending → accepted, declined,
   withdrawn, expired or ended and accepted → stopped or ended, inserts only pending
   shares between workspace members, and refuses deletes except the cascade.
9. **Keeps:** reason `colleague`; `deal_ref` and `kind` nullable; unique `share_id` with a
   foreign key `(share_id, record_id, member_id, other_id)` to the share's `(id,
record_id, to_id, from_id)` `ON DELETE CASCADE`; colleague keeps exactly when
   `share_id` is set, with no deal fields; other keeps keep their deal fields. Colleague
   keeps use a plain insert. `KEPT` includes Contacts for colleague keeps only. The screen's
   badge reader accepts `colleague`.
10. **Boundaries:** all new tables belong to records; departure calls a records function;
    the guard's identity read is a backstop noted with inventory item C2.

### R1 API contract

Under `/api/crm/workspaces/{ws}`:

- Share view: `{id, collection ('Clients'|'Properties'|'Contacts'), label|null, from:
{id, name}, to: {id, name}, status, createdAt, expiresAt|null, decidedAt|null,
closedAt|null, allowed: {accept, decline, withdraw, stop}}`.
- `POST /shares {collection, recordId, toId}` → 201 `{share}`; `GET /shares` →
  `{incoming: [share], outgoing: [share]}` (the Admin's `outgoing` holds every company
  share); `GET /shares?recordId={uuid}` → the shares of one record the caller holds;
  `GET /shares/{id}` → `{share}`; `POST /shares/{id}/accept|decline|withdraw|stop` (no
  body) → `{share}`; `GET /shares/waiting` → `{Clients, Properties, Contacts}`.
- `GET /shares/candidates?collection=…&recordId=…` → `{colleagues: [{id, name}]}`: who
  may receive this record (amendment 2), for the holder or the Admin.
- In the record list, a colleague copy's `kept` badge is `{reason: 'colleague', other:
{id, name}, dealId: null, kind: null, referralShareBp: null, at}`.

### R1 as built (2026-10-23)

- **Migration 0063 (records).** `crm_record_shares` with its guard (identity frozen, the
  allowed steps, pending inserts between live members, direct deletes refused while the
  record-deletion cascade passes — told apart by `pg_trigger_depth()`), the holder-change
  trigger `crm_records_shares_on_holder`, the `crm_records_share_target` key the share's
  foreign key uses, and the keep changes (reason `colleague`, `share_id`, nullable deal
  facts). Decision-log entry D11 in [Service boundaries](service-boundaries.md).
- **Server** (`records/shares/`): `create.rs`, `actions.rs` (accept, decline, withdraw,
  stop), `read.rs` (list, one, waiting), `candidates.rs`, `rules.rs` (sender and
  receiver), `store.rs`, `lifecycle.rs` (system endings), `locks.rs` (member rows last in
  the workspace → share → record → member order), `view.rs`, `access.rs` and `routes.rs`.
  Every share route answers the Super Admin and other companies' members with the
  identical not-found. `records/share_fields.rs` holds the per-collection allowlists, with
  a test that sorts every workbook field; `records/keeps_list.rs` reads keeps by reason.
  Departure calls `end_for_member` before `keeps::forget`; a hand-over ends a colleague's
  share before it locks the listing or writes its own keep.
- **Screens** (`src/features/server/shares/`): the Sharing panel in a record's details
  (holder or Admin: Share, Copy link, Share on WhatsApp, the record's shares with Withdraw
  or Stop sharing), the "Shared with you" panel on Leads, Clients, Properties and Contacts,
  sidebar counts from one `GET /shares/waiting` poll, and the `#/shares/{uuid}` link page
  (the only shape honoured after sign-in). Copies read "View only. Shared with you by
  {name} on {date}." with the chip; contacts copies show on the Contacts page.
- **Tests.** `tests/api/record-sharing-{contract,security,lifecycle,copies}.test.mjs`
  with `record-sharing-helpers.mjs`; Rust tests in `share_fields_tests.rs` and `view.rs`;
  `tests/unit/record-shares.test.js`, `share-badges.test.js` and the colleague cases in
  `kept-records.test.js`; the browser flow `tests/server-browser/record-sharing.spec.js`.
- **Built with help.** Part of the server and the first API suites were written by Codex
  while the specialists were at their usage limit; the primary agent reviewed them against
  the amendments.

- **Code security review (2026-10-23): no High or Medium findings.** Fixed: a repeated
  action on an expired share answers 409 instead of a server error (L1); outsiders get the
  not-found before any query error on the list and candidates routes (L2); the candidates
  list takes the workspace lock before its row locks (L3); the delete guard also refuses
  while the record exists, and record deletion is tested (L5); the offer end is 336 hours,
  whatever the session time zone (L6); `GET /shares` returns the newest 200 (L7); the C2
  inventory names the share guard (L8). Accepted: a colleague who only holds a copy and
  tries to share it gets not-found rather than 403 (safe; L4); the current holder sees
  the closed shares of earlier holders, without labels (L9). Tests in
  `record-sharing-guards.test.mjs`.

## R2 — sharing a listing or a lead with another company

Status: designed 2026-10-23; reviewed with required amendments in
[R2/A6 design review](sharing-guest-design-review.md). The review amendments override this
proposal; owner choices remain pending. Implementation has not started.
It reuses R1's link, WhatsApp, badge and expiry patterns and builds on
[Agreements](agreements-design.md) for everything that crosses companies. Agreements §1's
non-goal "exposing private CRM records across companies" stays: only server-made, frozen
snapshots cross, never a live read of another company's `crm_records`.

### Owner decisions (2026-10-23)

1. A member sends **one record** to **one named agent at another Blaqks One company**.
   Agents outside Blaqks One come later, with the A6 link and one-time code.
2. **A property** is shared on its own: listing details and photos, **never the owner's
   name or phone**; **view only**; **with an end date**; **recorded as proof of
   introduction** (who introduced which listing to whom, and when); it can be turned into
   a **co-broking agreement**.
3. **A lead** goes only as a **referral offer through Agreements**: before acceptance the
   agent sees its requirements and the client's first name and last initial; the
   **contact comes after the agent accepts**.
4. **Contacts are never shared outside the company** (third parties' personal data; share
   the listing instead; to confirm with a UAE lawyer).
5. Sent in the CRM, by **Copy link** or by **Share on WhatsApp**; **the link opens only
   for the named agent**, signed in.

### Proposed build (for the security review)

#### Who owns what

- **Agreements owns R2.** Listing shares are cross-company evidence with the same needs as
  agreements: a recipient found by exact email, two named people in two companies, an
  insert-only evidence trail kept five years, the Super Admin shut out, and (later) A6's
  guest links. One evidence module stays one extraction unit (service boundaries,
  extraction candidate 3). New code goes in `agreements/listings/` and
  `agreements/referrals/`; routes stay under `/agreements/...`; the frontend clients are
  `src/services/crm/agreementListings.js` and `agreementReferrals.js`.
- **Records** owns what reads or writes `crm_records`: the allowlisted listing and lead
  facts (`records::outside_facts`), the new lead an accepted referral creates
  (`records::referrals::receive`), its badge table, and the triggers that end shares when
  a listing or lead changes. Agreements calls these functions; it never names
  `crm_records`.
- **Media** copies photos and floor plans into the snapshot (`media::copies`) and serves
  them after Agreements has checked access.
- **No foreign keys into `crm_records`** (boundary rule 9, decision D6). The sender's
  record ID is kept on sender-side columns, without a key, so evidence survives when the
  listing or lead is deleted; it never appears in a snapshot, a digest or anything the
  other company reads.

#### Listing shares: what is frozen

- **Snapshot.** When a listing is sent, the server freezes it into an insert-only
  snapshot: the outside allowlist below, the photos and floor plans as copies, a reference
  label (`LS-` and eight letters or digits) and a SHA-256 digest over all of it, with each
  file's SHA-256 instead of its bytes. An unchanged listing sent to a second agent reuses
  the same snapshot and its copies (one snapshot per listing and digest).
- **Outside allowlist** (`records::listing_fields::outside`, from the H3 list):
  listing title, sale or rental, emirate, community, building or project, property type,
  bedrooms, bathrooms, size, price or annual rent, price basis, listing status, ready or
  off-plan, furnishing, available from, cheques, deposit, minimum stay, maximum guests,
  parking, amenities, description, key selling points, listing URL, virtual tour URL and
  floor plan URL.
  - **Exact location** (unit reference, address and map link) is sent only when the
    sender switches on "Include exact location" (owner question 1). When it is off, the
    snapshot carries a salted fingerprint of the three values instead, and the salt stays
    with the sender, so the sender can later prove which unit was introduced without
    having shown it.
  - **Never sent:** the property ID, the owner contact (`contact_id`), notes, viewing
    instructions, the photos and documents link, last verified, listing authorisation,
    permit reference and expiry, availability review, permit alert, record check and the
    holder. A Rust test sorts every Properties workbook field into sent, location or never
    sent, so a new column fails the build until it is classified.
- **Free text is sent as written.** The review step flags phone numbers and email
  addresses that it finds in the description, selling points, amenities or note, and asks
  the sender to edit the listing first or confirm.
- **Photos are copies.** A copy belongs to the snapshot, not to the listing, so it
  survives the listing's deletion or later photo changes, and the other company never
  reads the listing's own files. Copies are made before the database transaction:
  1. the server reads the listing and builds the snapshot; if a snapshot with that digest
     already exists, nothing is copied;
  2. otherwise each file is copied in storage to a new key (an S3 server-side copy) and
     recorded as an unattached `copy` row in the sender's company;
  3. inside the transaction, the server re-reads the listing under lock and rebuilds the
     digest. If it still matches, it attaches the copies to the new snapshot; if not, it
     answers 409 "This listing just changed. Review it again." Unattached copies are
     removed by the existing 24-hour sweep of unattached files.

  Copies count against the sender company's storage cap but not the member's upload
  limits. At most 40 photos and 10 floor plans go into one snapshot.

- **What you reviewed is what is sent.** `POST …/listing-shares/preview` returns the exact
  views (before and after acceptance) and their `previewDigest`; sending repeats it and
  gets the same 409 if the snapshot has changed since.

#### Listing shares: sending, deciding and ending

- **Sender.** The listing's holder or the company Admin, with the Properties grant (R1
  amendment 1: 403 when the caller sees the listing but neither holds it nor is the Admin,
  the usual 404 when not). Never from a keep or a copy. Frozen workspaces cannot send.
- **Recipient.** Found with the existing `POST /agreements/recipients` (exact sign-in
  email; an active member of another live company; never the Super Admin; one identical
  not-found for every other address). R2 adds the rate limit that Agreements is still
  missing (proposed: 20 lookups an hour per member) because more people will use the
  lookup. One open share per listing and agent; any number of agents per listing; at most
  100 listing shares per member per day.
- **Steps.** `pending` → `accepted`, `declined`, `withdrawn` (sender), `expired` (the
  offer ends after 14 days unanswered, as in R1) or `ended`; `accepted` → `stopped`
  (sender) or `ended`. Every step writes one insert-only event. A decline may carry the
  reason "I already know this listing", because that matters as proof. The first time the
  agent opens a share, the server records `opened` once, as evidence of receipt.
- **End date.** The sender picks the last day the agent may view the listing (a Dubai
  day, 23:59:59 Dubai time; default 30 days, at most 90; owner question 2) and may extend
  it, never beyond 90 days from the day of the extension. Past that day the share reads
  as `ended` (reason `end_date`), and the next write marks it so under the lock, with the
  event's time set to the end date itself, so the evidence shows the true end.
- **Accepting is acknowledging.** Accept says: "Accepting records that {company}
  introduced this listing to you on {date}." The acceptance stores the share digest
  (share ID, snapshot digest, both people and companies, when sent, the end date and the
  note), as the acceptance of an agreement does.
- **What the agent sees.**
  - Before accepting: the twelve basic facts (`listing_fields::BASIC`), with no photos;
    the sender's name and company; the note; the offer end and the view end.
  - After accepting, until the end: the whole outside allowlist, the photos and floor
    plans, the chip "View only" and the badge "Shared by {name}, {company} on {date} ·
    until {date}". The sender's work phone and email are shown too (owner question 3),
    because there is no chat between companies until A5.
  - After the end: the reference, the label (listing title and community), the people,
    the dates and the history, but no listing facts and no photos.
  - Never: edit, delete, assign, messaging, shortlists, viewings, pickers, exports,
    dashboards or deal links. A shared listing is not a `crm_records` row in the agent's
    company, so it cannot reach any of these.
- **Who reads it.** The two named people, the sender company's Admin (everything, plus
  Withdraw, Stop sharing and Extend) and the receiving company's Admin (the introduction
  record only: the row, the twelve facts, the dates and the evidence, never the full
  listing or photos; never accept or decline for the agent, as Agreements §9 says). Anyone
  else, including the Super Admin and other members of either company, gets one identical
  not-found on every route, the files route included.
- **What ends a share.** Shares that are already closed stay as they are. Pending and
  accepted shares end as follows:

  | Event                                                  | Open shares become         | Done by                                                                       |
  | ------------------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------- |
  | The sender presses Stop sharing (or Withdraw)          | `stopped` (`withdrawn`)    | The sender or the sender company's Admin                                      |
  | The listing changes holder (any writer, the queue too) | `ended`, `holder_changed`  | A records trigger (R1 decision 6); the new holder may share again             |
  | The listing becomes Sold, Rented or Withdrawn          | `ended`, `listing_closed`  | A records trigger; the agent reads "This listing is no longer available."     |
  | The listing is deleted                                 | `ended`, `listing_removed` | A records trigger; the snapshot, copies and history stay                      |
  | The sender or the agent leaves their company           | `ended`, `member_left`     | `assignments::departure::release` calls `agreements::outside::end_for_member` |
  | Either company is archived or frozen                   | `ended`, `company_closed`  | The team archive calls `agreements::outside::end_for_company`                 |
  | The end date passes                                    | `ended`, `end_date`        | Read as ended; marked on the next write                                       |

- **Turning it into co-broking.** While a share is accepted and open, either named person
  may press **Propose co-broking**. `POST …/listing-shares/{id}/co-broking` creates a
  `co_broking` draft with the proposer as sender and the other person as recipient. Its
  property subject is built by the server from the snapshot (the agreements §6 facts, with
  `listingRef` set to the share's reference), and the terms add
  `introduction: {reference, snapshotDigest, sharedAt, acceptedAt}`, so the agreement's
  digest is bound to the introduction. The proposer completes the money terms (and A3b's
  `collectingParty`) in the usual Agreements form. Only one live (draft, sent or accepted)
  co-broking agreement per share. The share keeps its own end date.

#### Lead referrals

- **Offer.** From a lead's details, its holder or the Admin presses **Refer to another
  company**. The server builds the terms itself (as A3a does for hand-overs), so the
  sender types only the share, the referral period, the offer end and a note: kind
  `handover_referral`, new origin `lead_referral`, created straight in `sent`.
  - `subject.client` holds `displayName` (first name and last initial, through
    `handover_terms::display_name`), `contact: null`, `requirements` and
    `contactDigests`.
  - `requirements` come from `records::outside_facts::lead`: buy or rent, client type,
    emirate, preferred communities, property type, bedrooms, minimum and maximum budget,
    payment method, finance type, mortgage stage, funds confirmed, decision maker,
    purpose, target date, urgency, must-have criteria and preferred language. Never sent:
    notes, source, stage, priority, score, campaign, objection, the lost and re-engage
    fields, the referrer, the checks and the client ID (a Rust test sorts every Clients
    field into requirements, contact or never sent).
  - `money` has `basis: 'share_of_commission'`, `amountFils: null`, `senderShareBp`,
    `recipientShareBp` and `paymentExpectation: 'on_receipt'`. The share is capped by the
    sending company's referral limit (A3 owner decision 2, refused while it is 0%).
  - `referralPeriodMonths` (owner question 5) sets how long the share applies to deals
    the receiving company closes with this client.
- **Consent.** The sender must tick "{client} agreed to be introduced to {company}". The
  tick is recorded in the terms as `consent: 'confirmed_by_sender'`. A lead whose Contact
  permission is "No" is refused: "This client hasn't agreed to be contacted." (Owner
  question 4; the wording goes to the UAE lawyer with the contacts question.)
- **The contact is held, not sent.** The client's full name, phone, email, preferred
  language and preferred channel go into `agreements.crm_lead_referrals`, never into the
  revision terms, events, list summaries, the waiting count or the certificate.
  - The terms carry salted SHA-256 fingerprints of the normalised phone (E.164) and the
    lowercased email. The salt lives in the referral row, is shown to the sender's side
    and, after acceptance, to the agent's side, and is never shown to anyone before then
    (a phone number without its salt could be guessed from the fingerprint).
  - The contact is held only while the offer is open. If the offer is declined, revoked,
    expires or is closed by the system, the contact is erased but the salt and the
    fingerprints stay. A sender whose referral was declined can still prove later which
    client they introduced.
- **Accept.** Only the named agent accepts, and they need the Clients grant in their own
  company (409 "You need the Clients module to accept a lead referral. Ask your Admin.").
  In one transaction, under the agent's workspace lock:
  1. the acceptance and its digest are recorded (as in A2);
  2. `records::referrals::receive` creates a new lead in the agent's company, held by the
     agent: the requirements and contact, lead source "Referral", stage "New", through the
     normal Clients validation and the redacted `created` activity (owner question 6);
  3. a `crm_record_referrals` row gives that lead the badge "Referred by {company} on
     {date} · referral {share}%";
  4. the held contact is erased from Agreements, so the contact then lives only in the two
     companies' own records.

  The agreement links the agent's side to the new lead. The sender's lead does not
  change; the sender's details show "Referred to {name}, {company} on {date} · {share}% ·
  {status}".

- **Counter-offer, amendment and payment.** The agent may counter the share and the
  period only; the server copies the subject from the earlier revision. When the receiving
  company closes a deal with the client, either side proposes an A3b amendment that states
  the commission (`amountFils`). Once it is accepted, A3b's payment entries apply (the
  agent's side records what it paid, the sender's side confirms it). There are no payment
  entries while `amountFils` is null. **R2's lead referrals are built after A3b.**
- **Ending.** A pending referral is revoked by the system (no actor, no party; its contact
  erased) when the lead changes holder or is deleted (the same records trigger), when the
  sender or the agent leaves their company, or when either company is archived. An
  accepted referral is never ended by these events: it is a company agreement (A3 owner
  decision 6: nobody takes over the side of someone who has left). Only one pending
  referral per lead at a time, checked under the sender's workspace lock.

#### Links, WhatsApp and badges

- **Links.** A listing share links to `{origin}/#/listing-shares/{uuid}`; a referral links
  to `{origin}/#/agreements/{uuid}`. The ID is a random UUID made by the server and is the
  only thing in the fragment. After sign-in, the app returns only to a route that matches
  one of these two shapes or R1's `#/shares/{uuid}`.
- **WhatsApp.** `https://wa.me/?text=` with "{sender} shared a property with you in
  Blaqks One: {link}" or "{sender} sent you a client referral in Blaqks One: {link}". The
  text is built from the sender's name, the type word and the link only: no listing title,
  price, area or client name (tested).
- **Badges.** `GET /agreements/waiting` returns `{answer, listings}`: `answer` now also
  counts lead referrals waiting for the caller, and `listings` counts pending, unexpired
  listing shares to the caller. The Agreements sidebar entry shows their sum, refreshed
  every 15 seconds like the other badges.

#### Lock order

The caller's workspace lock, then the share or agreement row `FOR UPDATE`, then (when
sending) the listing or lead `FOR SHARE` and the agent's member row `FOR SHARE`. Commands
on the agent's side never lock or read the sender's records or members, because the
share's status is kept up to date by the sender side's triggers and functions. So the
sender's holder change (sender workspace lock, record row, share rows) and the agent's
accept (agent workspace lock, share row) cannot deadlock. If both happen at once, the share
ends straight after the acceptance.

#### Evidence and retention

- `GET …/listing-shares/{id}/evidence` (and A3b's certificate for referrals): a
  deterministic JSON file (`attachment`, `nosniff`, `no-store`) plus a printable page.
  - The sender's side gets the full snapshot, each file's fingerprint, the location salt,
    the share digest and the history.
  - The agent's side gets the twelve facts, the snapshot and share digests and the
    history: enough to prove what they acknowledged, while the full content stays with
    the side that owns the listing.
  - The file explains how to recompute each digest.
- Snapshots, shares, events and referral rows are kept **five years after the share or
  offer closes**, or after an accepted referral completes or is cancelled. This covers
  every sent offer, including declined ones, because a declined introduction is proof
  too. They are then removed by the retention job (not yet built) with an audit event.
- Photo copies are removed 90 days after the last share of their snapshot closes, while
  the facts and the fingerprints stay for five years (owner question 7).
- The sample data command creates no outside shares or referrals. Clearing sample data
  deletes records, which ends shares through the triggers; it never deletes evidence.

#### API contract

All paths are under `/api/crm/workspaces/{ws}/agreements`. Every write checks the Origin
header and CSRF, takes `expectedVersion` where a row has one, and refuses frozen
workspaces. Every route refuses the Super Admin (`access::ensure_reader`).

- **Listing share view:**

  ```text
  {id, reference, label, side ('sender'|'recipient'),
   from: {id, name, company, phone|null, email|null}, to: {id, name, company},
   status, endReason|null, createdAt, offerEndsAt|null, viewEndsAt, decidedAt|null,
   openedAt|null, closedAt|null, note|null, exactLocation,
   listing: {…}|null, photos: [{name, file, thumb|null}], floorPlans: [{name, file}],
   recordId|null, agreementId|null,
   allowed: {accept, decline, withdraw, stop, extend, coBroking, evidence}}
  ```

  `listing` holds the twelve facts before acceptance, the whole allowlist while accepted
  and open, and `null` on the agent's side once closed. `recordId` is the sender's own
  listing and goes to the sender's company only.

- `POST /listing-shares/preview {recordId, exactLocation}` →
  `{before, after, files, warnings, previewDigest}`.
- `POST /listing-shares` with `{recordId, recipientWorkspaceId, recipientMemberId}` and
  `{viewEndsOn, exactLocation, note|null, previewDigest}` in one body → 201 `{share}`.
- `GET /listing-shares?side=incoming|sent` → the newest 200; the Admin's `sent` holds the
  company's, and the Admin's `incoming` holds the introduction records of shares sent to
  the company. `GET /listing-shares?recordId={uuid}` → the shares of one listing, for its
  holder or the Admin.
- `GET /listing-shares/{id}` → `{share}`, the link's target; this is where `opened` is
  recorded.
- `GET /listing-shares/{id}/files/{file}` → a photo or floor plan, only while the share
  is accepted and open (agent) or retained (sender's side), and only a file the snapshot
  names. The file is looked up by the snapshot's own company and ID, never by the path's
  workspace.
- `POST /listing-shares/{id}/accept|decline {alreadyKnown?}|withdraw|stop` and
  `/extend {viewEndsOn}` → `{share}`. `POST /listing-shares/{id}/co-broking` → 201
  `{agreement}` (a draft). `GET /listing-shares/{id}/evidence` → the evidence file.
- `POST /referrals/preview {recordId}` →
  `{before, afterAccepting, warnings, previewDigest}`.
- `POST /referrals` with `{recordId, recipientWorkspaceId, recipientMemberId}` and
  `{referralShareBp, referralPeriodMonths, expiresAt|null, note|null}` and
  `{consentConfirmed: true, previewDigest}` in one body → 201 `{agreement}`.
- `GET /referrals?recordId={uuid}` → the referrals of one lead (sender's side only).
- Referrals are then read and acted on through the existing agreement routes. Accept
  returns `referral: {leadId}` to the agent. A detail read adds `referral` with
  `{requirements, periodMonths, consent, contactDigests, salt|null, leadId|null}`, where
  `salt` and `leadId` follow the rules above.
- `GET /agreements/waiting` → `{answer, listings}`.

#### Tables and migrations (0067–0069 reserved for R2)

- **0067 — agreements:**
  - `agreements.crm_listing_snapshots` (insert-only). Columns: `id`, `workspace_id` (the
    sender's company), `source_record_id` (no foreign key), `reference` (unique),
    `facts` (an object, at most 32 KB), `media` (at most 50 entries of
    `{name, kind, file, thumb, sha256}`), `exact_location`, `location_digest` and
    `location_salt` (both
    present exactly when the exact location is off), `digest`, `scheme`, `created_by`,
    `created_at`. `UNIQUE (workspace_id, source_record_id, digest)`. Updates are refused,
    and deletes are refused outside the retention job.
  - `agreements.crm_listing_shares`. Columns: `id`, `snapshot_id` (references snapshots),
    `workspace_id`, `source_record_id`, `from_id`, `recipient_workspace_id`, `to_id`,
    `status` (the seven R1 statuses), `end_reason` (`holder_changed`, `listing_closed`,
    `listing_removed`, `member_left`, `company_closed`, `end_date`; present exactly when
    `ended`), `note` (at most 500 characters), `decline_known`, `created_at`,
    `offer_ends_at = created_at + 336 hours`, `view_ends_at` (after `created_at`),
    `decided_at`, `closed_at` (null exactly while open), `closed_by`, `accepted_digest`
    (present exactly once accepted), `version`.
    - Checks: the sender's and the agent's companies differ, and so do `from_id` and
      `to_id`.
    - A partial unique index allows one open share per
      `(workspace_id, source_record_id, to_id)`.
    - A guard freezes identity and allows only the steps above, plus accepted → accepted
      to move `view_ends_at` forward (at most 90 days from the change). Inserts are only
      `pending`, the snapshot must belong to the same company and listing, and both people
      must be live members of two different live companies (a backstop that reads
      `crm_user_profiles`, inventory C2). Deletes are refused.
  - `agreements.crm_listing_share_events` (insert-only): `share_id`, `action` (`sent`,
    `opened`, `accepted`, `declined`, `withdrawn`, `stopped`, `extended`, `expired`,
    `ended`, `converted`), `actor_id` (null for the system), `side`, `reason`,
    `ends_at`, `created_at = clock_timestamp()`. Only one `opened` and one `accepted`
    per share.
  - `crm_agreements`: `origin` adds `lead_referral`; a new frozen `listing_share_id`
    (references `crm_listing_shares`) allows one live co-broking agreement per share
    through a partial unique index. The version guard is replaced to freeze the new
    column.
  - `agreements.crm_lead_referrals`. Columns: `agreement_id` (primary key, references the
    agreement), `workspace_id`, `source_record_id` (no foreign key), the held
    `full_name`, `phone`, `email`, `preferred_language` and `preferred_channel`, `salt`,
    `released_at`, `erased_at`, `received_record_id` (the agent's new lead; no foreign
    key). A guard keeps the salt and identity frozen, lets the contact columns change
    only to null (when `erased_at` is set, at release or close), and sets `released_at`
    once, only with an acceptance.
  - Function `agreements.crm_outside_source_closed(workspace, record, reason)`. For a
    listing it ends the open shares; for a lead it revokes its pending referral (state
    `revoked`, one event with no actor, contact erased).
- **0068 — media:** `owner_kind` adds `listing_snapshot`; `origin` adds `copy`, with
  `copied_from` (the source file's ID) present exactly for copies. Copies are left out of
  the member budgets (which count `upload` only) and counted in the company cap. A new
  `media::copies` provides stage (an S3 copy and an unattached row) and attach (copies
  only, never uploads); `owned::attach` stays uploads-only.
- **0069 — records:**
  - `crm_record_referrals`: `record_id` (primary key, references `crm_records` with
    `ON DELETE CASCADE`), `workspace_id`, `agreement_id` (no foreign key, D6), and the
    frozen `from_company`, `from_name`, `share_bp` and `created_at`, for the badge.
  - Triggers `crm_records_outside_on_holder` (`AFTER UPDATE OF assignee_id`, any change,
    Properties and Clients), `crm_records_outside_on_status` (`AFTER UPDATE OF payload`,
    Properties, when `listing_status` changes to Sold, Rented or Withdrawn) and
    `crm_records_outside_on_delete` (`AFTER DELETE`, Properties and Clients), each
    calling `agreements.crm_outside_source_closed`.
- **Boundaries.** One new decision-log entry, **D12**: records triggers call an
  agreements function.
  - Reason: every writer that changes a holder or a listing is covered (R1 found a
    trigger to be the only complete way), and the end times in the evidence are exact.
  - Alternative considered: a live check of the sender's record when the agent reads,
    rejected because it is a cross-company read of private rows, gives inexact end times
    and needs a lookup per row for lists and badges.
  - Removal path: records writes "listing closed" and "holder changed" events to the
    outbox, and agreements consumes them, when the two modules are split.

  Also: the domain map rows (agreements: the four tables; records:
  `crm_record_referrals`; media: the new owner kind), owners in `scripts/boundaries.json`,
  and the share guard's identity read added to C2.

#### Screens (English catalogue only)

- **The listing's details → Sharing panel** gets an "Other companies" part.
  - Share with another company: find the agent by exact email → end date, Include exact
    location (off) and note → Review (the server preview, showing what the agent sees
    before and after accepting, the photo count and the free-text warnings) → Send → Copy
    link and Share on WhatsApp (R1's sent dialog).
  - The list of the listing's outside shares, with status, Withdraw, Stop sharing,
    Extend and Evidence.
- **The lead's details → Refer to another company:** find the agent → share (with the
  company limit shown, and the A3 message at 0%), referral period, offer end, the consent
  tick and note → Review → Send → Copy link and WhatsApp. The lead's referrals are listed
  with their status and open in Agreements.
- **Agreements → new "Listings" tab** (Incoming and Sent, twelve per page). Rows show the
  reference, the label, "From {name} · {company}" or "To …", the status and the dates,
  with Accept and Decline while pending. The share page (also the link target) shows the
  facts before accepting; after accepting it shows the full listing, the photos and floor
  plans, the chip and the badge, Propose co-broking and Evidence. This is the only home of
  outside listings: they never enter the agent's Properties list, pickers or exports.
- **Agreements list and detail:** a "Lead referral" label; the requirements, share and
  period; after acceptance, "The client is now in your Leads" with a link. The agent's
  new lead shows the referral badge.
- Empty, loading and failed states, confirmation before Send, Accept, Decline, Stop and
  Withdraw, and the "View only" chip from H3; light and dark themes; phone width first.

#### Tests

- **Rust:**
  - the outside listing and lead allowlist sorts (every workbook field classified);
  - snapshot digest determinism and reuse;
  - the location and contact fingerprints recompute from the salt;
  - `display_name`;
  - the steps the guards allow.
- **API** (`tests/api/outside-sharing-{contract,security,lifecycle,files,referrals,guards}.test.mjs`
  with two seeded companies):
  - only the holder or the Admin sends (403 or 404 as in R1);
  - a recipient in the same company, an inactive member or the Super Admin is refused;
    the lookup rate limit holds;
  - every other member of either company, and the Super Admin, gets the identical
    not-found on every route, including the files route;
  - the receiving Admin reads the introduction record but cannot accept and never sees
    the full listing;
  - no response ever carries the owner contact, notes, viewing instructions, the
    documents link, permits, the property ID, or the location while it is off;
  - the agent sees the twelve facts before accepting and no listing facts after the end;
  - files are served only while accepted and open, and only files the snapshot names, by
    the snapshot's own company;
  - the copies survive the listing's deletion and photo changes;
  - the previewDigest returns 409 when the listing changes;
  - every ending in the table above, with its reason and event time;
  - the end-date limits and extensions; offer expiry; one open share per listing and
    agent; the `opened` event recorded once;
  - co-broking: one live agreement per share, and its digest includes the introduction;
  - referrals: the consent tick is required; Contact permission "No" is refused; the
    0% limit is refused; the contact never appears before acceptance (detail, lists,
    events, waiting, certificate); accept creates the agent's lead with its badge and
    erases the held contact; the Clients grant is required; decline, expiry, revocation,
    a holder change, deletion and departure erase the contact and keep the salt; a
    counter-offer changes only the share and the period; the amount is set by an A3b
    amendment;
  - the database guards: insert-only rows, the allowed steps, the cross-company insert
    backstop, deletes refused, the contact only erased, released once.
- **Unit:** the allowed-action models, link parsing (only the three exact shapes) and the
  WhatsApp text (no title, price, area or client).
- **Browser:** `tests/server-browser/outside-sharing.spec.js`, with two companies:
  - share a listing, accept it through the link, see the photos, propose co-broking;
  - refer a lead, accept it, and see the new lead with its badge.

#### For the security review

1. The records → agreements triggers (proposed D12): revocation and the source mutation
   commit atomically. If revocation fails, the source mutation rolls back; never swallow
   the error and leave outside access live. Keep the triggers bounded and database-only,
   preserve the lock order, and test every holder writer (assignments, departure,
   hand-overs, H3, sample clearing), including an injected revocation failure.
2. Serving another company's file copies: access first, a lookup by the snapshot's
   company, and only named files.
3. The exact-email lookup is a cross-company directory (it confirms a name and a
   company); it needs its rate limit before R2 opens it to more people.
4. Free text (description, selling points, amenities, notes) can carry an owner's or a
   client's contact: the preview warns, but the text is sent as written.
5. The held lead contact: never in terms, events, lists or the certificate before
   acceptance; erased at every close; the salt kept secret until acceptance.
6. Accept writes a `crm_records` row in the agent's company from another company's data:
   normal validation, redacted activity, no record IDs from the other company.

### Open owner questions (R2)

1. **Exact location.** Should the unit number, address and map pin go to the other
   agent before there is a co-broking agreement? _Recommended:_ off by default; the
   sender may switch it on per share; a salted fingerprint proves the unit either way.
2. **End date.** _Recommended:_ 30 days by default, 90 at most, and the sender may extend
   it (each extension at most 90 days from that day).
3. **The sender's contact.** Should the other agent see the sender's work phone and
   email on the shared listing? _Recommended:_ yes, until chat between companies (A5)
   exists.
4. **The client's consent to a referral.** _Recommended:_ the sender must tick that the
   client agreed to be introduced to that company; a lead whose Contact permission is
   "No" cannot be referred. A UAE lawyer confirms the wording, with the contacts
   question.
5. **Referral period.** For how long does the referral share apply to deals with that
   client? _Recommended:_ 12 months from acceptance; the sender may choose 1 to 24.
6. **The referred lead.** Should an accepted referral appear in the agent's Leads by
   itself? _Recommended:_ yes, as a new lead held by the agent with a "Referred by
   {company}" badge; the sender's own lead stays unchanged. (If not, the contact has to
   stay readable on the agreement for its five years.)
7. **Photo retention.** _Recommended:_ keep the facts and the photo fingerprints for five
   years as proof, and remove the photo copies 90 days after the listing's last outside
   share closes, to keep storage small.
