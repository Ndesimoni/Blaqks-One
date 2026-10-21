# Company email through SendGrid — design (packet E3)

Status: **approved by the owner** (decisions E3a–E3d, 2026-10-21); security review done, no
High findings. **E3a is built** (2026-10-21, §10); E3b–E3d follow. Decision D4 (revised 2026-10-21) chose Twilio SendGrid as the first email system:
each member writes and reads client email in the CRM from an address on the company's own
domain, with no separate Gmail or Outlook mailbox. The Google Workspace adapter (E1) stays
available. This document extends the [messaging design](messaging-design.md); every rule
there (company isolation, Inbox before leads, the no-duplicate rule, honest statuses,
privacy, sealed credentials, verified webhooks) applies unless this page says otherwise.

## 1. What the owner gets

- The Admin connects the company's SendGrid account once on **Connections**. The CRM checks
  that the company's domain is authenticated in that account, then sets up incoming mail and
  delivery events itself.
- The Admin gives each member with the email grant a **sending address** such as
  `aidah@keyswithsimoni.com`. Members never type or choose a From address.
- Members start emails and reply from the Inbox exactly as with Google today. Client replies,
  and new emails sent to a member's address, arrive in the Inbox and follow the lead rules.
- Statuses are Sent, Delivered (the client's mail server accepted it), Failed (bounced or
  refused, with a plain reason) and Status unknown. No open or click tracking.

## 2. Decisions (owner chose each recommendation, 2026-10-21)

| #   | Decision                   | Decided                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E3a | Whose SendGrid account     | **Each company connects its own SendGrid account** (like one Twilio account per company, D3). SendGrid itself then refuses to send from a domain the account has not authenticated, so one company's key can never send as another. A platform account with one subuser per company (SendGrid Pro) can be added later behind the same adapter. |
| E3b | Which domain receives mail | **The company's main domain** when SendGrid is its only email (Keys with Simoni). A company that keeps another mailbox on its main domain uses a receiving subdomain such as `crm.company.com`, because incoming mail needs the domain's MX record to point at SendGrid.                                                                       |
| E3c | One email system at a time | **Yes.** A company uses SendGrid or Google Workspace for client email, not both; switching disconnects the other and keeps history.                                                                                                                                                                                                            |
| E3d | Addresses after departure  | **Reserved, never given to another person.** Mail to a departed member's address goes to the company's Unassigned queue, so a new hire never receives a former colleague's clients.                                                                                                                                                            |

## 3. Data (owned by `integrations/`)

- One `crm_channel_connections` row per company: `channel = email`, `provider = sendgrid`,
  `owner_member_id = null`, `external_account_id` = the authenticated domain (lower case).
  The existing unique `(provider, external_account_id)` index stops two companies from
  connecting the same domain. The sealed credential is the API key alone. E3b and E3c keep
  the SendGrid public keys (not secret), the receiving host and the IDs of the Parse setting,
  Event Webhook and security policies the CRM creates in their own table (review L7).
- New table `integrations.crm_sendgrid_addresses`: `workspace_id`, `domain`, `member_id`, `local_part` (lower case, `a-z 0-9 . _ -`), `display_name`,
  `state` (`active`, `reserved`), `version`, timestamps. Unique
  `(workspace_id, domain, local_part)` for ever, so a reserved address survives a reconnect
  (L2); one active address per member.
- The Inbox, outbox, receipts and staging tables are reused unchanged. A conversation's
  `connection_id` is the company connection; the member is the conversation's assignee.

## 4. Connecting (SEC-1)

1. The Admin pastes a SendGrid **restricted API key**. The adapter calls `GET /v3/scopes` and
   refuses a key holding anything beyond an exact allowlist: mail send, sender/domain
   authentication read, Inbound Parse settings, Event Webhook settings and security-policy
   create (exact names fixed in E3a). A full-access key is refused (review M4).
2. The adapter reads the account's authenticated domains and accepts only a domain marked
   valid. The Admin names the domain, but it counts only when SendGrid lists it as
   authenticated for that key's account, so the provider proves it.
3. The adapter creates the Inbound Parse setting for the receiving host (with `send_raw`
   on, M3) and the signed Event Webhook, each pointing at a URL that names this connection
   (`/api/integrations/webhooks/sendgrid/{connection}/inbound` and `.../events`), attaches a
   signature security policy, and stores both public keys sealed with the API key. An
   existing Parse setting for that host is never adopted or overwritten without the Admin's
   confirmation (L7).
4. Reconnect must open the same, still valid domain. Unsigned requests stay refused even if
   signing is later switched off in SendGrid; failing verification shows as connection
   health. Disconnect deletes the credential, removes the settings the CRM created (best
   effort, retried through the outbox) and stops intake at once.

## 5. Sending

- Only members with `channel_access.email` and an active address send, as in E1b. The server
  sets `From` and `Reply-To` from the caller's own address and display name; no request field
  can choose them. Header values are checked as in E1b; display names refuse line breaks,
  quotes and angle brackets. With a receiving subdomain (E3b), `Reply-To` is the member's
  address on that subdomain.
- The `v3/mail/send` body is built only from a server-side allowlist: one personalization
  with one recipient, and no `headers`, `send_at`, `batch_id` or `asm` taken from input (L6).
- The worker sends through `v3/mail/send` with tracking (open, click, subscription) switched
  off per message, a CRM-generated `Message-ID` on the company domain, `In-Reply-To` and
  `References` on replies, and the CRM message UUID in `custom_args`. Whether SendGrid keeps a
  custom `Message-ID` is checked in the sandbox; if it does not, threading uses SendGrid's ID
  from the delivery events instead.
- `202` with `X-Message-Id` → `sent`. A timeout, reset or 5xx → `unknown`, never re-sent
  automatically (SendGrid has no send idempotency). `401/403` → connection
  `reconnect_required`. Local development uses a SendGrid stand-in (`npm run dev:sendgrid`).

## 6. Incoming mail and events

Both routes follow the webhook controls in messaging-design §7 with these specifics:

- **Cheap refusals before reading the body (M2).** A wrong content type, a missing or
  malformed signature or timestamp header, a timestamp more than 5 minutes old or ahead, an
  unknown or disconnected connection, or a `Content-Length` over the limit is refused before
  any body byte is read, and writes nothing.
- **Verification (M3).** The connection in the URL selects its stored public key; the ECDSA
  P-256/SHA-256 signature in `X-Twilio-Email-Event-Webhook-Signature` is checked over the
  `X-Twilio-Email-Event-Webhook-Timestamp` value followed by the raw body bytes, before any
  parsing. No framework multipart extractor touches the body first.
- **Size and load (M2).** The inbound route has its own body limit of 25 MiB, its own small
  concurrency limit (503 when full) and a rate limit; the shared 1 MiB limit stays for every
  other webhook, including events. Mail of 25–30 MB (SendGrid's maximum) is refused with 413,
  a known limit. Attachments are noted as media until F3 stores them.
- **Parsing (M3).** After verification a strict parser reads the form: bounded part count and
  part header size, decoding by the `charsets` field, duplicate field names refused, no
  panics. With `send_raw` the MIME message goes through the E1c code for plain text, folding
  and the 20,000-character limit (HTML reduced on the server).
- **Routing (L1).** The envelope recipient's domain must equal the connection's receiving
  host exactly (no suffix match). Its local part selects the address: active → that member;
  reserved or unknown → Unassigned. Mail to several company addresses is handled per
  recipient.
- **Sender trust (M1).** Only the top-level Parse `dkim`, `SPF` and `envelope` fields count,
  never `Authentication-Results` inside the mail. The mail must have exactly one parsed `From`
  address. A new conversation needs a DKIM `pass` whose domain equals or aligns with the
  `From` domain (relaxed alignment by the public suffix list), or an SPF `pass` with
  `envelope.from` aligned to it. Anything else may only join a known thread and shows
  "Unverified sender: check before acting", as in E1c (M2). A high SendGrid spam score lands
  in the Spam tab. Blocks and lead rules apply as for every channel.
- **Intake budgets (L3).** Per sender and per connection limits on new conversations, like
  E1c's per-round budgets, so a flood cannot fill the Unassigned queue.
- **Dedupe (M5, L1).** Incoming mail by `(connection, recipient, Message-ID)`, falling back to
  a hash of the timestamp and body (never the signature bytes, which can vary); events by
  each event's `sg_event_id` inside a batch.
- **Events (L4).** `delivered` → Delivered; `bounce` and `dropped` → Failed with a plain
  reason; `deferred` changes nothing. A message is found by the UUID in `custom_args` (the
  only custom argument sent) within the same connection, and its stored `X-Message-Id` must
  prefix the event's `sg_message_id`. Receipts keep no event email, IP or user agent.
  Incoming mail, including bounce reports, never changes a sent message's status; only
  signed events do.
- **Opt-outs (L5).** `spamreport`, `unsubscribe` and `group_unsubscribe` record an email
  opt-out found through message → conversation → linked record in the connection's own
  workspace; addresses are never looked up across companies.

## 7. Threats checked

| Threat                                   | Control                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Member sends as a colleague or company   | From/Reply-To set by the server from the caller's own address                      |
| Company A sends as company B             | Separate accounts; SendGrid refuses unauthenticated domains; unique domain         |
| Forged or replayed webhook               | Per-connection ECDSA keys, 5-minute timestamp window, dedupe keys                  |
| Cross-company routing                    | Connection from the URL, recipient domain must match, events matched in-connection |
| Forged client sender                     | DKIM/SPF required for new threads; unverified mail labelled                        |
| Stolen API key                           | Scope allowlist enforced at connect, sealed at rest, never returned or logged      |
| Huge unsigned posts to exhaust memory    | Refused before the body is read; per-route size and concurrency limits             |
| Inbox flooding from new senders          | Per-sender and per-connection intake budgets                                       |
| Header injection, HTML or script in mail | E1b header checks; server-side reduction to plain text                             |
| Mail for a departed member               | Address reserved; mail goes to Unassigned                                          |

## 8. Security review (2026-10-21)

Separate security review of this design: **no High findings**; Medium M1–M4 and Low L1–L8
are written into §3–§6 above. To confirm in the SendGrid sandbox during E3a, before E3c
takes real mail:

- **M5:** whether SendGrid re-signs a retried request with a fresh timestamp. If it keeps the
  original, a CRM outage longer than 5 minutes would drop client mail, so the window or the
  retry handling changes before E3c.
- The curve (P-256 per SendGrid's libraries), Parse and event retry periods, the largest event
  batch, the exact `dkim`/`SPF` value formats, whether a custom `Message-ID` is kept, the
  restricted scope names, whether the Parse security policy exists on the Essentials plan, and
  whether another account can claim the same Parse host.

## 9. Packets

- **E3a** — connection, SEC-1 domain check, addresses table and Admin API, stand-in provider.
- **E3b** — sending through SendGrid in the worker, statuses from signed events.
- **E3c** — incoming mail through Inbound Parse into the Inbox.
- **E3d** — Connections card and sending-address screens (with the product designer).

E3a and E3b need no owner setup (stand-in). Testing with real mail needs the owner steps in
[Connecting platforms](connecting-platforms.md) and, for E3c and events, the public HTTPS
address (D7) or a development tunnel.

## 10. E3a as built (2026-10-21)

- Migration 0045 adds the `sendgrid` provider (a company connection: email channel, no
  owner member) and `crm_sendgrid_addresses`, unique for ever by
  `(workspace_id, domain, local_part)` with one active address per member and domain.
- Connect (`POST /channels`, `provider: sendgrid`, `externalAccountId` = the domain,
  `credential` = the key) calls `GET /v3/scopes` and `GET /v3/whitelabel/domains` before
  any lock: the key may hold only `mail.send`, `whitelabel.read`, create/read/delete of the
  Inbound Parse and Event Webhook settings, security-policy create and SendGrid's account
  flags, never an `update` (code review M1); the domain must be listed as valid. Reconnect proves the new key
  on the same domain. Failures are fixed messages; no SendGrid text or key is returned.
- One email system at a time: SendGrid refuses a company with a live Google mailbox, and
  Google sign-in refuses a company with SendGrid, each under the workspace lock.
- `GET/POST /workspaces/{ws}/email-addresses` and `PATCH` (display name) / `DELETE`
  (reserve) on `/{id}`: Admin only, CSRF, live membership under the workspace lock,
  versions on changes. An address goes only to a live member who may send email; role
  addresses such as `postmaster` are refused; display names refuse quotes, angle brackets,
  line breaks and hidden direction characters; a reserved address returns only to its own
  member. A member who leaves or loses the email grant has their addresses reserved in the
  same transaction.
- Local stand-in `scripts/fake-sendgrid.mjs` (`npm run dev:sendgrid`, keys `SG.<kind>.<domain>`)
  behind `CRM_SENDGRID_ENDPOINT`, refused outside local development. API suites:
  `tests/api/sendgrid.test.mjs`, `tests/api/sendgrid-addresses.test.mjs`.
- Google sign-in is refused at its start, before consent, when the company uses SendGrid.
- Code security review (2026-10-21): no High findings. Fixed: exact scope allowlist (M1),
  refusal before Google consent (L1), wider display-name and role-address checks (L3, L4),
  the local stub webhook refuses SendGrid (L6), and tests for other companies' members, the
  CSRF token and suspension (L7).
- Follow-ups:
  - **L1 rest:** a SendGrid connection made between a member's Google start and finish
    still drops that Google grant unrevoked; queue its revocation when E3b touches finish.
  - **L2 (owner decision):** archiving an Admin freezes the company but keeps its SendGrid
    connection and domain held, as company Twilio channels already do. Decide whether an
    archive disconnects company channels before E3c routes incoming mail.
  - **L5:** the CRM cannot delete a SendGrid key (key management is refused by design), so
    the E3d disconnect copy tells the Admin to delete the key in SendGrid.
  - Confirm the exact scope names in the sandbox (§8); address history in Team activity
    with E3d's labels; sending (E3b), incoming mail (E3c), screens (E3d).
