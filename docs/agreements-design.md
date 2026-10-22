# Agreements and deal rooms — architecture and authorization

Packet A1. This document fixes the decisions that packets A2–A6 implement.

Status: the owner confirmed the §11 decisions on 2026-10-20, and the A2 core is built on
them (§12). The A3 design is §14, with the owner's answers in §15 (2026-10-22).

## 1. Scope

Agreements are the shared, evidence-bearing record of a deal between two parties.
They are a separately owned module, as the boundary rules require:

- backend module `services/crm-api/src/agreements/`, with its own PostgreSQL
  schema (owner decision 2026-10-15);
- routes under `/api/crm/workspaces/{ws}/agreements/...` for members and under a
  separate guest prefix for outside recipients (A6);
- frontend client `src/services/crm/agreements.js`, one file per domain.

Non-goals: replacing Deals, moving money, exposing private CRM records across
companies, attachments (deferred until private media storage), real-time chat
(A5), and outside-agent links (A6).

The module never reads or writes `crm_records`, `crm_deals`, `crm_payments` or
`crm_expenses`. It stores its own IDs plus frozen snapshots, and calls the owning
module's functions when a private workflow must react (A3, A4).

## 2. Agreement types

| Type                | Sender keeps                        | Recipient receives            |
| ------------------- | ----------------------------------- | ----------------------------- |
| `handover_full`     | nothing                             | the whole deal and commission |
| `handover_referral` | a referral share of the recipient's | the deal less that share      |
| `co_broking`        | its own declared share              | its own declared share        |

Rules:

- One sending company and one receiving company per revision. Each side has
  exactly one named participant who may act.
- Shares are integer basis points (`0..=10000`). `handover_referral` will use the
  existing team setting `maxReferralShareBp` as its ceiling, so the agreement can
  never claim more than the finance hand-over flow allows. Until A3 connects finance,
  A2 caps the referral share at 50%.
- `co_broking` shares are entered per side and must sum to `10000`.
- Money is stored in fils as integers; agreement text and the certificate show
  AED through the i18n formatters.
- The owner confirms the three types in §11 before A2 writes migrations.

## 3. Terms frozen into every revision

Each revision is an immutable snapshot of the terms. Editing terms creates a new
revision; it never mutates an existing one.

Allowlisted fields: type; both party identities (company name, workspace ID,
participant member ID); subject (property snapshot from §6); client snapshot from
§6; agreed commission basis and amount in fils; share basis points; payment
expectation (on transfer, on receipt, on completion); expiry timestamp;
governing emirate; dispute note; optional free text with a length cap; and the
parent revision ID when the revision answers a counter-offer or amendment.

Refused: private CRM record IDs, deal or payment IDs, client contact details,
message bodies, provider payloads, attachments and credentials.

Every revision's stored terms include both parties (workspace and member IDs). Its
SHA-256 digest covers those terms together with the agreement ID, revision number and
parent revision, serialised as compact JSON with sorted keys, so recomputing it from the
stored row reproduces it and an accepted digest identifies exactly one revision of one
agreement between two named participants. Evidence never relies on mutable Deal, Client
or Property rows. Company display names join the snapshot when A4 adds the public
identity contract.

## 4. Lifecycle

States: `draft`, `sent`, `accepted`, `declined`, `countered`, `revoked`, `expired`,
`amended`, `completed`, `cancelled`.

| From       | Action   | Who                      | Result                                       |
| ---------- | -------- | ------------------------ | -------------------------------------------- |
| draft      | send     | sender participant       | `sent`, `expires_at` set                     |
| sent       | accept   | recipient participant    | `accepted`, acceptance event + digest        |
| sent       | decline  | recipient participant    | `declined` (terminal)                        |
| sent       | counter  | recipient participant    | `countered`, new revision from the recipient |
| sent       | revoke   | sender participant       | `revoked` (terminal)                         |
| sent       | (time)   | system                   | `expired` once `expires_at` passes           |
| accepted   | amend    | either named participant | `amended`, new revision, re-acceptance       |
| accepted   | cancel   | both participants        | `cancelled`, both acceptances retained       |
| accepted   | complete | either named participant | `completed`, terminal                        |
| draft/sent | archive  | either Admin in company  | hidden from lists, evidence preserved        |

- Expiry is checked on read and on every action under the workspace lock; an
  expired revision cannot be accepted, declined or countered (a counter-offer cannot
  revive it). The sender may still revoke it.
- A draft freezes its expiry when written. Sending needs at least one hour left;
  otherwise the sender revises the draft first.
- Revocation is sender-only and impossible after acceptance.
- Amending after acceptance keeps the earlier accepted revision and its
  acceptance events untouched; the new revision needs a fresh acceptance from
  the other party.
- Cancelling an accepted agreement needs both participants, not an Admin.
- Admins may archive but never accept, decline, counter, revoke or complete on
  behalf of a named participant.

## 5. Participant verification levels

| Level              | How it is established                                 | Permitted actions             |
| ------------------ | ----------------------------------------------------- | ----------------------------- |
| `member`           | Live server session, active membership in the company | all actions for that party    |
| `contact_verified` | Recipient-locked link plus one-time code (A6)         | accept, decline, counter only |
| `unverified_guest` | Link opened without code verification (A6, view only) | read the shared terms         |

- Membership and role are re-resolved from the server on every request and again
  under the workspace lock before any mutation.
- Archived members and frozen workspaces cannot act; their earlier actions stay.
- The verification method and timestamp are stored on each acceptance or decline,
  because verification is evidence of an action, not of the participant row (which
  is fixed when the draft is written). A6 adds the guest evidence digest there.
  Tokens, codes and raw contact details are never stored in agreement tables or
  events.

## 6. Minimal frozen snapshot

Only these values are copied into a revision, and only when the sender confirms
the preview:

- Property: emirate, community/area label, type, bedrooms, built-up area, asking
  price in fils, listing reference label generated inside the agreement. No
  property record ID, owner name, landlord contact or agent notes.
- Client: first name plus last initial, and an optional contact channel that the
  sender explicitly switches on. Off by default. No client record ID, notes,
  documents or history.
- Both parties see the same snapshot; neither can later expand it without a new
  revision and a new acceptance.

## 7. Payments and completion

- v1 tracks amounts due and received as agreement entries through the finance
  module's functions; the agreements module stores only references and amounts.
- No money moves through the platform. No gateway, escrow or payout integration.
- Marking an agreement `completed` is a participant statement of fact; it does
  not approve a deal, earn commission or alter a snapshot.
- A3 connects same-company handover and referral to this core and generates the
  certificate.

## 8. Retention, disputes and legal

- Proposed retention: accepted agreements, all revisions and all events for five
  years after `completed` or `cancelled`, then reviewed with counsel. Drafts that
  were never sent expire after 30 days.
- Archiving hides an agreement from current lists but never deletes evidence.
  Hard deletion happens only through the retention job, with an audit event.
- Dispute export is a deterministic server-generated bundle (PDF plus JSON
  including revision digests and the event log). It contains no private CRM data.
- Legal wording, governing law, RERA Form I and UAE PASS integration need UAE
  counsel and a later packet; appending the terms without approval is out of
  scope for A1–A4.

## 9. Authorization matrix

| Actor                      | List/read          | Create | Send | Counter | Accept/decline | Revoke | Amend | Archive | Certificate |
| -------------------------- | ------------------ | ------ | ---- | ------- | -------------- | ------ | ----- | ------- | ----------- |
| Sender participant (staff) | own                | yes    | yes  | no      | no             | yes    | yes   | no      | yes         |
| Recipient participant      | own                | no     | no   | yes     | yes            | no     | yes   | no      | yes         |
| Company Admin (non-party)  | company agreements | yes\*  | no   | no      | no             | no     | no    | yes     | yes         |
| Company staff (non-party)  | none by default    | no     | no   | no      | no             | no     | no    | no      | no          |
| Super Admin                | metadata + events  | no     | no   | no      | no             | no     | no    | no      | no          |
| Outside guest (A6)         | shared terms only  | no     | no   | yes     | yes            | no     | no    | no      | own copy    |

\* An Admin may create a draft only by naming themselves or another member as the
sender participant; the named participant performs the send.

- Non-party staff see nothing, even with whole-team record scope, unless a later
  owner decision adds a read-only company view.
- A draft belongs to the sending company: the recipient and their Admin see it only
  once it is sent.
- A2 is cross-company only: a recipient in the sender's own company, the Super Admin
  or an inactive or suspended member is refused. A3 adds same-company handovers.
- Super Admin sees IDs, parties, states, timestamps and redacted events for
  support and audit, never terms, client snapshots or dispute exports. Until that
  metadata view is built, the agreement routes refuse the Super Admin entirely.
- Any read or write with a foreign agreement ID returns the same not-found
  response as a missing record, so IDs cannot be probed across companies.

## 10. Module, tables and routes (implemented in A2)

Owned tables, prefixed in the `agreements` schema:
`crm_agreements`, `crm_agreement_participants`, `crm_agreement_revisions`,
`crm_agreement_events`, `crm_agreement_actions`. Payments arrive with A3 through
finance.

Invariants enforced by constraints and triggers:

- a revision row is insert-only; updates and deletes are refused;
- the agreement row changes only along §4 (draft → sent; sent → sent, accepted,
  declined or revoked; accepted → completed or cancelled), one version at a time;
- one `accepted` revision per agreement at a time, with its accepted digest;
- the same participant pair cannot hold two live agreements for the same subject
  snapshot; overlapping live revisions return a conflict, mirroring the finance
  overlap rule;
- every state change writes exactly one action row and one redacted event.

Routes (A2): list, read, create draft, send, counter, accept, decline, revoke,
amend, cancel, complete, archive, certificate. Each mutation takes an explicit
`expectedVersion` and runs under the workspace lock for member routes.

## 11. Owner decisions (2026-10-20)

1. The three agreement types and their names are confirmed: `handover_full`,
   `handover_referral` and `co_broking`.
2. The `handover_referral` ceiling reuses the team's `maxReferralShareBp` (A2 caps it
   at 50% until A3 connects finance).
3. Retention: five years after completion or cancellation, then a review with counsel;
   drafts never sent expire after 30 days.
4. Expiry: 14 days by default, 90 days at most.
5. The snapshot allowlist in §6 is confirmed, with client contact details off by
   default.
6. Accepted agreements change only by a new revision that the other party accepts;
   nothing is edited in place.
7. The Super Admin sees metadata only.
8. Every active member may send agreements. There is no Admin permission for it:
   Admins cannot switch it on or off for staff.

## 12. Built in A2 (2026-10-20)

- Migrations 0029–0030 and `services/crm-api/src/agreements/`: list, read, create
  draft, revise draft (`PATCH`), send, accept, decline, revoke and counter. Every
  command takes `expectedVersion`, runs under the caller's workspace lock and locks the
  agreement row, which is what serialises the two parties' commands across workspaces.
- Party checks run before any state check, and foreign, hidden or malformed IDs return
  the same not-found response.
- Not built yet: amend, cancel, complete, archive, certificate and dispute export; the
  same-subject overlap conflict; the Super Admin metadata view; the retention job; and the
  frontend client.
- Tests: `tests/api/agreements.test.mjs`, `tests/api/agreements-guards.test.mjs` and the
  module's unit tests, including evidence digests.

## 13. Screens as built (2026-10-22)

The A2 core now has its screens. Every company member reaches **Agreements** from the
connected sidebar (after Deals); the Super Admin does not, matching the routes' refusal.

- **List:** Incoming, Sent and All tabs (by the caller's company side), twelve per page,
  newest first and refreshed every 15 seconds. Each row shows the type, the counterparty
  ("To …" or "From …"), the company name when set, the listing label and area, the
  caller's side's share, the state and whose move it is. Empty, loading (skeleton) and
  failed states are distinct.
- **Detail:** the state, the offer end, both named participants (the caller's side and
  "(you)" marked), a revision picker, the selected revision's frozen terms (both shares
  as percentages with their AED amounts), its evidence digest, author and freeze time,
  the acceptance when there is one, and the event history. The footer offers exactly the
  commands `allowedActions` derives from the server's rules (`agreementModel.js`): the
  sender edits and sends a draft; whoever did not write the current revision accepts,
  declines or counters it while it is open; the sender may withdraw (revoke) a sent
  offer, even an expired one; a non-party Admin only reads. Send, accept, decline and
  withdraw ask for confirmation. A version conflict reloads the latest agreement and
  says so; other refusals show the server's reason.
- **Form:** one stepped form for a new draft (type and recipient → property and client →
  commission and terms → review), a draft revision and a counter-offer (the last three
  steps). The review shows exactly the terms that will be frozen, as §6 requires. Money
  is typed in AED and shares as percentages; `readDraft.js` converts them to fils and
  basis points without floats and applies the server's limits (referral 0.01–50%,
  co-broking 0.01–99.99%, a full handover keeps nothing). The offer end is a Dubai day
  from tomorrow to 89 days ahead, sent as 23:59:59 Dubai time. Client contact is off
  by default. Closing with entries asks first; refusals keep every entry.
- **Server additions** (agreements module, no migration):
  - `POST /agreements/recipients` with `{ email }` finds the named recipient by exact
    sign-in email. It answers only for an active member of another live company (the
    `ensure_recipient` rule) with their IDs, name and company display name; the caller's
    own company, the Super Admin, inactive members and unknown addresses all get one
    identical not-found. There is no partial search. It needs the CSRF token.
  - List and read views add `parties` (each participant's name from the published
    identity view and the company display name through `workspaces::company::get`) and,
    on lists, a `summary` of the current revision (number, author, area, listing label,
    amount and both shares; never the client snapshot).
  - Read adds `revisions` (every revision with its creation time and parent number) and
    `events` (action, party, revision number and time; no actor IDs). A draft belongs to
    the sending company (§9), so the receiving company sees only revisions that were
    offered (sent or countered) and no `created` or `revised` events.
- Code: `src/services/crm/agreements.js`, `src/features/server/agreements/`, the
  `agreements` and `agreementForm` English catalogues. Tests:
  `tests/unit/agreements-model.test.js`, `tests/unit/agreements-draft.test.js`,
  `tests/api/agreements-screens.test.mjs`, `tests/server-browser/agreements.spec.js`.
- Still not built: amend, cancel, complete, archive, certificate, dispute export, guest
  links, the Super Admin metadata view, a rate limit on the recipient lookup, and
  same-subject overlap conflicts.

## 14. A3 design: in-company evidence, certificate and payments (2026-10-22)

A3 is built in two parts. **A3a** turns every in-company deal hand-over into an agreement.
**A3b** adds amendments, completion, cancellation, archiving, the certificate and payment
tracking. The owner's answers are in §15.

### A3a — in-company hand-overs become agreements

- **One direction.** The finance module keeps owning hand-overs (`crm_deal_handovers`)
  and calls a new agreements function in the same transaction at every step; the
  agreements module never reads or writes finance tables. The Agreements form stays
  cross-company only: in-company agreements are created only by a Deals hand-over, so their
  terms are always built by the server, never typed by the sender.
- **Offer.** `deals::handover::offer` builds the frozen terms from the locked deal:
  `kind` `handover_full` or `handover_referral`; the §6 property and client snapshot,
  produced through the records module's functions (first name plus last initial, no
  contact); `money.basis` and `amountFils` from the deal's current fee; the referral share
  as `senderShareBp`; `paymentExpectation` `on_receipt`; the governing emirate from the
  property (or `Dubai` when blank); the default 14-day expiry. It creates the agreement in
  `sent` with both participants in the same workspace, and stores the agreement ID on the
  hand-over row (a new nullable `agreement_id` column, frozen by the existing guard; no
  foreign key across modules).
- **Accept.** `POST /finance/handovers/{id}/accept` now requires
  `{agreementVersion}` when the hand-over has an agreement. The receiver accepts exactly
  the revision at that version; a mismatch is the existing 409 "This agreement changed.
  Reload before saving." The acceptance stores the revision digest with `member`
  verification, as cross-company acceptance does.
- **Admin approval (owner, 2026-10-22: keep it, record it honestly).** `approve` stays
  Admin-only. It records action `approved` with verification `admin_decision` and the
  Admin as the actor, on the recipient's side. If the Admin changes the referral share, the
  Admin first adds a new revision (author `admin`) with the adjusted terms, and the
  approval names that revision. The certificate says "Approved by the company Admin in
  place of the receiving agent's acceptance." Migration 0057 widens three checks:
  `actions.action` adds `approved`, `actions.verification` adds `admin_decision` and
  `revisions.author_party` adds `admin`. Only the in-company path may write these values;
  a trigger refuses them when the two parties are in different companies.
- **Decline, cancel and withdrawals.** Decline → `declined`. The holder's cancel →
  `revoked` by the sender. An Admin's cancel, a deal move (`holder::apply`), a member
  leaving (`finance::departure`) and deleting a never-earned deal → `revoked` with the
  acting person as actor and no party. Every path that closes a pending hand-over closes
  its agreement in the same transaction.
- **Expiry.** An in-company offer expires after 14 days, like every offer. An expired
  hand-over cannot be accepted or approved ("This hand-over offer has expired."); the
  holder or an Admin cancels it and offers again. It still blocks a second pending offer
  until cancelled, so nothing moves silently.
- **Who sees them.** The holder and receiver as the two parties, and the company Admin
  (read-only), under the §9 rules. In the Agreements list they show under Incoming or Sent
  with an "In-company" label; accept and decline there call the finance routes, so both
  screens do the same thing. The Super Admin sees none.
- **Older and sample hand-overs.** Hand-overs made before A3, and those made by the sample
  data command, have no agreement and are decided as before; there is no backfill.
  Sample clearing never has to delete evidence, because agreement rows are insert-only.
- **Cross-company referral cap (owner, 2026-10-22).** A cross-company `handover_referral`
  is capped by the sending company's `maxReferralShareBp` (through the finance settings
  function) instead of 50%. While the Admin has not set a limit (0%), referral offers to
  other companies are refused: "Your Admin has not set a referral limit yet. Ask them to
  set one in Finance settings." The form shows the limit and the message.

### A3b — amend, complete, cancel, archive, certificate and payments

- **Amend.** Either participant of an accepted cross-company agreement proposes a new
  revision. The agreement stays `accepted` on its accepted revision, which stays in force,
  while `proposed_revision_id` (new column) holds the amendment. The other participant
  accepts it (the proposed revision becomes current and gets its own acceptance) or
  declines it (the proposal is closed; the earlier terms stay). One proposal at a time.
  In-company agreements are not amended: a later change is a new hand-over.
- **Complete** (either participant) and **cancel** (both participants, each recorded;
  the second one cancels) follow §4. **Archive** (an Admin of either company, draft or
  sent only) hides it from lists; evidence stays.
- **Certificate (owner, 2026-10-22: printable page plus evidence file).**
  `GET /agreements/{id}/certificate` returns, for parties and their Admins only, a
  deterministic JSON evidence file: agreement ID, both parties' names and companies, every
  revision with its terms, digest and author, every acceptance, approval or decline with
  time, actor name and verification level, and the event history. The screen renders it as
  a print-ready certificate page (saved as PDF with the browser's Print) and offers the
  JSON file for download. The file states how to recompute each digest, so anyone can
  check it. No client contact, private record IDs or message bodies appear.
- **Payments (owner, 2026-10-22: payer records, payee confirms).** Only for agreements
  between companies that move money between the parties: a `handover_referral` (the
  recipient pays the sender its share) and a `co_broking`, whose new revisions name the
  `collectingParty` that collects the fee from the client and pays the other side.
  A new insert-only table `agreements.crm_agreement_payments` keeps entries: the payer
  records `paid` (amount in fils and date, up to the amount due); the payee `confirms`
  that exact entry; the payer may `withdraw` an entry not yet confirmed. The agreement
  shows due, paid, confirmed and outstanding. No money moves through Blaqks One. Inside a
  company, the referral is a commission line of the deal, so Deals and the commission
  statement already track it and no payment entries are made.

### Security review amendments (2026-10-22)

A separate security review approved §14 with these changes, which override the text above
where they differ.

- **Origin lock.** `crm_agreements.origin` (`direct` or `deal_handover`). Every command on
  the agreements routes refuses a `deal_handover` agreement with 409 "Use Deals to act on
  this hand-over."; only the finance-called functions change it, and they assert that the
  current revision was written by the sender or an Admin.
- **Current revision.** Every read and write uses `current_revision_id`, never the highest
  revision number; an amendment proposal is read only through `proposed_revision_id`.
- **Every close path.** Bulk cancels in `holder::apply` and `finance::departure` return the
  agreement IDs and revoke each in the same transaction; deleting a never-earned deal
  revokes first; the sample command passes "no evidence" so it creates no agreements. A
  test checks after each path that no `sent` agreement links to a closed hand-over.
- **Admin decline** becomes `revoked` with the Admin as actor and no party; the holder's
  cancel is `revoked` by the sender.
- **Migration 0057.** Besides widening the three checks and naming each dropped
  constraint: the digest is stored for `approved` as for `accepted`; one unique index
  allows one `accepted` or `approved` row per revision; a structural trigger requires the
  same company for `approved`, `admin_decision` and author `admin`, `approved` exactly
  when `admin_decision`, party `recipient`, and a parent revision for author `admin`. The
  Admin-role check stays in Rust (`gate`), since triggers may not read profiles.
- **Author.** `RevisionRow::author()` reads three values and refuses anything else; new
  revisions put the author into the digest (a versioned digest scheme, old revisions
  unchanged).
- **Kind is fixed.** An Admin approval may change the referral share only within the same
  kind; turning a full hand-over into a referral, or back, needs a fresh offer. In-company
  referrals are capped by the team limit (1–9,999 basis points), passed into
  `Kind::shares`.
- **Offer view (owner, 2026-10-22).** The receiving agent sees the full offer before
  accepting: fee, referral share, client first name and last initial, property facts.
  Staff parties read in-company agreements only while they hold the finance module.
- **Frozen while pending.** While a hand-over with an agreement is pending, the deal's fee,
  client, property and split cannot be edited ("This deal has a pending hand-over. Cancel
  it before editing."). Accept and approve check that the share and the two members still
  match the hand-over; `approve` also takes `agreementVersion`. Expiry compares with
  `clock_timestamp()`. An expired offer can only be cancelled, not declined.
- **Hand-over link.** `agreement_id` is written in the hand-over's INSERT and added to the
  guard's frozen fields.
- **In-company terms.** The server-built terms allow no property (`property: null`) and a
  zero fee, which typed cross-company terms still refuse.
- **Archive per company** (`sender_archived_at`, `recipient_archived_at`); in-company
  agreements cannot be archived.
- **Amendments.** The version guard allows accepted → accepted only to set or clear
  `proposed_revision_id`, or to promote it with an acceptance by the party who did not
  write it, naming that `revisionId`; `current_revision_id` is otherwise frozen. History
  shows proposals to both companies. A cancel request is tied to the current revision and
  voided by an amendment.
- **Payments.** Every entry locks the agreement row; one confirm or withdraw per paid
  entry (partial unique index); a trigger checks the referenced entry, the acting party
  against the kind or `collectingParty`, and refuses in-company and full hand-overs. The
  live paid total never exceeds the amount due, computed in 128-bit integers and rounded
  half-up to the fils; an amendment may not lower the due below what is confirmed.
  Entries hold amount and date only (no later than today in Dubai), and are allowed while
  the agreement is accepted or completed. When a participant leaves their company, nobody
  takes over their side's payment entries (owner, 2026-10-22).
- **Certificate.** A stable evidence block (every offered revision with its full terms,
  including a contact the sender switched on, so every digest can be recomputed, and the
  same revision filter for both companies) plus a separate display block (names,
  `generatedAt`). Served as JSON with `attachment`, `nosniff` and `no-store`; no deal or
  hand-over IDs; the Super Admin is refused.
- **Cross-company referral cap** is checked at every revision write and at send, not at
  acceptance, with a maximum of 9,999 basis points; a recipient's counter-offer is capped
  by the sender company's limit too.

## 15. Owner decisions (2026-10-22)

1. Admins keep approving hand-overs in place of the receiving agent; the agreement and
   certificate record it truthfully as an Admin approval, not an acceptance.
2. A cross-company referral is capped by the sending company's referral limit in Finance
   settings. While that limit is 0%, referral offers to other companies are refused and the
   form asks the agent to have their Admin set it.
3. The certificate is a printable page in the CRM (saved as PDF through the browser) plus a
   downloadable evidence file with the digests.
4. Payments between companies: the paying side records what it paid and the side owed
   confirms receipt; both are kept as evidence. Co-broking offers name the side that
   collects the fee.
5. The receiving agent of an in-company hand-over sees the full offer before accepting:
   the fee, the referral share, the client's first name and last initial, and the property
   facts.
6. When a participant of an agreement between companies leaves their company, nobody takes
   over recording or confirming payments for that side.

## 16. A3a as built (2026-10-22)

- **Migrations 0057 (agreements) and 0058 (finance).** `origin` on agreements, frozen with
  their identity; `digest_scheme` on revisions (2 for every new revision, whose digest also
  covers its author); the widened action, verification and author checks with one
  acceptance or approval per revision; the `crm_agreement_handover_guard` trigger
  (approvals and Admin terms only on in-company hand-overs, no receiver terms on them);
  `agreement_id` on hand-overs, written with the request and frozen by the hand-over guard.
- **Agreements module.** `handover.rs` (offer, decline, withdraw), `handover_decide.rs`
  (accept, approve with an optional Admin revision) and `handover_terms.rs` (server-built
  terms) are called only by finance. In-company terms use money basis `agent_commission`:
  the shares are of the receiving agent's commission line and the deal fee is context, so
  the screens show percentages without AED amounts. Every agreements-route command refuses
  these agreements; staff read them only while they hold the finance module. Reads use
  `current_revision_id`; `RevisionRow::author` fails closed; events are stamped with
  `clock_timestamp()` so events written in one transaction keep their order. `limits.rs`
  applies the sending company's referral limit at create, edit, counter-offer and send.
- **Finance module.** `handover_evidence.rs` builds the offer from the deal (fee before any
  split) and the records module's `handover_facts`, and maps each decision onto its
  agreement. `handover_routes.rs` holds the routes: accept takes `{agreementVersion}` (no
  body for an older hand-over), approve adds `agreementVersion`. Deal moves, departures and
  deletions withdraw the linked agreements in the same transaction; a pending hand-over with
  an agreement freezes the deal's fee, client, property and split. The sample data command
  records no agreements.
- **Screens.** Accept in Deals opens "Review the hand-over offer" with the frozen terms and
  sends the version shown; the Admin's approval shows the offer, says it is recorded as an
  Admin approval and keeps a full hand-over full. Agreements labels these "In-company",
  shows both sides as the caller's company, names the referral and the receiver's share,
  and points to Deals instead of offering commands. The form's referral maximum follows the
  server (99.99%), with the company limit explained in the hint.
- **Tests.** `tests/api/agreements-handovers.test.mjs`, `agreements-handover-closes.test.mjs`
  (with `agreements-handover-helpers.mjs`), Rust unit tests in `agreements/handover_tests.rs`
  and `limits.rs`, the updated finance and agreements suites, and the browser flow in
  `tests/server-browser/finance-deals-handover.spec.js`.
- **Code security review (2026-10-22): no High findings.** Fixed: clearing sample data
  withdraws the agreements of open in-app offers before deleting their hand-overs
  (Medium); an Admin revise of an earned deal respects the pending-offer freeze; actions
  and the `expired` flag use `clock_timestamp()`; the receiving company sees a neutral
  message about the sender's referral limit ("This referral share is above what the
  sending company allows."); a one-word client name that looks like an email or a number
  becomes "Client"; an Admin cannot decline an expired offer (only cancel it); the
  origin-lock test covers every agreements command.
- **Not in A3a:** amend, complete, cancel, archive, the certificate and payment tracking
  (A3b). Existing, outside A3a: clearing sample data suspends sample staff without the
  finance departure step, so app offers to or from them stay open until cancelled.

## 17. H2 design: reviewing, badges, hand-overs to the Admin and approvals (2026-10-22)

Owner decisions (2026-10-22), after trying A3a:

1. **Review before deciding.** A hand-over request shows one **Review offer** button; the
   window shows the deal and the property, with **Accept** and **Decline** inside it, so
   nobody decides blind.
   - Shown: deal type, stage, agreed value, fee basis and rate or fixed fee, the fee, any
     partner company's share and name, the referral split and what the receiver would
     earn, payments received so far, dates and pipeline (opened, target close, milestone,
     current blocker, next action and its date); the property's listing title, sale or
     rental, emirate, community, building, type, bedrooms, bathrooms, size, price, ready or
     off-plan and furnishing.
   - Hidden until acceptance: the client's full name (shown as first name and last
     initial), email, phone and every other client detail; the property owner's contact;
     the deal's notes and documents link (free text often holds client details). After
     acceptance the receiver holds the deal and sees everything under the normal rules.
2. **Badges.** Deals shows a count of hand-overs waiting for your answer or your
   approval; Agreements shows offers from other companies waiting for your answer. In the
   CRM only, refreshed every 15 seconds like Team chat.
3. **Hand-overs to the Admin.** An agent may offer a deal to their Admin as a full
   hand-over only (no referral): an Admin-held deal earns no agent commission and the
   company keeps the net (finance owner question Q4, 2026-10-14). The Admin accepts in
   Deals like an agent.
4. **Needs approval.** The agent may tick **Needs approval** and choose the approver: the
   Admin by default, or a staff member the Admin has given the Finance **Approve** right,
   never the sender or the receiver. The receiver accepts first; then the chosen approver
   approves, and only then does the deal move. Any Admin may still approve or cancel. The
   chosen approver gets the badge. Without the tick, the receiver's acceptance moves the
   deal, as today.
5. The client's name before acceptance stays first name and last initial.

Build notes (for the security review before building):

- `GET /finance/handovers/{id}/preview`: the receiver, the chosen approver and the Admin,
  while pending and with the finance module; a server-shaped view of exactly the fields in
  item 1, so hidden fields never reach the browser. The money terms stay frozen in the
  agreement; stage, dates and payments are read live.
- `GET /finance/handovers/waiting` (`answer`, `approve` counts for the caller) and
  `GET /agreements/waiting` (`answer`), polled by the sidebar.
- A finance migration lets an Admin of the same company receive a full hand-over, and
  adds the approval columns (required flag, chosen approver) with a status for "accepted,
  waiting for approval". The agreement records the receiver's acceptance and the
  approver's approval on the same revision; the approver's verification is distinct from
  an Admin decision. The approver must hold the Approve right when chosen and when
  approving.

### Security review amendments to H2 (2026-10-22)

A separate security review approved §17 only with these changes, which override the
build notes above where they differ.

1. **Open requests.** "Open" means `pending` or `awaiting_approval`, in one shared SQL
   predicate used by the edit freeze, `handOver`, holder moves, departure, deletion,
   sample clearing, lists and a new unique index of open requests per deal.
2. **Finance guard.** `pending` → accepted, declined, cancelled, approved or
   `awaiting_approval`; `awaiting_approval` → approved or cancelled only. The share is
   frozen once awaiting; `requires_approval` and `approver_id` are frozen identity, with
   `approver_id` never the sender or receiver, `requires_approval = (approver_id IS NOT
NULL)`, and approval only with an agreement. New `accepted_by` and `accepted_at`
   record the receiver's acceptance without overwriting `decided_by`.
3. **Agreement state while awaiting.** The receiver's `accepted` action is recorded and
   the agreement stays `sent` (a sent → sent step); it becomes `accepted` only with the
   approval, in the transaction that moves the deal. Test: no `sent` or `accepted`
   agreement links to a closed hand-over whose deal did not move.
4. **The approver's decision** is a new path, separate from the Admin's approval in place:
   only while awaiting, by the chosen approver (a live staff member with the Approve right
   in the same company) or the company's Admin, with the share unchanged; it writes no
   revision.
5. **Admin share changes** (an Admin revision) only while `pending` with no acceptance;
   approval in place of the receiver stays Admin-only.
6. **Evidence migration (agreements).** One `accepted` and one `approved` row per
   revision; a new verification `approver_decision`; `approved` exactly when the
   verification is `admin_decision` or `approver_decision`.
7. **Evidence trigger.** `approver_decision` needs a same-company hand-over agreement, the
   recipient's `accepted` row on that revision with the same digest, and an actor who is
   neither participant; no `approved` row by the receiving member; no Admin revision after
   an acceptance.
8. **Wording.** The certificate and screens say "in place of the agent's acceptance" only
   when no acceptance exists. Verification readers refuse unknown values.
9. **Preview access.** An explicit view read by request and company, never locking.
   Allowed: the receiver while pending or awaiting and still eligible; the approver while
   awaiting and still holding Approve; the company's own Admin. Everyone else, including
   the Super Admin and other team-view staff, and any unknown or decided request, gets the
   same not-found.
10. **Preview content.** Always the own-view money shape, never the stored details object
    as a whole, and no client, property or contact IDs. Property facts come from a
    records-module allowlist function; the terms from an agreements function that checks
    the hand-over's two members.
11. **Free text.** The blocker and next-action texts are left out (the next action's date
    stays) unless the owner accepts that free text may show client details; the owner
    confirms the same for the listing title and the partner name.
12. **Hand-overs to the Admin.** Only to the company's own Admin (never the Super Admin),
    with no referral and no approval step; the receiving Admin accepts or declines, never
    "approves in place" of themselves.
13. **Choosing the approver.** Checked live under lock: active, same company, staff with
    Approve or the company's Admin, not the sender, the receiver or the deal's second
    agent; checked again at approval. "Needs approval" is refused when the sender or
    receiver is the Admin. The list of approvers shows names and IDs only.
14. **While awaiting.** The receiver cannot withdraw their acceptance; the approver may
    reject (cancelled; agreement withdrawn with the approver as actor, no party); the holder
    and the Admin may cancel. A request whose approver became ineligible stays open for
    the Admin.
15. **Expiry.** One offer end for both steps, checked with `clock_timestamp()`; an expired
    awaiting request can only be cancelled; the approver sees the deadline; badges ignore
    expired requests.
16. **Earning.** Earn, unearn and revise are refused while a hand-over is open.
17. **`/finance/handovers/waiting`** returns the caller's counts only, with a live
    finance-module check: `answer` (open pending requests to them) and `approve` (awaiting
    requests where they are the approver with Approve, or every awaiting request of their
    own company for the Admin). The Super Admin gets none.
18. **`/agreements/waiting`** returns counts only: sent, unexpired, direct, between two
    companies, addressed to the caller in the path's company; the Super Admin is refused.

### Owner answer on free text (2026-10-22)

The preview leaves out the current blocker and next-action texts (the next action's date
stays) and shows the listing title and the partner company's name (amendment 11).

### H2 API contract

All paths are under `/api/crm/workspaces/{workspace}`.

- `POST /finance/deals/{id}/handovers {version, toId, referralShareBp|null, approverId?}`:
  `approverId` is optional (absent or `null` = no approval). `toId` may be the company's
  Admin (an `owner` row of `/finance/assignees`): then the share must be `null` and there is
  no approver.
- `GET /finance/approvers` → `{approvers: [{id, name}]}`: the company's Admin and active
  staff with the Finance Approve right, without the caller; needs the finance module and
  the Assign right. The server also refuses the receiver and the deal's second agent.
- Hand-over view (overview `handovers`, every decision response): the A3a fields plus
  `status` `pending` or `awaiting_approval` while open, `toAdmin`, `approval`
  (`null`, or `{approver: {id, name}, acceptedAt}`), `expiresAt` (`null` for older offers)
  and `allowed` `{review, accept, decline, cancel, approve, approveAcceptance,
rejectAcceptance}`. The overview lists open requests.
- `GET /finance/handovers/{id}/preview` → `{handover, offer, deal, client, property}`:
  `offer` `{agreementVersion|null, expiresAt|null, expired, kind ('full'|'referral'),
feeFils, referralShareBp|null}`; `deal` `{dealType, stage, earned, agreedValueFils,
feeBasis, feeRateBp, fixedFeeFils, feeFils, partnerShareBp, partnerName, partnerFils,
netFils, receivedFils, receiverEarnsFils|null, openedDate, targetCloseDate, milestone,
nextActionDue}` (dates and milestone are text or `null`; `receiverEarnsFils` is `0` for
  the Admin, `null` when earned or before finance settings exist); `client` `{name}` (first
  name and last initial); `property` `null` or `{listingTitle, saleRental, emirate,
community, building, propertyType, bedrooms, bathrooms, sizeSqft, priceAed, readyOffPlan,
furnishing}` (text or `null`).
- `POST /finance/handovers/{id}/accept {agreementVersion}`: with approval required the
  request becomes `awaiting_approval` and the response's `entry` is `null`.
- `POST /finance/handovers/{id}/approve-acceptance {agreementVersion}` (the chosen
  approver or the Admin, while awaiting) moves the deal; `POST
/finance/handovers/{id}/reject-acceptance` (no body) cancels it.
- `GET /finance/handovers/waiting` → `{answer, approve}`; `GET /agreements/waiting` →
  `{answer}`.

### H2 as built (2026-10-22)

- **Migrations 0059 (agreements) and 0060 (finance).** 0059 adds the verification
  `approver_decision`, one `accepted` and one `approved` row per revision, and the evidence
  rules of amendment 7 in `crm_agreement_handover_guard`. 0060 adds `requires_approval`,
  `approver_id`, `accepted_by` and `accepted_at` to `crm_deal_handovers`, the status
  `awaiting_approval`, one open request per deal (`crm_deal_handover_open`) and a guard that
  allows exactly the steps of amendment 2: a receiver who is active staff or, for a full
  hand-over without approval, the company's Admin; an approver who is an active member of
  the company; never an approval decided by the receiver; the approval choice and the
  receiver's acceptance frozen once written.
- **Finance module.** `handover_offer.rs` (the offer with the receiver and approver
  checks), `handover_checks.rs` (receiver, approver, referral cap and the "settled" rule
  that holds earning, unearning and revising while a hand-over is open), `handover_rules.rs`
  (who may make which decision at which step, used by both the decisions and the
  `allowed` flags), `handover_decide.rs` (an acceptance that needs approval waits; the
  approver's decision moves the deal), `handover_preview.rs` and `handover_preview_view.rs`
  (the preview), `handover_waiting.rs` (the Deals badge) and `assignees::approvers`. Every
  open-request check (edit freeze, `handOver`, holder moves, departures, deletions, sample
  clearing, lists) uses `pending` or `awaiting_approval`. Property facts for the preview
  come from `records::handover_facts::preview`, a twelve-field allowlist.
- **Agreements module.** `handover_approval.rs` (`accept_awaiting`, `approve_acceptance`
  with `Approver::Admin` or `Approver::Chosen`, through a shared `ledger::approve`),
  `handover_read.rs` (`offer_terms` and `deadlines` for the preview, lists and badges),
  `handover_adjust.rs` (the Admin's share revision, moved out of `handover_decide.rs`) and
  `waiting.rs` (`GET /agreements/waiting`). The Admin's approval in place and the
  receiver's decline are refused once an acceptance exists. History events carry their
  `verification`; an unknown stored value fails the read.
- **Agreements badge.** `answer` counts a sent, unexpired, direct agreement between two
  companies for the participant who did not write its current revision, so after a
  counter-offer it counts for the original sender, matching the screen's "your answer".
- **Screens.** Deals shows one **Review offer** button to the receiver; the review window
  (`HandoverReviewDialog`, `HandoverPreview`) shows the deal, the offer, what the receiver
  would earn and the property facts, with Accept and Decline inside. At
  `awaiting_approval` the chosen approver or the Admin gets **Review** with Approve and
  Reject. The hand-over form lists the Admin (full hand-over only) and offers **Needs
  approval** with an approver list, for staff to staff. `WaitingNavItem` shows the Deals and
  Agreements badges, refreshed every 15 seconds. Agreements words an approval as "Approved
  by the company Admin" or "Approved by the chosen approver", adding "in place of the
  agent's acceptance" only when the revision has no acceptance.
- **Tests.** `tests/api/finance-handover-*.test.mjs` (preview access and content, approval
  steps, approver rules, hand-overs to the Admin, waiting counts and the review fixes),
  Rust unit tests in `agreements/approval_tests.rs` and `handover_tests.rs`, and the browser
  flows `finance-deals-handover.spec.js` and `finance-deals-approval.spec.js`.
- **Code security review (2026-10-22): no High or Medium findings.** Fixed: the receiver
  keeps the preview while an acceptance waits (amendment 9); the preview's three dates are
  sent only as `YYYY-MM-DD`; a client name whose first word looks like an email or a
  number becomes "Client"; the Super Admin's finance overview carries no agreement ID,
  offer end or approver for hand-overs (§9); the preview reads one repeatable-read
  snapshot; only an agent may keep a referral share. Accepted: the pipeline milestone is
  shown as text (owner decision 1; the screens do not edit it); callers without the
  finance module get the module's 403 from the preview, which reveals nothing about the
  request. Not built: the Agreements list rows still show the usual turn text while an
  acceptance waits (the detail says "Accepted, waiting for approval").

## 18. H3 design: the client and property go with the deal (2026-10-22)

Owner decisions (2026-10-22), after trying H2: the receiving agent had no way to contact
the client, because a hand-over moved only the deal.

1. **Contact after accepting.** The client's phone and email are not in the review; the
   receiver gets them the moment the deal moves to them (acceptance, or the approval when
   one is needed). The review says so.
2. **The client and the property move with the deal**, and the sender **keeps seeing
   them, read-only, with a badge**: "Handed over to {name} on {date} · deal {dealId} ·
   full hand-over" (or "· referral {share}").
3. **All listing details in the review**, except the property owner's name and phone.

Proposed build (for the security review):

- **When.** In the transaction that moves the deal (`holder::apply` from an acceptance,
  an Admin approval in place or an approved acceptance), finance calls one records
  function. Declines, cancellations, rejections and Admin reassignments move nothing.
- **What moves.** The deal's client and its property, each only when the sender holds it
  and the receiver may hold that record type (the assignments eligibility check); otherwise
  it stays where it is and the decision response says so. The move uses the assignments
  history writer (`crm_assignments` reason `handover`, actor the decider, activity
  `assigned`). The client's follow-ups, viewings and other children follow the client
  under the existing rules; the property owner's contact follows the property.
- **What the sender keeps.** A new records-owned table `crm_record_keeps` (workspace,
  record, member, handed-to member, deal reference, kind, referral share, created at; one
  row per record and member). The keeping member reads the record in lists, the record
  view and its photos and floor plans, marked `kept` with the badge facts and with no edit,
  delete, assign or link actions. Writes, record pickers, message recipients, assignment,
  finance links and the Inbox keep the strict rule. A keep ends when the member leaves the
  company or the record is deleted, and is not created when the sender is the Admin.
- **Review content.** The preview's `property` adds the unit reference, address, map link,
  availability, listing status, cheques, deposit, price basis, minimum stay, maximum
  guests, parking, amenities, description, key selling points, listing, tour, floor plan
  and photos links, and the stored photos and floor plans through
  `GET /finance/handovers/{id}/preview/files/{file}` (same access as the preview, only
  files the property names). Left out: the owner contact, notes, permit and authorisation
  fields and internal checks.
- **Not changed.** No backfill for hand-overs accepted before H3; the deal itself follows
  the finance rules (a referral sender still sees it as second agent).

### Security review amendments to H3 (2026-10-22)

The specialist reviewer stopped at its usage limit, so the primary agent reviewed §18 as a
separate step; a specialist code review follows when one is available. These override the
proposed build where they differ.

1. **Lock order.** Workspace lock, request, deal, members, agreement, then the client and
   property rows `FOR UPDATE`; each move bumps the record's version, so a concurrent edit
   gets the usual stale-version answer.
2. **Move only what the sender holds.** A record moves only when the sender holds it and
   the receiver passes the assignments eligibility check for its type; anything else stays
   and the decision response reports `records: {client, property}` as `moved`, `shared` or
   `unchanged`. The hand-over is never refused for this.
3. **A listing used elsewhere stays** (owner, 2026-10-22). When another deal that is not
   lost, cancelled or earned uses the same property, the property stays with the sender and
   the receiver gets a read-only keep of it (`shared`).
4. **Keeps are strictly two records.** A keep covers the client or property row only:
   never its follow-ups, viewings, interaction log, client care, shortlist or the owner's
   contact. No keep is written for an Admin, who sees every record anyway.
5. **Read paths.** Kept rows appear only in the record list (outside the projections and
   deal links, so no linked names leak) and in the record's photos and floor plans, each
   only while the keeper holds the collection grant and does not see the row already.
   Writes, deletes, assignment, record pickers, link checks, message recipients, the
   Inbox, finance links and activity keep the strict rule, so every write on a kept record
   is the usual not-found. Exports leave kept records out.
6. **Lifecycle.** A member's keeps are removed in the departure transaction; a record's
   keeps go with the record (`ON DELETE CASCADE`).
7. **Table** `crm_record_keeps`, owned by records: workspace, record, member, other member
   (the receiver for `handed_over`, the holder for `shared`), reason, deal reference (text,
   no foreign key), kind and referral share, created at; one keep per record and member;
   checks on reason, kind and share. The move itself is orchestrated by the assignments
   module through the records history writer and its eligibility check.
8. **Review content.** Viewing instructions (often the owner's phone or access codes) and
   the photos-and-documents link (often title deeds) stay out with the owner contact,
   notes, permits, authorisation and internal checks. Photos and floor plans are served only
   when the open request's property names the file and the caller may preview it.

Owner answers (2026-10-22): a listing used in other open deals stays with the sender and
the receiver gets a read-only view; the deal itself follows the finance rules (the sender
sees the hand-over on Agreements), and taking a deal back stays a new hand-over or an Admin
reassignment.

### H3 as built (2026-10-22)

- **Migration 0061 (records).** `crm_record_keeps`: one read-only keep per record and
  member, `handed_over` or `shared`, with the other member, the deal reference, the kind and
  the referral share for the badge; removed with the record and when the member leaves.
- **Moving.** `finance/deals/handover_follow.rs` says whether another live deal uses the
  property and calls `assignments/follow.rs`, which locks the client and property rows and
  moves each the sender holds to an eligible receiver through the assignments history
  writer (`handover`), keeping it for the sender; a listing in use stays and is shared with
  the receiver. `inbox/handover.rs` moves the client's conversations the sender holds, with
  redacted `assigned` events, so the receiver texts the client and gets the replies. The
  decision response reports `records: {client, property}`.
- **Reading.** `records/keeps.rs` adds kept rows to the record list (outside projections
  and deal links) with `kept` badges, and lets `records/files.rs` serve their photos and
  floor plans. Every write keeps the strict visibility rule, so editing a kept record is
  the usual not-found.
- **Review.** `records/handover_listing.rs` allowlists 29 listing fields plus the stored
  photos and floor plans; `GET /finance/handovers/{id}/preview/files/{file}`
  (`handover_preview_files.rs`) serves a file only when the open request's listing names
  it and the caller may review the hand-over.
- **Screens.** The review shows all listing details, the photos and floor plans, and says
  the phone and email come on acceptance (`HandoverListing.jsx`). Kept records are split
  from the caller's own on the client (`keptRecords.js`): they show only on the Clients,
  Leads and Properties pages and their photos, never in counts, pickers, recipients or
  dashboards. Their rows and listing cards show a "View only" chip (`KeptChip.jsx`) and
  their details the badge (`KeptNotice.jsx`), without edit, delete or reassignment. The
  record list reloads after a decision that moves a deal.
- **Tests.** `finance-handover-records.test.mjs` (moves, conversations, keeps, a shared
  listing, decline, departure), `finance-handover-photos.test.mjs`, the updated H2 suites
  (each deal has its own client now), unit tests in `tests/unit/kept-records.test.js` and
  the listing allowlist test in Rust; the browser flow checks the sender's badge.
- **Review status.** The design review was done by the primary agent (the specialist
  stopped at its usage limit); a specialist code security review is still due. Not built:
  closing a client's other deals when one completes.
- **Design review (2026-10-22, light pass).** Fixed the three blocking issues: the "Needs
  approval" card kept its height when the form scrolls; the review shows the offer and
  what the receiver would earn before the deal facts, so phones see it without scrolling;
  the review's dismiss button says "Close", not "Cancel". Also: "the phone and email come
  when the deal moves to you", "hand-over" spelled the same on Agreements, and a neutral
  full hand-over hint. Left for the redesign: grouping the footer's decisions, hiding
  "Not recorded" rows and an earnings figure on the request row.
