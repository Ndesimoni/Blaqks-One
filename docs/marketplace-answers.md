# Marketplace answers and broker conversations — MK3

Status (2026-10-26): implemented and tested locally. See the [handoff](handoff.md) for
exact validation and the next MK4 packet. Nothing was pushed or deployed.

Implementation scope: private property offers, server matching, three active slots,
rejection, broker conversations, selection/pause notices and reopening. This packet does
not complete MK4's accepted co-broking agreement or release exact units/contact details.
Existing agreement evidence must remain intact. No external provider delivery is involved.

## Owner decisions, 26 October 2026

- At most three active property offers per client request. Rejecting one frees its slot.
- A broker with no matching property in their permitted inventory may initiate a private
  conversation with the poster while fewer than three active offers remain. This does not
  inspect or disclose anyone else's inventory. It cannot certify that nobody has a match.
- Choosing an offer pauses new offers and conversation initiations and notifies the other
  participating brokers, without identifying the client, selected listing or reason.
- Selection is not deal completion. Existing conversation participants may still reply.
- If the deal falls through, the poster may reopen the request. Original expiry is retained;
  expired/closed requests require the existing renewal/new-request flow. Historical offers
  remain evidence, but their capabilities end before the new round accepts offers.

## Contracts and boundaries

Marketplace owns answer slots, conversations, messages and notices. Agreements owns listing
snapshots, photo copies and listing-share lifecycle. Records exposes only caller-authorized
listing facts and held-client requirements through owner functions. Team chat remains
same-company. Company Admins gain no access to another member's marketplace conversations.

Matching checks purpose, emirate, type, bedrooms, availability, community and price (up to
10% above maximum, labelled). Only the caller's authorized held inventory is searched.
The poster sees offers; another broker sees their own answers, never competitors' inventory.
Offers use a reviewed digest and explicit confirmation. After asynchronous file copies, the
server rechecks permission, request version, match, capacity and participants in the final
transaction. Failed attachment cleans up reserved copies.

Listing shares have authoritative `direct`/`marketplace` origin. Generic direct-share actions
cannot accept, extend or turn a marketplace offer into co-broking. Marketplace views expose
only their allowed basic facts while live. Exact locations, contact details, evidence secrets
and media remain inaccessible through both marketplace and generic share routes until the
separate agreement-release workflow exists. Former holders retain only permitted evidence.

Conversations derive their poster from the request; clients never choose an arbitrary
recipient. Both members must remain eligible and their companies active. Body length and
new-conversation/message budgets are bounded. Recognizable contact details and links are
refused; free-text validation cannot guarantee that a person never types private information.
The interface instructs brokers to keep client/private property details out of messages.
Messages are not copied into activity or lifecycle notices.

## Concurrency and lifecycle

Mutations lock the caller's workspace, then the request/answer/share resources in consistent
order; they never lock the other company's workspace. A partial unique index protects active
slots 1–3, another limits one active offer per broker. The same listing cannot be offered
again to the same request. Expired/ended share capabilities are reconciled before counting.
Temporary suspension must not silently turn into permanent loss of evidence or authority.

Selection requires the poster, expected request version and a locked live offer. Request
pause and deduplicated participant notices commit together. Reopening ends previous share
capabilities through Agreements before freeing slots, retains evidence and increments the
request version/round. It does not cancel any signed agreement.

## Verification required

Use synthetic companies and the disposable Docker database. Verify concurrency at capacity,
rejection/replacement, stale preview, own versus foreign listings, no-match messaging gates,
participant-only reads, suspension, reassignment, expiry, generic share-route bypasses,
location/media redaction, selection notices, reopening history and original expiry. Retain
existing MK1/MK2/direct-share regression checks. Test complete browser flows in both themes.
Run Rust tests/format/Clippy, frontend tests/build and repository gates. Local commits only;
the owner has prohibited pushes.
