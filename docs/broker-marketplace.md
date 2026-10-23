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

- Whether a company Admin can switch the marketplace off for their team (asked, not
  decided).
- The terms text, the dispute fade period and the suspension length (lawyer review).
- Exact stats definitions (MK4 design).
