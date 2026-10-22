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
