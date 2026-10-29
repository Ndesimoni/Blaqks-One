# Messaging integrations — architecture and security design

Packet X0 of the [messaging integrations plan](messaging-integrations-plan.md). This
document fixes the data model, module ownership, webhook boundary, credential handling,
status rules, retention and authorization that packets X1–S1 implement.

Status: X0, X1, X1a and X2 are built (X2: verified webhook intake with the local stub provider, sealed staging, the outbox and the `messaging_worker` process). **Approved by the owner on 20 October 2026**, after the separate
[security review](messaging-security.md). Its two High findings (provider-proven account
ownership and re-sending after lease expiry) are closed in this text, and the design
decisions O1–O6 in §13 are decided. Product decision D2 (WhatsApp numbers) was decided on
2026-10-29: each member connects their own number, so WhatsApp connections carry
`owner_member_id` like mailboxes. D4 (mailbox
system), D5–D7 (social accounts, webhook address) and D8 (AI sorting) remain open where
they block later packets.

## 1. Scope

One shared Inbox receives client messages from WhatsApp, email, Facebook Page,
Instagram and a TikTok business account (added by the owner 2026-10-20), matches them to the right lead or client, and lets permitted staff reply from
the CRM. Sending to known clients is the goal; an unknown sender never becomes a lead
unless a rule in §6 allows it.

Non-goals for X0–U2:

- bulk sending, campaigns and provider broadcasts;
- attachments and media storage (shown as "Media received" until private storage exists);
- AI classification or auto-replies;
- calendars, calls or SMS;
- TikTok comments, ads or lead forms (TikTok direct messages only, through the Business
  Messaging API);
- moving message content into the public catalogue or across companies.

## 2. Module ownership

Three new modules, each with its own PostgreSQL schema in the same database (owner
decision 2026-10-15) and its own frontend client file. No module adds a collection to
`crm_records`, a projection to `GET records`, or a foreign key into `crm_records`,
`crm_deals` or `crm_payments` (boundary rule 9).

| Module                                  | Owns                                                                                                                                     | Reaches into other domains                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integrations/` (schema `integrations`) | Channel connections and sealed credentials, provider templates, webhook receipts, provider adapters and their signature checks           | Calls `inbox` functions to record a verified inbound event; calls `outbox` to enqueue delivery; writes nothing in `crm_records`                                               |
| `inbox/` (schema `inbox`)               | Conversations, messages, internal notes, read state, blocked contacts, lead rules, property words, consent evidence and redacted history | Calls `records::lookup::contact_matches` and the records create/visibility functions; calls `workspaces::lock`; calls `outbox::enqueue`; never queries `crm_records` directly |
| `outbox/` (schema `outbox`)             | Generic delivery jobs, leases, attempts, backoff and terminal states, shared later with notifications                                    | Stores only a domain, object ID and idempotency key; never message bodies, addresses, tokens or rendered content                                                              |
| `src/services/crm/integrations.js`      | Frontend client for channels                                                                                                             | Calls only `/api/crm/workspaces/{ws}/channels...`                                                                                                                             |
| `src/services/crm/inbox.js`             | Frontend client for the Inbox and rules                                                                                                  | Calls only `/api/crm/workspaces/{ws}/inbox...`                                                                                                                                |

Routes:

- Member routes stay under `/api/crm/workspaces/{workspace}/channels...` and
  `/api/crm/workspaces/{workspace}/inbox...`.
- Provider callbacks use the public prefix `/api/integrations/webhooks/{provider}`
  (boundary rule 10) and never accept or set CRM cookies.
- A second binary in the same crate, `messaging-worker` (`src/bin/messaging_worker.rs`),
  runs the outbox loops. The API process never claims jobs. Local development starts it
  with a new npm script; hosted deployment runs it as its own process and database role.

`integrations` maps its own database errors to its own code range and is merged in
`routes.rs` with one line, following the agreements pattern. The public webhook router is
mounted separately so it can later move behind `/api/integrations` without touching CRM
routes.

## 3. Tables

Every migration header names the owner. All tables carry `workspace_id` except the
platform-wide `outbox` rows, which carry the workspace they act for and are only claimed
by the worker.

### `integrations`

| Table                     | Key columns and invariants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm_channel_connections` | `id`, `workspace_id`, `channel` (`whatsapp`, `email`, `facebook`, `instagram`, `tiktok`), `provider` (`twilio`, `google`, `microsoft`, `meta`, `tiktok`), `external_account_id`, `display_label`, `owner_member_id` (nullable; email mailboxes are per person), `state` (`connected`, `reconnect_required`, `disconnected`), `credential_sealed`, `credential_key_version`, `credential_updated_at`, `version`, `created_by`, `updated_by`, timestamps. Unique `(provider, external_account_id)` across all companies among connections that are not `disconnected` (a disconnected row keeps its history and releases the account for a fresh connection by any company); unique active connection per `(workspace_id, channel, owner_member_id)`; `external_account_id` is derived by the provider adapter from the credential, stored canonically (E.164 phone, lower-case email) and never accepted from or returned to the browser (the stub in X1 accepts a typed synthetic ID). |
| `crm_provider_templates`  | `connection_id`, `provider_template_id`, `name`, `language`, `category`, `approval` (`approved`, `pending`, `rejected`), `synced_at`. Body text is provider-owned and not stored. Unique `(connection_id, provider_template_id)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `crm_webhook_receipts`    | `provider`, `event_id`, `workspace_id`, `connection_id`, `outcome` (`received`, `rejected`, `processed`, `failed`), `failure_code`, processing lease and attempts, `received_at`, `processed_at`. Written only for verified events (SEC-3), so there is no `signature_ok` column. Unique `(provider, event_id)`; no payload, headers, address or body column. Built in X2 (migration 0034)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `crm_webhook_staging`     | `receipt_id`, `payload_sealed` (AES-256-GCM bound to the receipt), `key_version`. The only place a verified body exists before processing; deleted when the event is settled and with its receipt by the 30-day purge. Built in X2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `crm_integration_events`  | Redacted connection history: `connection_id`, actor, action (`connected`, `reconnected`, `disconnected`, `reconnect_required`, `template_sync_failed`), time. Insert-only; no credentials, account IDs or provider errors with secrets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### `inbox`

Built in X3a (migration 0037), with these differences from the table below: property words are stored as `words_en` and `words_ar` arrays on `crm_inbox_rules` instead of a separate table; consents arrive with W1, the first sending packet; one conversation exists per provider thread, so a client may have several (an email client starts new threads), and there is no unique index per linked record; Arabic property words also match after the common joined prefixes (ال، لل، و، ب، ل، ف). Unknown senders on Facebook, Instagram and TikTok are keyed by platform ID and never matched to records automatically.

| Table                      | Key columns and invariants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm_inbox_conversations`  | `id`, `workspace_id`, `channel`, `connection_id`, `external_thread_id`, `contact_key`, `contact_display` (normalised phone or lower-case email for staff display), `linked_collection` (`Clients` or `Contacts`, nullable), `linked_record_id` (nullable), `assignee_id` (nullable = Unassigned), `state` (`new`, `open`, `waiting`, `resolved`, `spam`), `suggested_lead`, `first_source`, `last_activity_at`, `version`. Unique `(connection_id, external_thread_id)`; partial unique `(workspace_id, linked_collection, linked_record_id)` where the state is not `spam`, so one linked record has one conversation per channel. No foreign key into `crm_records`. |
| `crm_inbox_messages`       | `id`, `conversation_id`, `direction` (`inbound`, `outbound`), `provider_message_id` (nullable for drafts), `status` (§5), `author_user_id` (outbound only), `sent_at`, `received_at`, `body` (the only place message text is stored), `has_media`, `template_id` (nullable), `failure_reason` (plain code). Unique `(conversation_id, provider_message_id)` where not null. Bodies never copy into other tables.                                                                                                                                                                                                                                                       |
| `crm_inbox_notes`          | `id`, `conversation_id`, `author_user_id`, `body`, `created_at`. Separate table so a payload mistake cannot mark a note as sent. Never included in provider sends or client-facing payloads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `crm_inbox_reads`          | `(conversation_id, member_id)`, `last_read_message_id`, `read_at`. Drives the unread count only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `crm_inbox_blocks`         | `workspace_id`, `channel`, `contact_key`, `created_by`, `created_at`, optional reason. Checked before matching; blocked senders are dropped silently and never stored as conversations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `crm_inbox_rules`          | `workspace_id` (unique), `lead_mode` (`suggest` or `create`), `auto_lead_sources` (ad/listing/form/portal switches), `version`, `updated_by`, `updated_at`. Admin-only write, optimistic version.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `crm_inbox_property_words` | `workspace_id`, `language` (`en`, `ar`), `word`. Seeded with the approved starter list; Admin-editable. Unique `(workspace_id, language, word)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `crm_inbox_consents`       | `workspace_id`, `linked_collection`, `linked_record_id`, `channel`, `state` (`opt_in`, `opt_out`), `source`, `recorded_at`, `recorded_by`. Insert-only; the latest row wins. Consent rows survive conversation deletion.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `crm_inbox_events`         | Insert-only redacted history: conversation ID, actor or `system`, action (`created`, `matched`, `assigned`, `state_changed`, `lead_created`, `linked`, `blocked`, `send_failed`), time. No body, address, template variables or provider payload.                                                                                                                                                                                                                                                                                                                                                                                                                      |

### `outbox`

| Table                 | Key columns and invariants                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm_outbox_jobs`     | `id` (UUID, also the idempotency key), `workspace_id`, `domain` (`inbox`), `object_id` (the message UUID), `kind` (`send`), `state` (`pending`, `leased`, `done`, `failed`, `unknown`), `attempts`, `available_at`, `lease_owner`, `lease_expires_at`, `last_failure_code`, timestamps. No body, address, token or rendered text columns; `CHECK` constraints reject unknown domains and states. Built in X2 (migration 0035) |
| `crm_outbox_attempts` | One row per provider call, committed before the call (SEC-2): `job_id`, `attempt`, `started_at`, `finished_at`, `outcome` (`sent`, `retry`, `failed`, `unknown`). An expired lease with an unfinished attempt turns the job `unknown`. Built in X2                                                                                                                                                                            |

Schema-level invariants:

- one live job per outbound message: partial unique index on `(domain, object_id)` where
  the state is `pending` or `leased`;
- `unknown` is terminal until a provider callback or an explicit human action resolves
  it; the worker never re-sends it (§5);
- conversation state transitions and message status changes are monotonic (§4, §5);
- disconnecting a connection sets it to `disconnected`, stops intake, deletes the sealed
  credential immediately and keeps conversations and messages for their retention period;
- archiving or deactivating a member disconnects that member's connections in the same
  transaction; archiving an Admin also disconnects every company connection, releasing its
  domain, number or Page (owner, 2026-10-21; `integrations::company_archived`).

## 4. Conversation lifecycle

States: `new` (inbound from an unmatched sender or a first reply), `open` (linked or
replied), `waiting` (staff replied, no client message since), `resolved`, `spam`.

| From             | Action                                 | Who                         | Result                             |
| ---------------- | -------------------------------------- | --------------------------- | ---------------------------------- |
| new              | link/create lead                       | permitted staff             | `open`, linked record set          |
| new/open/waiting | outbound message accepted for delivery | permitted staff             | `waiting`                          |
| open/waiting/new | inbound message                        | system                      | `open`, `last_activity_at` updated |
| open/waiting     | mark not a lead                        | permitted staff             | `resolved`                         |
| open/waiting     | block sender                           | Admin or the assigned agent | `spam`, block row written          |
| open/waiting     | resolve                                | permitted staff             | `resolved`                         |
| resolved         | new inbound message                    | system                      | `open`                             |

Routing runs in this order: agent of the source listing or ad → the linked client's
assignee → Unassigned. Unassigned conversations are visible to the Admin and to staff
with that channel's reply permission, who may claim them. Changing the assignee is a
normal assignment mutation and records a redacted event.

Visibility follows the connected record scope: assigned-only staff see conversations they
hold; whole-team staff see the team's; the Admin sees all in the company. A conversation
linked to a record the caller cannot see still appears if the caller is its assignee, but
the client panel shows only the record summary the records module allows. Foreign,
hidden and malformed conversation IDs return the same not-found response.

## 5. Sending, statuses and the no-duplicate rule

The composer autosaves a draft as `crm_inbox_messages` with `status = draft`,
`provider_message_id = null`. Sending runs in one transaction under the workspace lock:

1. re-check membership, channel reply permission, conversation visibility and version;
2. check consent (opt-out refuses), the WhatsApp 24-hour window (outside it only an
   approved template), and that a template is approved;
3. set `status = queued` and insert one `outbox` job whose ID is the idempotency key;
4. commit.

The worker claims with `FOR UPDATE SKIP LOCKED`, a 60-second lease and capped
concurrency. Before calling the adapter it commits an **in-flight attempt** row; it then
calls the adapter with an HTTP timeout shorter than the lease and stores the provider
message ID. A job whose lease expired while an attempt was in flight becomes `unknown`
and is never claimed again, because the provider may already have accepted it. The job
ID is an idempotency key inside the CRM only: Twilio, Gmail, Graph and Meta offer no
send idempotency, so the CRM never relies on the provider to drop a duplicate. Provider callbacks
change the status. Statuses never move backwards except `delivered → read`.

| Status      | WhatsApp                          | Email             | Facebook / Instagram   |
| ----------- | --------------------------------- | ----------------- | ---------------------- |
| `draft`     | local only                        | local only        | local only             |
| `queued`    | accepted, not yet at provider     | accepted          | accepted               |
| `sent`      | provider accepted the message     | mailbox accepted  | provider accepted      |
| `delivered` | provider delivery callback        | never claimed     | provider callback      |
| `read`      | provider read callback            | never claimed     | never claimed          |
| `failed`    | permanent refusal with a reason   | bounce or refusal | permanent refusal      |
| `unknown`   | timeout or unclear provider reply | timeout           | unclear provider reply |

No-duplicate rule:

- exactly one live job per message, enforced by the partial unique index;
- retries happen only for transport failures received before any provider acceptance,
  at most five attempts, exponential backoff with jitter and `Retry-After` respected;
- a timeout, reset or 5xx after the request may have reached the provider becomes
  `unknown`; the worker never re-sends it, and only a matching provider callback (same
  provider message ID or provider receipt evidence) or a person choosing **Send again**
  resolves it;
- **Send again** creates a new message row marked as a deliberate repeat; it never
  reuses the old job or provider message ID;
- status callbacks are deduplicated by `(provider, event_id)` and applied only when they
  move the status forward.

### Reading client replies (E1c, built 2026-10-20)

- The worker's `mailsync` loop (every `CRM_MAIL_SYNC_SECONDS`, default 30) reads each
  connected Google mailbox's history of messages added to INBOX since its cursor
  (`mail_history_id`, migration 0040). A new mailbox's cursor starts at the present, and an
  expired cursor restarts there: no older mail is read.
- For each message the worker reads headers only, skips the member's own mail, and asks the
  Inbox through `Sink::email_relevant` whether it belongs: a thread the CRM already holds,
  or a sender address matching a Client or Contact (`records::lookup::contact_matches`).
  Only then is the body fetched (bounded to 2 MB) and stored as plain text up to 20,000
  characters: HTML is reduced to text on the server, so no markup, script or remote image
  reaches the browser; attachments are noted as media, not stored.
- Bounces (mailer-daemon/postmaster or `multipart/report`) in a known thread fail the
  latest sent message with `bounced`; they are never stored as client mail.
- A refused token marks the mailbox `reconnect_required`; an unavailable Google or Inbox
  keeps the cursor, and each provider message is stored once.
- Security review (2026-10-21, accepted with fixes):
  - **H1:** a mailbox's conversations are assigned to its owner, never the record's
    holder, and a new thread matches only records the owner may see.
  - **H2:** a message too large or unreadable to use is skipped, so it cannot hold the
    cursor; only network and server errors wait for the next round.
  - **M1:** each inbound email stores its real sender, shown when it is not the contact.
  - **M2:** a new thread needs Gmail's `dmarc=pass` (top `Authentication-Results` from
    `mx.google.com`); an unauthenticated sender may only join a known thread and is shown
    as "Unverified sender: check before acting".
  - **M3:** only an authenticated `report-type=delivery-status` report with a permanent
    `Status: 5.x.x` fails a sent message; read receipts and delays change nothing.
  - **L1, L3:** a 401 mid-round keeps the cursor; a frozen team or a member without the
    email grant syncs nothing.
  - Follow-ups: per-round budgets (L2), send-as aliases (L4), and matching a bounce's
    `Original-Message-ID` once outbound Message-IDs are stored.

### Email sending (E1b, built 2026-10-20)

- `POST /inbox/conversations/{id}/messages` replies, `POST /inbox/conversations` starts a
  conversation with a Client or Contact the caller may see (Start message; the record's
  address comes from `records::recipient`), and `POST …/messages/{message}/again` sends a
  failed or unknown message again, once, as a new message with `repeatOf`.
- Only the Admin and staff with the email grant send, and only through their own
  connected mailbox; a reply goes only through the conversation's mailbox (O9). Spam and
  blocked conversations refuse sending.
- Each request queues the message and its outbox job in one transaction, under the
  workspace lock after the live-membership check. The worker re-checks the author's live
  membership, grant and mailbox ownership right before the call, marks the message
  `sending` and commits, then sends: `sent` with Gmail's message and thread IDs (a new
  conversation's `crm:` placeholder takes Gmail's thread ID); `failed` with a fixed code;
  `unknown` for a timeout, 5xx or unclear answer. A message left `sending` for two
  minutes reads as `unknown`. A refused token marks the mailbox `reconnect_required`.
- Mail is plain UTF-8 text with an encoded subject; `From` is left to Gmail; every header
  value is checked, so no input can add a header or recipient. Replies carry
  `In-Reply-To`/`References` once E1c stores inbound Message-IDs.

Email claims Sent, Bounced and Failed only. No read receipts, no tracking pixels and no
remote images in rendered mail; HTML is sanitised on display.

## 6. Matching and lead rules

Matching calls one new records-owned function,
`records::lookup::contact_matches(tx, workspace, phone_e164, email_lower)`, which returns
only `{collection, record_id, assignee_id}` candidates for Clients and Contacts in that
workspace. It does not return names, contact values or unrelated fields, and it does not
widen the caller's visibility. The Inbox renders a client panel only through the records
visibility functions. Leads are Clients with an open `Lead stage`; there is no separate
lead table and no separate match.

Normalisation:

- phone: strip spaces, dashes, dots and brackets; accept `+`, `00` and a leading `0`;
  a leading `0` or a bare national number uses the company's default region (AE unless
  the owner later chooses otherwise); invalid or too-short numbers never match;
- email: exact lower-case comparison; plus tags are significant; no fuzzy or name
  matching.

Outcomes:

- zero candidates → unknown contact, conversation waits for a person;
- one candidate → linked to that person, routed to their assignee;
- several candidates → the conversation opens a choice state; names never merge people;
- blocked `contact_key` → dropped silently before any conversation row is written.

Lead rules are evaluated only when the sender is unknown:

- a source marked as ad, listing link, lead form or portal enquiry creates the lead;
- at least two configured property words (English or Arabic) either suggests or creates,
  according to the Admin's `lead_mode`;
- anything else stays unknown;
- one message can never create two leads: `create lead` locks the conversation row,
  re-checks `linked_record_id` under the workspace lock and calls the records create
  function once;
- automatic leads are capped per connection and per sender per day; beyond the cap the
  conversation stays a suggestion for a person.

Linking a conversation to an existing client requires that the caller can see that record
through the records visibility functions; a hidden, foreign or malformed record ID returns
the same not-found response.

## 7. Webhooks

`POST /api/integrations/webhooks/{provider}` is public, has no CRM cookie, no CSRF token
and no workspace path. Controls:

1. bound the body (1 MiB), require the provider's content type and method;
2. verify the signature against the raw body before parsing JSON or form fields;
3. write the receipt row, deduplicated by provider event ID, and stage the verified event
   in an encrypted `integrations` row that the processor deletes after use and the
   receipt purge removes within 30 days;
4. answer `202` within one second and process asynchronously;
5. a verified event for a disconnected connection stores the receipt as `rejected` and
   drops it; a request that fails verification, or names no known connection, writes
   nothing and only increments a counter, so unauthenticated callers cannot fill tables;
6. raw payloads and headers are never logged; addresses and bodies exist only in the
   encrypted staging row until processed.

| Provider          | Verification                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twilio            | `X-Twilio-Signature` over the URL built from the configured public base address (D7), never from `Host` or forwarded headers, and the sorted POST parameters, with the connection auth token. Only `AccountSid` is read before verification, to choose the key. Dedupe key: `MessageSid` for inbound, `(MessageSid, MessageStatus)` for status callbacks. Signatures carry no timestamp, so replays rely on the dedupe key and forward-only status changes |
| Meta (FB / IG)    | `X-Hub-Signature-256` HMAC-SHA256 over the raw body with the app secret, constant-time compare; the `GET` `hub.verify_token` handshake also compared in constant time. Routing by Page ID is safe only because SEC-1 proves Page ownership at connect                                                                                                                                                                                                      |
| Google (Gmail)    | Pub/Sub push OIDC token verified against Google's keys: issuer, exact `aud` equal to the configured push URL, `email` equal to the configured service account with `email_verified`, and expiry. Dedupe key: Pub/Sub `messageId`                                                                                                                                                                                                                           |
| Microsoft (Graph) | `clientState` of at least 128 random bits per subscription, stored sealed and compared in constant time; each notification is only a hint and the message is fetched again through Graph. The `validationToken` is echoed as `text/plain` only                                                                                                                                                                                                             |
| TikTok            | The webhook signature header defined by TikTok's Business Messaging documentation, verified with the app client secret over the raw body in constant time, with a timestamp tolerance if the scheme carries one. The exact scheme is confirmed against current TikTok documentation in T1 before any intake is enabled. Account ownership is proven at connect (SEC-1) by reading the business account the token controls                                  |

A failed or missing signature returns `401` and writes no receipt. Each provider has one
forged and one replayed fixture test. Replays are accepted
but processed once because `(provider, event_id)` is unique. Callback URLs use D7's
public HTTPS address; the development tunnel is configured outside the repository.

## 8. Credentials and encryption

- Credentials are sealed with AES-256-GCM, 96-bit random nonce per write (the Calendar
  vault uses the same cipher without additional data). The additional authenticated data
  binds schema, table, `workspace_id`, `connection_id`, provider, channel and key version
  as length-prefixed parts, so a ciphertext cannot be moved between rows, companies or
  key versions. Credentials are sealed exactly as typed; surrounding spaces are refused.
- The key comes from `CRM_MESSAGING_KEY` (base64, 32 bytes) with
  `CRM_MESSAGING_KEY_VERSION`. A malformed key always refuses startup. A missing key
  refuses startup outside local development; locally it prints a warning and channel
  routes answer 503. There is no plaintext fallback. The key is never in Vite
  variables, the database, activity, logs or the frontend.
- Only `integrations` decrypts. Adapters receive plaintext in memory for one request.
  API responses return the label, channel, provider, state and timestamps only; the
  external account ID is masked to its last four characters, or fully when shorter than
  eight characters.
- Rotation uses a keyring: the current key and version plus retired keys
  (`CRM_MESSAGING_RETIRED_KEYS`, `version:base64` pairs) used only to open older rows,
  selected by `credential_key_version`. Startup fails if any stored version has no key.
  Re-seal on next successful use or with an operator command, then retire the old key.
  Built with the first packet that decrypts (W1). Disconnect deletes the sealed
  credential in the same transaction that sets `disconnected`.
- Account ownership is proven by the provider (SEC-1): the adapter uses the credential to
  read the account it controls (Twilio phone numbers under the Account SID, the Gmail or
  Graph profile address, Meta's Pages for the token) and stores that ID; the browser never
  supplies it. Reconnect proves the new credential opens the same stored account. Because
  only the account's controller can reach it, "This account is already connected to a
  company" is an acceptable answer and never names the company.
- OAuth providers (Google, Microsoft, Meta) use an exact redirect-URI allowlist, `state`
  bound to the session and PKCE. Refresh tokens are sealed like other credentials.
  Disconnect also revokes the token at the provider, best effort and retried through the
  outbox. Each member connects their own mailbox; the Admin approves it, and never sees or
  holds another member's mailbox credential.
- Hosted key custody (O1): before production the key moves to a managed secret store or
  KMS; the environment key is for local development only.
- Provider secrets stay out of job rows. The outbox stores the message UUID only; the
  worker reads the sealed credential through `integrations` functions.

### Google mailbox sign-in (E1a, built 2026-10-20)

- Scopes: `gmail.send` and `gmail.readonly` only; both are required, because Google lets a
  person untick one. The app is an **internal** Google app on the company's Workspace
  (decision O7), so these restricted scopes need no Google verification for now.
- `POST /mailbox/google/start` stores a request (migration 0038): a random 256-bit state
  kept only as a SHA-256 digest, a sealed PKCE verifier, the workspace, member and session,
  a ten-minute expiry and single use; at most five open requests per member.
- The redirect URI is derived from `CRM_APP_ORIGIN`, so it is always the one registered
  URI. The session cookie is `SameSite=Strict` and is absent on Google's redirect, so
  `GET /api/crm/integrations/google/callback` proves nothing: it hands `state` and `code`
  to the app in the URL fragment (never sent to a server) with `no-store` and
  `no-referrer`, and echoes only plain, bounded values; Google's error text never appears.
- The app posts both to `POST /mailbox/google/finish` with its session, Origin and CSRF.
  The request is consumed only by the same member, workspace and session, and the
  consumption commits before Google is called, so a code is tried once. The exchange uses
  the PKCE verifier; the address comes from the Gmail profile for that token, lower-cased
  and checked against `CRM_GOOGLE_WORKSPACE_DOMAIN` when set.
- A refused finish never revokes the new token: revoking ends the person's whole grant,
  which may serve a mailbox that is already connected. Disconnect (by the member or the
  Admin) clears the sealed token in its transaction and then revokes it, best effort.
- `CRM_GOOGLE_ENDPOINT` (a loopback stand-in for tests) is accepted only in local
  development, like `CRM_TURNSTILE_ENDPOINT`.
- Security review (2026-10-20, accepted with fixes, all applied):
  - **M1:** archiving, suspending, or removing a member's email grant disconnects their
    mailboxes in the same transaction (`integrations::departure`, called by `team`).
  - **L3:** every disconnect queues the sealed token in `crm_pending_revocations`; the
    API revokes after commit and the messaging worker retries up to eight times.
  - **M2:** a member may start five sign-ins per ten minutes, used or not.
  - **L1:** Google's answers are read in chunks and refused past 64 KiB.
  - **L2:** outside local development, `CRM_GOOGLE_WORKSPACE_DOMAIN` is required.
- Carried to later packets:
  - **E1b/E1c** re-check live membership and the email grant before every send or sync.
  - **E1c** keys mailboxes on Google's stable account ID (`sub`), so a renamed address
    keeps its mailbox (L4).
  - **E1d** reads the returned fragment once, removes it from the address bar and
    history, and never logs or stores it.
  - Other companies need their own Google settings before Google mail is offered to
    them (I3).
  - Hosted access logs must drop the callback's query string (I5).

## 9. Privacy, logging and retention

- Message bodies exist only in `crm_inbox_messages`; internal notes only in
  `crm_inbox_notes`; addresses only in `crm_inbox_conversations.contact_display`, the
  consent rows and the linked record.
- Server logs, job rows, webhook receipts, redacted events and the activity feed use IDs,
  channel, provider and outcome codes only.
- The CRM reads only conversations and threads that arrive through its connections; it
  never lists a mailbox, a Page's full history or other threads.
- Internal notes are never sent, rendered in client payloads or included in exports.

Retention (approved by the owner 2026-10-20, O2):

| Data                           | Proposed retention                                                    |
| ------------------------------ | --------------------------------------------------------------------- |
| Conversation, messages, bodies | 24 months after `last_activity_at`, then bodies purged, metadata kept |
| Internal notes                 | 24 months after creation                                              |
| Consent evidence               | While the linked client exists and 5 years after an opt-out           |
| Webhook receipts               | 30 days                                                               |
| Outbox jobs                    | 30 days after a terminal state                                        |
| Integration and inbox events   | 5 years                                                               |
| Blocked contacts               | While the block is active                                             |

Deleting a Client or Contact never deletes the conversation: it becomes "linked record
unavailable". An Admin can anonymise a conversation on a data-subject request by replacing
the display address, `contact_key`, bodies and any staged payloads, and lifting or
rewriting matching blocks; consent evidence stays. Insert-only event tables are purged
only by a separate retention database role that the immutability triggers allow. Backups
cannot remove purged rows, so backup copies expire within 35 days of a purge. Hosted
PostgreSQL sets `log_parameter_max_length_on_error = 0` so unique-violation details never
log account IDs. The periods are a product default; confirm them against UAE data
protection advice before launch.

## 10. Threat model

| Threat                             | Control                                                                                            | Residual risk                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Forged webhook                     | Signature verified over the raw body before parsing; per-provider rule §7                          | Provider secret compromise; rotate secrets                             |
| Replay                             | Unique `(provider, event_id)`; provider message IDs unique per conversation                        | Provider reuses an event ID for different content (monitored)          |
| Cross-company ID probing           | Workspace from the session, never from the body; hidden, foreign and malformed IDs share one 404   | Timing differences (kept uniform in queries)                           |
| Token theft from a database dump   | AES-256-GCM with AAD and an external key; credentials never returned or logged                     | Host compromise with the environment key; use hosted KMS before launch |
| Duplicate send                     | One live job per message, idempotency key, `unknown` instead of auto-resend                        | A person choosing Send again for a message that did arrive             |
| Provider outage                    | Bounded attempts, backoff, handshake timeouts, `unknown` state, retry by a person                  | Client receives a late message                                         |
| Oversized or malicious payload     | 1 MiB body cap, content-type checks, bounded parse depth, signature before parse                   | CPU spikes; rate-limit at the gateway                                  |
| HTML email XSS                     | Sanitise on display, block scripts, forms and frames, open links with `rel="noopener"`             | A missed sanitiser rule; keep a strict allowlist                       |
| Tracking pixels and remote images  | Blocked by default; render alt text and an explicit "Load images" choice                           | Sender learns nothing until the person chooses to load                 |
| Link previews and SSRF             | Do not fetch links server-side; no previews in v1                                                  | Phishing text stays visible; staff training                            |
| Log leakage                        | Log IDs and codes; tests assert no bodies, addresses or tokens appear in logs and job rows         | A future logging change; keep the test                                 |
| Enumeration through matching       | Match results never reveal names or existence outside the caller's scope; uniform errors           | Staff can infer a match exists by the routing outcome                  |
| Insider misuse                     | Admin-only connections and rules, separate reply permissions, redacted events, assigned-only scope | A malicious Admin; platform support does not read conversations        |
| CSRF and session theft             | Existing Origin, CSRF and `HttpOnly` session rules apply to every member route                     | Same as the rest of the CRM                                            |
| Message content as future AI input | Not now (D8); any future model receives only approved fields and never credentials                 | Owner data-handling decision pending                                   |

## 11. Authorization matrix

| Actor                                | Connect / disconnect | Read conversations            | Reply          | Internal note | Assign | Create/link lead | Edit rules |
| ------------------------------------ | -------------------- | ----------------------------- | -------------- | ------------- | ------ | ---------------- | ---------- |
| Company Admin                        | yes                  | company                       | yes            | yes           | yes    | yes              | yes        |
| Staff with the channel permission    | no                   | own or team per record scope  | yes            | yes           | own    | yes              | no         |
| Staff without the channel permission | no                   | own or team, read only        | no             | yes           | own    | yes              | no         |
| Assigned agent                       | no                   | own conversations             | per permission | yes           | own    | yes              | no         |
| Other staff (assigned-only scope)    | no                   | none                          | no             | no            | no     | no               | no         |
| Super Admin                          | no                   | none                          | no             | no            | no     | no               | no         |
| Provider (webhook)                   | no                   | none                          | no             | no            | no     | no               | no         |
| Worker / operator                    | no                   | job and receipt metadata only | n/a            | no            | no     | no               | no         |

Reply permission is the existing `channel_access.whatsapp` for WhatsApp and
`channel_access.email` for email. Facebook, Instagram and TikTok replies use the new
`channel_access.social` grant (O3). Reading with a permission but without the module grant follows the existing
records rule. No surface returns another company's data to the Super Admin; any later platform
health view is a separate, reviewed feature.

Email connections are made by the mailbox owner. The Admin's `channel_access.email` grant
is the approval (O8); the Admin can see and disconnect every company mailbox. Facebook, Instagram and TikTok replies use the separate
`channel_access.social` grant (O3), off by default.

## 12. Planned API surface

Member routes (all require the session, Origin and CSRF; versions on mutations):

| Route                                                     | Behaviour                                           |
| --------------------------------------------------------- | --------------------------------------------------- |
| `GET/POST /workspaces/{ws}/channels`                      | List connections; connect through the provider stub |
| `POST /workspaces/{ws}/channels/{id}/reconnect`           | Re-run the provider authorization                   |
| `DELETE /workspaces/{ws}/channels/{id}`                   | Disconnect, delete credentials, keep history        |
| `GET /workspaces/{ws}/inbox/conversations`                | Keyset-paged list with filters and tabs             |
| `GET /workspaces/{ws}/inbox/conversations/{id}`           | Conversation, messages, notes and linked summary    |
| `PATCH /workspaces/{ws}/inbox/conversations/{id}`         | State or assignee with `expectedVersion`            |
| `POST /workspaces/{ws}/inbox/conversations/{id}/read`     | Mark read to a message                              |
| `POST /workspaces/{ws}/inbox/conversations/{id}/messages` | Send or save a draft; checks consent and window     |
| `POST /workspaces/{ws}/inbox/conversations/{id}/notes`    | Internal note                                       |
| `POST /workspaces/{ws}/inbox/conversations/{id}/lead`     | Create lead and link the conversation               |
| `POST /workspaces/{ws}/inbox/conversations/{id}/link`     | Link to an existing client                          |
| `POST /workspaces/{ws}/inbox/conversations/{id}/resolve`  | Mark not a lead                                     |
| `POST /workspaces/{ws}/inbox/conversations/{id}/block`    | Block the sender                                    |
| `GET/PUT /workspaces/{ws}/inbox/rules`                    | Read rules; Admin update with version               |

Public: `POST /api/integrations/webhooks/{provider}` (§7).

## 13. Open decisions

Blocking the named packet:

| ID  | Decision                                                                                        | Blocks        |
| --- | ----------------------------------------------------------------------------------------------- | ------------- |
| D2  | Decided 2026-10-29: each member connects their own number; the owner keeps theirs (coexistence) | W1 live check |
| D4  | Revised 2026-10-21: SendGrid first (E3); Google Workspace adapter (E1) built and kept           | E3            |
| D5  | Facebook Page and Instagram first                                                               | S1            |
| D6  | Meta Business Portfolio, Page and app verification                                              | S1            |
| D7  | Public HTTPS address for webhooks                                                               | W2            |
| D9  | TikTok Business Account and Business Messaging API access (TikTok approval and UAE eligibility) | T1            |

Design decisions (decided by the owner 2026-10-20, following the review's recommendations):

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O1  | Environment key (with the §8 keyring) for local development only; a managed secret store or KMS is required before any production deployment.                                                                                                                                                                                                                                              |
| O2  | The §9 retention periods, with the §9 purge, anonymisation and backup rules; confirm against UAE data protection advice before launch.                                                                                                                                                                                                                                                     |
| O3  | A separate `channel_access.social` grant for Facebook, Instagram and TikTok replies, off by default and managed like the existing WhatsApp and email grants. Added in S1.                                                                                                                                                                                                                  |
| O4  | Yes: redacted connection and Inbox events appear in Team activity through an `integrations`/`inbox` page function merged by `activity/`, like `records::activity::page`. Built in packet X1a (2026-10-20) for connection events; Inbox events follow with X3.                                                                                                                              |
| O5  | Yes: media messages show "Media received" until private media storage exists.                                                                                                                                                                                                                                                                                                              |
| O6  | Default phone region AE for every company now; a per-company region setting is added when the first company outside the UAE needs it.                                                                                                                                                                                                                                                      |
| O7  | Google mail uses an **internal** Google app: only mailboxes on the company's own Google Workspace connect, with no Google review. Personal Gmail and other companies wait for Google's restricted-scope security assessment, without rebuilding. Recommended by Claude and accepted by the owner on 2026-10-20 (the owner asked for a recommendation); change it before go-live if needed. |
| O8  | The Admin's per-person `channel_access.email` grant is the approval for that person's mailbox (replacing a separate approval step in §11). The Admin connects their own mailbox; staff with the grant connect theirs; the Admin can still see and disconnect every company mailbox. The Super Admin never holds a company mailbox.                                                         |
| O9  | An email reply goes out only through the mailbox its conversation belongs to, and only its owner sends from it: no one sends as another person. Others see the conversation and add notes. Recorded 2026-10-20 with E1b.                                                                                                                                                                   |

## 14. Boundary decisions

Recorded in the [service-boundaries decision log](service-boundaries.md#decision-log-accepted-cross-domain-couplings)
as D7–D10: records-owned matching, outbox-only job rows, integrations-only credential
access, and the public webhook prefix. No change adds a foreign key into a CRM table or a
direct read of another module's tables.
