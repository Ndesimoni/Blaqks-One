# Marketplace co-broking — MK4

Scope: connect a chosen marketplace offer to the existing negotiated co-broking agreement,
release its private property details and the two brokers' contact details after acceptance,
reuse agreement completion, and show factual marketplace profile statistics. MK5 disputes,
provider delivery, platform operations and the paused application redesign remain separate.

## Journey and agreement boundary

The request's poster chooses an offer through MK3, which pauses new intake and notifies the
other participants. From that selected offer the poster prepares a co-broking draft, explicitly
sets the commission terms and fee collector, reviews it, and sends it through Agreements.
The other named broker may counter, decline or accept using existing versioned commands.
Selection alone, draft creation and sending do not release private details or complete a deal.

The server takes the selected share, counterparties and frozen property reference from its
own records. The request cannot choose an arbitrary share or recipient. Terms bind the share's
introduction digest, and their public property description uses only safe basic facts.
The agreement client is anonymous: no automatic client ID, name, phone, email or CRM notes.
Later revisions and amendments must preserve that boundary as well as the introduction.
The receiving company's Admin can read permitted agreement evidence without receiving the
exact unit, media or the brokers' contact details through the generic agreement response.

## Release policy

Acceptance of the exact linked revision records an immutable, idempotent release event in
the same transaction. It identifies the agreement, revision, accepted digest and introduction;
it does not copy client identities into activity or public profiles.

Only the two named brokers can use the released view. It includes the selected frozen
property snapshot, authorized photo/floor-plan copies and their broker contact details.
Client details remain with the requesting broker; the owner's details remain private.
Marketplace offer responses, generic listing-share views, evidence and file delivery must
enforce the same policy. A saved release event alone never grants perpetual access: current
agreement, share, membership, company status and former-holder rules still apply.

Drafts, declined/revoked/expired proposals, unrelated agreements and forged revision IDs
must not authorize a release. Counters must release only the exact revision accepted by the
party who did not author it. Repeated acceptance must not create duplicate release evidence.

## Reopening, closing and completion

An active accepted or completed agreement cannot be silently canceled by reopening a request.
Before reopening, an accepted agreement must follow its existing explicit cancellation flow;
completed agreements remain evidence of completion. Closing a request does not cancel an
accepted agreement or delete its evidence. Reopening after an unsuccessful unaccepted offer
still preserves the original request expiry and historical offers, as agreed for MK3.

Completion and payment recording reuse Agreements, including existing permissions, versions,
confirmation and evidence. The marketplace does not mark a deal completed on selection or
acceptance. If a failed deal needs a new request, the normal close/new-request path remains.

## Profile statistics

Statistics use marketplace-origin linked agreements only, with no private CRM totals:

- Completed agreements: agreements whose recorded state is completed.
- Agreements accepted: distinct agreements with an acceptance event, including ones later
  canceled; amendments and repeated events do not multiply the denominator.
- Completion rate: completed divided by agreements accepted; unavailable when there are none.
- Average time to first offer: mean elapsed time from a request's posting to that broker's
  first property offer for it. Replacement offers do not create extra samples. Show the
  response sample count and define the figures as all-time.
- Commission disputes: unavailable until MK5 provides reviewed dispute records.

## Review and validation

Security review is separate from implementation. Test pre-acceptance redaction through every
read path, named-person access after acceptance, copied-file authorization, counter-offers,
duplicate acceptance/proposal, suspension, reassignment and foreign Admin/member access.
Race acceptance against request reopening/closing without reversing share/agreement locks.
Test cancellation and completion with history and statistics preserved. Use synthetic records
in disposable Docker databases; never apply test migrations to development/user data.
Run focused API/browser regressions, Rust tests/format/Clippy, frontend tests/build and the
repository gates. Commits stay in the cloud workspace; pushes require the owner's instruction.
