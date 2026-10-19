# Agreements and deal rooms — architecture and authorization

Packet A1. This document fixes the decisions that packets A2–A6 implement.

Status: the owner confirmed the §11 decisions on 2026-10-20, and the A2 core is built on
them (§12).

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
