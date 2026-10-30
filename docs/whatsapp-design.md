# WhatsApp through Twilio — design (packets W1 and W2)

Status: **security review done and owner decisions WQ1–WQ3 taken (2026-10-30); ready to build W1a.** The review's
one High finding and its Medium and Low findings are written into this text (§15). Built and
tested against a local Twilio stand-in first (owner, 2026-10-29); a live check with the
owner's Twilio account follows later. This document extends the
[messaging design](messaging-design.md): every rule there (company isolation, Inbox before
leads, the no-duplicate rule, honest statuses, privacy, sealed credentials, verified
webhooks) applies unless this page says otherwise. It follows the shape of the
[SendGrid design](sendgrid-design.md): one company account, with each member's own sending
identity inside it.

## 1. What the owner gets

- The Admin connects the company's **Twilio account** once on **Connections**, by pasting its
  Account SID and Auth Token. The CRM checks them with Twilio.
- The Admin gives each member with the WhatsApp grant **their own number** on Connections,
  choosing from the numbers registered as WhatsApp senders in the company's Twilio account
  (D2, D3, WQ3). The member sees it under **Settings → My WhatsApp**. The owner's current
  number is given to the owner the same way.
- Client messages to a member's number arrive in the Inbox, assigned to that member.
- Members reply from the Inbox, from their own number. Within 24 hours of the client's last
  message they write freely; after that they send an approved **template**. **Start message**
  on WhatsApp works the same way.
- Statuses: Sent, Delivered, Read, Failed with a plain reason, and Status unknown.
- A client who sends **STOP** receives nothing more until they send **START**.
- Locally, `npm run dev:twilio` starts a Twilio stand-in with a page where you play the
  client: pick a member's number, type a message and watch it arrive in the Inbox.

## 2. Decisions

Decided: D1 Twilio first; D2 and D3 each member uses their own number under the company's
Twilio account and Meta Business Portfolio; simulated providers first; English only, so
opt-out words are English (the Arabic keyword in the older plan is dropped).

Owner decisions, 2026-10-30: the owner chose the recommended option for each, shown under Decided.

| #   | Question                                           | Decided                                                                                                                                                                                                                                                                                                                                       | Not chosen                                                                      |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| WQ1 | Messages from unknown senders on a member's number | **Private until reviewed.** Only that member sees them in the CRM until they choose Create lead or Link; the Admin sees how many each member has, never who or what. **Personal, don't keep** deletes the conversation and ignores that sender on that number afterwards. It is not offered for messages from an ad, a listing or a referral. | Same as email: the member holds them and the Admin can open every conversation. |
| WQ2 | Agreement before template messages                 | **A client who messaged first counts as agreed** (shown as "Client messaged first"). Staff may also record agreement given by phone, in person or on a form. STOP withdraws it, and only the client's START or the Admin with a written reason restores it.                                                                                   | Staff must record agreement for every client before any template.               |
| WQ3 | How a number is matched to a member                | **The Admin gives each number to a member** on Connections, from the company's registered WhatsApp senders, as with SendGrid addresses. The Admin registered the numbers in Twilio, so they know whose each one is.                                                                                                                           | The member picks an unclaimed number and the Admin confirms it before it works. |

WQ3 replaces D3's wording "the member connects; the WhatsApp grant is the approval". The
security review showed why the phone on a member's account cannot prove a number: every
member can edit their own phone (`PATCH /account`), and every member's number sits in the
same company Twilio account, so the CRM cannot tell members apart without the Admin (W-H1).

WQ1 limit, to say plainly at connect: the company's Twilio account, which the Admin
controls, keeps a log of every message to every member's number. Private review keeps
personal chats out of the CRM, not out of Twilio. Members should use a work number.

## 3. Data

| Table (owner)                                | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm_channel_connections` (integrations)     | One company row: `channel = whatsapp`, `provider = twilio`, `owner_member_id = null`, `external_account_id` = the Account SID (`AC` + 32 hex). The sealed credential holds the Auth Token and, during a rotation, the next token (§4). The existing unique `(provider, external_account_id)` index stops two companies connecting one Twilio account. This replaces the earlier note that WhatsApp connections carry `owner_member_id`.                                          |
| `crm_whatsapp_numbers` (integrations, new)   | `id`, `workspace_id`, `connection_id`, `member_id`, `phone_e164`, `sender_sid` (`XE…`), `state` (`active`, `disconnected`), `version`, `created_by`, `updated_by`, timestamps. Partial unique `phone_e164` where active, **across all companies**; partial unique `(workspace_id, member_id)` where active. No foreign key into team tables.                                                                                                                                     |
| `crm_provider_templates` (integrations, new) | As in messaging design §3, plus `body` (the company's own template text, shown in the composer) and `variable_count`. Only WhatsApp-approved `twilio/text` content is offered; other approval states are kept for the Admin's list. Unique `(connection_id, provider_template_id)`.                                                                                                                                                                                              |
| `crm_inbox_consents` (inbox, new)            | Insert-only, the latest row wins: `workspace_id`, `channel`, `contact_key` (canonical E.164), `state` (`opt_in`, `opt_out`), `source` (`client_first`, `phone`, `in_person`, `form`, `client_stop`, `client_start`, `admin_restored`), `reason` (Admin restore only), `source_message_sid`, `recorded_by` (null for the client's own words), `recorded_at`. Keyed by the number, **not** a record, so STOP from an unlinked number still stops every send to it in that company. |
| `crm_inbox_personal_senders` (inbox, new)    | WQ1 only: `workspace_id`, `member_id`, `sender_digest`, `key_version`, `created_at`. The digest is HMAC-SHA-256 under its own key (`CRM_WHATSAPP_DIGEST_KEY`, versioned, never rotated freely like `CRM_CLIENT_DIGEST_SECRET`) over length-prefixed workspace, member and number. The CRM recognises a personal contact without keeping their number. Unique `(workspace_id, member_id, sender_digest)`.                                                                         |
| `crm_inbox_conversations` (inbox, changed)   | WhatsApp threads store `whatsapp_number_id` and use `external_thread_id` = `wa:{number row id}:{client number}`, so a number given to someone else later never joins the previous holder's threads (W-M3). New `private_review boolean` (WQ1) and `last_inbound_at` (the 24-hour window).                                                                                                                                                                                        |

Bodies stay only in `crm_inbox_messages`. Receipts, jobs, attempts and events keep no
phone number, body, template variable or provider payload. One canonical normaliser makes
every WhatsApp key (consent, records, Twilio `From` and `To`): `normalize::phone`, extended
to drop a trunk `0` written after a country code (`+971 0 50…`), so the same phone cannot
appear under two keys (W-M5).

## 4. Connecting (SEC-1)

**Company account (Admin only, live check after the workspace lock).**

1. The Admin pastes the Account SID and Auth Token. Both are checked for shape (`AC` + 32
   hex; 32 hex) before any call.
2. The adapter calls `GET /2010-04-01/Accounts/{sid}.json` with that SID and token. It needs
   `200`, the same `sid` and `status = active`; `401` reads "Twilio refused these details".
   Twilio proves the account; nothing typed is trusted.
3. API keys are not used: Twilio signs webhooks with the primary Auth Token, so the CRM
   needs it anyway, and one secret is simpler to rotate.
4. **Token rotation (W-L2).** Promoting Twilio's secondary token changes webhook signatures
   at once. Before promoting, the Admin pastes the next token on Connections; the CRM checks
   it opens the same SID and then accepts signatures from either token until a request
   signed by the next one arrives or the Admin finishes the switch. Plain reconnect after a
   rotation must also open the same SID.
5. **Disconnect (W-L3).** Deletes the token, disconnects every member number and ends their
   private reviews (§7) in one transaction. The sealed token travels with a queued
   best-effort reset of each sender's webhook and fallback URLs, as
   `crm_pending_revocations` does for Google, and is deleted when that job settles.

**Giving a number to a member (the Admin, WQ3).**

1. The Admin chooses a live member of their own company with `channel_access.whatsapp`
   (the Admin may give one to themselves).
2. The adapter lists the company account's WhatsApp senders (`GET
https://messaging.twilio.com/v2/Channels/Senders`, at most 10 pages) and offers only those
   with status `ONLINE` that are not active in any company. "This number is already
   connected" never names the other company.
3. The CRM points that sender's incoming-message and status webhooks at the company's
   inbound route (§6). A sender whose webhook **or fallback URL** points elsewhere is taken
   over only after the Admin confirms (SendGrid review L7).
4. The member or the Admin may disconnect the number. History stays; intake stops.
5. **Hooks (W-M1, W-L6).** The number disconnects, and its private reviews end, in the same
   transaction when its member is archived, suspended or loses the WhatsApp grant. Each hook
   acts on the **member's own company workspace**, not the workspace of whoever made the
   change: when the Super Admin edits or suspends an Admin, the hook locks the organisation
   workspace and then the company workspace, always in that order. The same fix applies to
   the existing E1a mailbox hooks, which today look only in the editor's workspace. Every
   send and every intake re-reads the member's live state and grant under the workspace
   lock, so a missed hook still cannot send or route.

## 5. Sending (W1b)

- **Who:** only the member the number is given to, live, with the grant, and only in a
  conversation whose stored `whatsapp_number_id` is their active number (as O9 for email). A
  conversation reassigned to a colleague shows "Sent from {owner}'s number"; the colleague
  starts their own conversation instead.
- **Refused:** Spam or blocked conversations, a disconnected number or company account, and
  any send to a number whose latest consent is `opt_out`.
- **24-hour window:** open while `last_inbound_at` is less than 23 h 50 min ago by the server
  clock (ten minutes' margin before WhatsApp closes it). Outside it only a template may be
  sent, and the composer says so.
- **Templates:** an approved, synced template of the same connection; each variable is
  typed in the composer (1–200 characters, no line breaks, tabs or four spaces in a row,
  which WhatsApp refuses). Templates need consent `opt_in` (WQ2). The server builds the
  `ContentVariables` JSON; the thread shows the filled-in text.
- **Free text:** 1–4,096 characters.
- **Request allowlist:** `From`, `To`, then either `Body` or `ContentSid` with
  `ContentVariables`, and `StatusCallback`. No media (later packet), Messaging Service,
  scheduling or other field comes from input.
- **Outbox:** the existing rules. Right before the call the worker re-checks the number,
  its member, the member's live state and grant, the company connection, the conversation's
  state and **the consent** (W-M5). It marks the message `sending` and commits. `201` →
  `sent` with the `SM…` ID. `429` before acceptance → retry with `Retry-After`. `401` →
  company connection `reconnect_required`. Known `400` codes → `failed` with a fixed reason
  (§11). Timeout, reset, `5xx` or anything unclear → `unknown`, never re-sent; Twilio has no
  send idempotency.
- **Status callbacks (W-M2).** The callback URL is `…/twilio/{connection}/status?m={message}`
  with the message UUID in lower case; Twilio signs the full URL. The message is looked up
  by `m` **joined to its conversation**, which must belong to that URL's connection and
  workspace. `To` must equal the conversation's client number and `From` the number row's
  phone. When the message already has a `MessageSid`, the callback's must equal it; a SID
  from a callback is stored only if no other message in that connection holds it. A
  callback without `m`, or with an unknown one, changes nothing and never resolves
  `unknown`.
- **Status changes.** Twilio's `sent` → `sent`, `delivered` → `delivered`, `read` → `read`,
  `undelivered` and `failed` → `failed` with the mapped reason. Statuses move forward only.
  A signed callback may move a message out of `sending` (the stand-in answers that fast), and
  the worker's late `sent` or `unknown` never overwrites a status a callback set: the E3b M1
  guard in `domain_settle` extends from delivered and failed to `read`. Each
  `(MessageSid, MessageStatus)` applies once.
- **Private review.** Replies are allowed in a private-review conversation. **Personal,
  don't keep** cancels its pending jobs, and later callbacks for its deleted messages are
  ignored.

## 6. Incoming messages (W2)

Two public routes per company connection: `POST
/api/integrations/webhooks/twilio/{connection}/inbound` (no query string) and `…/status`.

- **Cheap refusals before the body is read:** not `application/x-www-form-urlencoded`, no
  `X-Twilio-Signature` or not base64 of 20 bytes, an unknown or disconnected connection, a
  `bodySHA256` query parameter, or any query on the inbound route. Nothing is written; a
  counter records each refusal (X2-S7).
- **Size:** at most 64 KiB, counted on the bytes as they stream, because a chunked request
  has no `Content-Length`.
- **Verification (W-L1):** HMAC-SHA1 with the connection's token(s) over the URL built from
  `CRM_PUBLIC_URL` (never `Host` or forwarded headers; the port kept, user info and any
  `#` fragment left out) plus the raw query exactly as received, followed by every parameter
  name and value sorted by name byte by byte, compared in constant time. A repeated
  parameter name is refused. Then `AccountSid` must equal the connection's SID.
- **Dedupe:** incoming by `MessageSid`, kept for as long as the message is stored, not only
  the 30-day receipt; status by `(MessageSid, MessageStatus)`.
- **Parsing:** `From` and `To` must be `whatsapp:+` and a valid E.164 number. `To` must be an
  active number of this connection, which names the number row and its member; otherwise
  the receipt is `rejected`. Text over 4,096 characters and `ProfileName` over 80 are cut
  down rather than refused, because Twilio does not retry a refused message; control
  characters are removed. `NumMedia` is noted as media, and `Referral…` fields
  (click-to-WhatsApp ads) mark the source as `ad` for the lead rules. A button reply's text
  is used as the body.
- **Intake order:**
  1. STOP is recorded even for a blocked sender (W-M5); a blocked sender is then dropped.
  2. A personal sender of this member (WQ1) is dropped without storing, unless the sender
     now matches a record that member holds, in which case it returns to private review
     (W-M6).
  3. A known thread gains the message, and `last_inbound_at` moves.
  4. A new thread auto-links **only to a record the number's member holds** (W-M4; this
     also applies to `previous_link`). Other matches, including records only colleagues or
     the Admin hold, leave the conversation in private review with a "Matches a client:
     Link" suggestion, so nobody can pull a member's personal chat into view by creating a
     record with that phone.
  5. An unmatched sender gets a private-review conversation with the lead rules'
     suggestion. An automatic lead (ad source) ends private review.
- **STOP and START (W-M5):** a message that is exactly one of `STOP`, `STOPALL`,
  `UNSUBSCRIBE`, `CANCEL`, `END` or `QUIT` (ignoring case, spaces and closing punctuation)
  records `opt_out`; `START` or `UNSTOP` records `opt_in` with source `client_start`.
  Consent changes only when the message is newly stored, carrying its `MessageSid`, so a
  replay never re-opts a client in. `client_first` is never written after an `opt_out`.
  The thread shows "Client asked to stop messages". No automatic reply is sent.
- **Answer:** `200` with an empty TwiML `<Response/>`, so Twilio sends nothing to the client.
- **Personal chats:** the CRM never imports WhatsApp history and never creates a
  conversation from a message the member sends from the phone app. If Twilio reports such
  messages (coexistence echoes), they appear only in a conversation the CRM already holds,
  marked "Sent from phone" (W2b, once the format is confirmed).
- **Media (W2b):** files are downloaded with the account credential from Twilio's media
  host only and stored under the F3b rules (types, sizes, daily budgets, "from outside the
  company"); otherwise the message shows "Media received".

## 7. Private review (WQ1)

- A private-review conversation is visible only to the member its number is given to. It
  is left out of the Admin's and colleagues' lists, search, Team activity and the Super
  Admin's read-only views; the Inbox access predicate checks `private_review` first. The
  Admin sees one number per member: how many conversations wait in private review.
- **Create lead** or **Link** ends private review, and the conversation becomes a normal
  company conversation with its history. **Personal, don't keep** (not offered for ad,
  listing or referral sources) takes the workspace lock, deletes the conversation, its
  messages, reads, notes and pending jobs in one transaction, and writes the sender digest.
- When the number is disconnected or its member leaves, that member's private-review
  conversations are deleted the same way, never unassigned or handed to someone else.
- Events for private-review conversations are recorded only once review ends, and never
  for deleted ones.
- Limits: deleted messages remain in database backups for up to 35 days, and the digests
  could be guessed by brute force if both the database and the digest key leaked.

## 8. Templates

Templates are written in Twilio's Content Template Builder and approved by Meta; the CRM
reads them. Sync runs on connect, when the Admin presses Refresh, and daily in the worker:
`GET https://content.twilio.com/v1/ContentAndApprovals`, at most 10 pages. A template
whose approval changes away from `approved` disappears from the composer at once.

## 9. Local Twilio stand-in

- `npm run dev:twilio` serves `127.0.0.1:8794`. `CRM_TWILIO_ENDPOINT` points the API at it
  and is accepted only in local development and only for a loopback address, as with the
  SendGrid stand-in. Every Twilio host the adapter uses (api, messaging, content and media)
  derives from that one setting (W-L5).
- It answers the account check, the senders list, the template list (three synthetic
  templates), sender webhook updates and message sends. After a send it posts signed
  `sent`, `delivered` and `read` callbacks. Reserved recipient numbers simulate failures:
  not on WhatsApp, outside the window, a timeout (`unknown`) and `429`.
- Synthetic numbers use the unassigned country code `+999`, which no real phone has, so a
  misrouted test can never reach a person. The test harness refuses to run against a
  non-loopback endpoint.
- Its page at `http://127.0.0.1:8794` lets you play the client: choose a member's number,
  type a message (or STOP), and it posts a signed incoming message to the CRM. The page
  checks `Host` and `Origin` against DNS rebinding.
- The API and browser suites use the same stand-in code; nothing contacts Twilio.

## 10. Who may do what

| Action                                   | Admin                          | Staff with WhatsApp grant           | Staff without   | Super Admin |
| ---------------------------------------- | ------------------------------ | ----------------------------------- | --------------- | ----------- |
| Connect or disconnect the Twilio account | Yes                            | No                                  | No              | No          |
| Refresh templates                        | Yes                            | No                                  | No              | No          |
| Give a number to a member                | Yes                            | No                                  | No              | No          |
| Disconnect a number                      | Any in the company             | Own only                            | No              | No          |
| Read conversations                       | All but others' private review | As record scope; own private review | As record scope | No          |
| Reply or start                           | From own number                | From own number                     | No              | No          |
| Record agreement for a client            | Yes                            | Yes, in visible conversations       | No              | No          |
| Record STOP for a client                 | Yes                            | Yes                                 | Yes             | No          |
| Restore agreement after STOP             | Yes, with a written reason     | No                                  | No              | No          |

## 11. Failure reasons shown to staff

| Twilio code         | Reason shown                                     |
| ------------------- | ------------------------------------------------ |
| 63016               | Outside the 24-hour window: send a template      |
| 63003, 63024, 21211 | This number cannot receive WhatsApp messages     |
| 63018, 20429        | WhatsApp is limiting messages: try later         |
| 63049               | WhatsApp did not deliver this template           |
| 21606, 63007        | Your number is not set up for WhatsApp in Twilio |
| Anything else       | WhatsApp refused this message                    |

## 12. Threats checked

| Threat                                      | Control                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Member claims a colleague's number          | Only the Admin gives numbers (WQ3); account phone is never proof                                   |
| Company A uses company B's Twilio account   | Twilio checks the token; one account per company; SID never typed into routing                     |
| Forged or replayed webhook                  | Per-connection HMAC-SHA1 over the configured URL; `AccountSid` check; durable dedupe keys          |
| Callback changes another company's message  | `m` resolved only within the URL's connection; `To`, `From` and stored SID must match              |
| Cross-company routing                       | Connection from the URL; `To` must be that connection's active number                              |
| Sending after STOP                          | Consent keyed by canonical number, checked when queued and again by the worker                     |
| STOP undone by a replay or a careless click | Consent only from newly stored messages; only START or an Admin with a reason restores it          |
| Duplicate sends                             | Outbox no-duplicate rule; `unknown` never re-sent                                                  |
| Personal chats exposed to the team          | Private review, owner-held-only auto-link, digests, no history import, no conversation from echoes |
| A number's next holder sees old chats       | Threads keyed by number row; private reviews deleted when the number is disconnected               |
| Huge unsigned posts                         | Refused before the body is read; 64 KiB counted while streaming                                    |
| Stolen Auth Token                           | Sealed at rest, never returned or logged; rotation with a next token                               |
| Template variable injection                 | Plain text only, length and whitespace rules; server builds `ContentVariables` JSON                |

## 13. To confirm before the live check

- Twilio onboards an existing WhatsApp Business app number with coexistence, for UAE
  numbers, and whether it reports messages sent from the phone app (echoes) and in what form.
- The Senders API fields and statuses, and that updating a sender's webhook works with an
  Auth Token (Twilio's examples use API keys).
- Signing for senders owned by a subaccount, and whether the secondary token works for REST.
- Whether Twilio retries a failed incoming-message webhook, and whether connection-override
  retries and `I-Twilio-Idempotency-Token` apply to WhatsApp. If it does not retry, add a
  catch-up that reads each number's recent messages from Twilio's message log (dedupe by
  `MessageSid`) before relying on WhatsApp for leads.
- Whether Twilio's message log keeps WhatsApp bodies and whether redaction is available.
- The payload of Meta's "Stop promotions" button, the error codes in §11 and the
  `ContentAndApprovals` fields.
- The Twilio WhatsApp sandbox uses a shared number, so it can prove sending and callbacks
  but not a member's own sender.

## 14. Packets

- **W1a** — the stand-in, the company connection with token rotation, giving and
  disconnecting numbers, the hooks in §4 (including the E1a fix), the Connections card and
  Settings → My WhatsApp.
- **W1b** — templates, consents, sending (reply, Start message, Send again), status callbacks
  and the composer's window, template and agreement states.
- **W2a** — incoming messages, private review and personal senders, STOP and START.
- **W2b** — incoming media, phone-app echoes and the catch-up, after §13 is confirmed.

Each packet: security review of its diff, focused API and browser tests against the
stand-in, product designer for every screen, and the checks in the [handoff](handoff.md).

## 15. Security review (2026-10-30)

A separate security review of this design, checked against Twilio's public webhook-security,
connection-override and Senders API documentation. Findings and where they are answered:

- **W-H1 (High):** the first draft proved a number by the member's account phone, but every
  member can change their own phone and all numbers share one Twilio account. Answered by
  WQ3: the Admin gives numbers. Blocked W1a until fixed in this text.
- **Medium:** W-M1 hooks acting in the wrong workspace when the Super Admin edits an Admin
  (also an existing E1a gap), §4; W-M2 status callbacks scoped to the connection and the
  `sending` race, §5; W-M3 threads keyed by number row, §3 and §7; W-M4 the Admin's Twilio
  logs and company-wide matching, §2 and §6; W-M5 consent replays, STOP restore and one
  normaliser, §3, §5 and §6; W-M6 "Personal" hiding company leads, §6 and §7.
- **Low:** W-L1 signature details, §6; W-L2 token rotation, §4; W-L3 disconnect keeps the
  token for the webhook reset, §4; W-L4 a separate digest key and locking, §3 and §7; W-L5
  stand-in hosts, numbers and page, §9; W-L6 grant and suspension hooks, §4.
