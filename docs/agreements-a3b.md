# A3b — agreement lifecycle, certificates and payment records

Authorized by the owner on 2026-10-23. Scope: the A3b decisions in
[Agreements design §14–§15](agreements-design.md#a3b--amend-complete-cancel-archive-certificate-and-payments).
R2 and A6 remain separate proposals. No money is transferred by this feature.

## Reviewed implementation contract

The separate security design review found no outstanding product blocker. The following
requirements refine the existing approved decisions and govern implementation.

- An accepted cross-company agreement keeps its current accepted revision while one
  separate proposal is pending. Only the other participant accepts or declines the exact
  proposed revision ID. Proposal expiry is checked independently of the original offer.
  Every change uses `expectedVersion` and locks the agreement after the caller's workspace
  and live membership checks. A database guard validates promotion against acceptance
  evidence for that proposal; revisions and their digests remain immutable.
- Either participant may complete an accepted agreement. Cancellation records each party's
  request against the current revision; the second party closes it. Starting an amendment
  clears earlier cancellation requests. Completion and cancellation clear proposals.
  Admins never act in place of participants. In-company handovers remain controlled by Deals.
- Only a live company Admin archives, only its own side of a draft or sent cross-company
  agreement. Unseen recipient drafts are not accessible. Archiving hides that company's
  list entry, preserving the other company's view and all evidence.
- Payment rows are insert-only: paid, confirmed and withdrawn. Confirmation/withdrawal
  references one original paid row in the same agreement, and only one such terminal entry
  is allowed. The payer records/withdraws unconfirmed payments; the payee confirms them.
  State must be accepted or completed. Dates cannot be later than today in Dubai.
- Referral payer is the recipient; co-broking payer is `money.collectingParty`. Full and
  in-company handovers have no inter-company payment ledger. Old co-broking terms without a
  collecting party remain readable, but need an accepted amendment before payments.
- Due is the payee's share of the agreed fee, calculated with 128-bit integers and half-up
  rounding to fils. Live paid entries cannot exceed due, including concurrent requests.
  Amendment acceptance cannot reduce due below live paid or change payer while live paid
  entries remain. Confirmed entries cannot be withdrawn. Departure grants no substitute
  participant payment authority.
- The certificate has a stable evidence block and a separate display block containing
  names and generation time. Both companies get the same offered revisions, including
  proposals and relevant handover Admin revisions, excluding unsent draft revisions. Full
  original terms (including explicitly shared contact), parent UUID, author, digest scheme,
  number and digest allow recomputation of existing scheme 1/2 evidence. Events, action
  evidence and payments are ordered deterministically. No private deal/handover IDs appear.
  Existing participant/Admin and handover finance-read rules apply; Super Admin is refused.
  JSON uses attachment, no-store and nosniff headers. The screen renders plain text and
  prints a scoped certificate with readable light styling.

## API additions

All paths below are relative to `/api/crm/workspaces/{ws}/agreements/{id}`.

| Route                                           | Body or response                          |
| ----------------------------------------------- | ----------------------------------------- |
| `POST /amend`                                   | `{expectedVersion, terms}`                |
| `POST /amend/accept`, `/amend/decline`          | `{expectedVersion, revisionId}`           |
| `POST /complete`, `/cancel`, `/archive`         | `{expectedVersion}`                       |
| `GET /payments`                                 | `{payments, summary}`                     |
| `POST /payments`                                | `{expectedVersion, amountFils, paidOn}`   |
| `POST /payments/{payment}/confirm`, `/withdraw` | `{expectedVersion}`                       |
| `GET /certificate`                              | `{evidence, display, digestInstructions}` |

Detail adds `proposal` and `lifecycle` with allowed actions and cancellation requests.
Payment summary fields are `available`, `payer`, `dueFils`, `paidFils`, `confirmedFils`
and `outstandingFils`. Payment entries include their action and original-entry reference.
Every mutation checks Origin, CSRF, live membership, writable workspace and version;
payment IDs are resolved inside the authorized agreement, never independently.

## Screen acceptance

Current terms remain the default even when a newer proposal exists. Proposal review and
decisions are separate from the current terms. Completion explains that it does not
confirm receipt of money; cancellation shows which side is still needed. Archive explains
that evidence and the other company's view remain. Payment amount/date forms preserve
failed entries and confirm the exact payment. Certificate print and evidence download are
available from the detail. Reuse shared controls, English catalogue and the approved theme.
Verify keyboard access and 390px/1280px layouts in both themes.

## As built (2026-10-23)

- **Migrations** 0064 (lifecycle: proposals, cancellation requests, per-company archive),
  0065 (insert-only `crm_agreement_payments`, the due function and its guard) and 0066
  (amendment promotion guards).
- **Server** (`services/crm-api/src/agreements/`): `amendment.rs`, `amendment_answer.rs`,
  `closure.rs` (complete, cancel), `archive.rs`, `payment_model.rs`, `payment_store.rs`,
  `payment_read.rs`, `payment_write.rs` (the rules), `payment_routes.rs`, `term_money.rs`,
  `lifecycle_view.rs`, `certificate.rs` and `certificate_store.rs`.
- **Screens** (`src/features/server/agreements/`): proposal review and decisions,
  completion, two-sided cancellation, archive, the payments panel and form, and the
  certificate window with Print / Save PDF and the evidence download; co-broking offers
  name the side that collects the fee.
- **Tests:** `tests/api/agreements-a3b-{lifecycle,payments,certificate,guards}.test.mjs`
  (the certificate suite recomputes every revision digest from the certificate alone),
  the updated agreement draft unit tests and the browser flow
  `tests/server-browser/agreements-lifecycle.spec.js` (payment recorded and confirmed,
  certificate, completion; 1280 and 390 px in both themes).
- **Built by** Codex, which stopped before the certificate; Claude finished the
  certificate, moved archiving into its own file and fixed its check order (the Deals
  origin lock answers first, then "Only your Admin can archive an agreement."), split the
  payment routes, replaced a deprecated date parser, and updated the tests for the new
  collecting party.
- **Found on the way:** two API client methods were both named `createAgreement` since the
  A2 screens, so adding a team commission agreement in Finance settings posted to the
  cross-company route and failed. The cross-company one is now `createDealAgreement`, and
  `tests/unit/crm-client-names.test.js` refuses duplicate method names.
- **Reviews:** the design review is above; the primary agent reviewed the code (payer and
  payee checks, the agreement lock before totals, one answer per entry, no stand-in for a
  departed participant, the origin lock, the certificate's read rule and headers). A
  specialist code security review was completed on 2026-10-24 (below).

## Code security review and follow-up (2026-10-24)

A separate specialist reviewed lifecycle authorization, proposal promotion, cancellation,
archive scope, immutable payment entries and certificate filtering. No High findings were
identified. One Medium financial-read consistency finding was fixed: the ledger endpoint
now uses a repeatable-read, read-only transaction, so entries, effective terms and totals
come from the same committed snapshot during concurrent amendments and payments.

The controlled regression `tests/api/agreements-payment-snapshot.test.mjs` pauses a ledger
read after its agreement snapshot, commits a payment from another transaction, and checks
that the pending response stays wholly before the payment while a fresh read sees it.
The specialist confirmed the correction by inspection; runtime results are recorded in
the handoff checkpoint.
