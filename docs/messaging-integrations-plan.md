# Messaging integrations plan: WhatsApp, email and social Inbox

Owner request, 20 October 2026. Client messages from WhatsApp, email, Facebook and Instagram arrive in one shared Inbox, go to the right lead or client, and staff send and reply from the CRM. Sending to clients is the main goal; unrelated messages must not become leads.

Status 2026-10-20: **X0 is approved** — the [messaging design](messaging-design.md) passed its separate [security review](messaging-security.md) and the owner decided O1–O6. **X1, X1a and X2 are built and reviewed** (X1a: channel events in Team activity, decision O4; X2: verified webhook intake, sealed staging, the outbox and the messaging worker). **X3a is built** (Inbox tables, sender normalisation, matching, lead rules, routing and intake from the worker). **X3b is built** (staff API: list with keyset paging and filters, read with messages, notes and the linked record, mark read, assign/claim/release, state changes, internal notes). **X3c is built** (Create lead, Link, Not a lead, Block/Unblock, lead-rules API, frontend client `src/services/crm/inbox.js`), after a separate security review (docs/messaging-security.md, X3). **U1 is built** (2026-10-20, reviewed by the product designer): the `/inbox` route replaces Messages in the connected sidebar with an unread badge; list with search, Mine/Unassigned/Team/Spam tabs with counts and channel and state filters; conversation with bubbles, statuses, internal notes, state and assignment controls, connection banners and an honest Reply notice; client panel with record facts and what is coming up; phone screens, empty, loading and error states, 10-second polling while visible, keyboard navigation, Arabic right-to-left and both themes. Deferred to the sending packets (E1, W1): sending replies, templates and quick replies, drafts, and failed-send and status-unknown recovery. **U2 is built** (2026-10-20, reviewed by the product designer): a new-contact review bar (Create lead, Link to existing client, Not a lead, Block sender with a confirmation, and an Admin-only Unblock); the Create lead panel is prefilled with the sender's name and their messages as notes for a person to check (the API now accepts edited notes up to 2000 characters); Link searches the workspace's clients and contacts; the Admin-only `/inbox-rules` screen edits lead sources, English and Arabic property words and the suggest/create choice, saved with versions. The Inbox page heading was removed at the owner's request so the conversation has the full height; the heading stays for screen readers. **E1a is built** (2026-10-20): each member connects their own Google Workspace mailbox with Google sign-in (state bound to the session, PKCE, both mail scopes required, Workspace-domain check, sealed refresh token, revoke on disconnect); decisions O7 (internal Google app, company Workspace addresses only) and O8 (the Admin's email grant is the approval); owner setup steps in [Google mail setup](google-mail-setup.md). **E1b is built** (2026-10-20): replies, Start message and Send again through the author's own mailbox (O9), sent by the messaging worker with the no-duplicate rule (sending → sent, failed or unknown), Arabic subjects, header checks and a reconnect state when Google refuses the token. After its security review: the reply side retries only before Google could accept, only `invalid_grant` marks a mailbox for reconnecting, a block or Spam after queuing stops the send, and unknown worker loops refuse to start. **E1d is built** (2026-10-20, reviewed by the product designer): Settings → My mailbox (connect, sign in again, disconnect), the `/oauth/google` return page that clears the code from the address bar, the Reply composer for the member's own mailbox with honest notices otherwise, Sending/Send again in the thread (with a confirmation when the outcome is unknown) and New email from the Inbox list. A local Google stand-in (`npm run dev:google`) lets the owner try it before the real Google app exists. **E1c is built** (2026-10-20): the messaging worker reads each connected mailbox's Gmail history every 30 seconds from the moment it connects (no older mail); only mail in a thread the CRM knows, or from an address that matches a Client or Contact, is fetched past its headers and stored, as plain text (HTML reduced to text, quoted mail folded in the thread, attachments shown as Media received); bounces fail the sent message; the member's own Gmail-sent mail is skipped; replies thread with In-Reply-To/References. Pub/Sub push replaces polling once the public HTTPS address exists (D7). Next: W1 (WhatsApp, after D1, D2 and D6). D2 and D4–D7 still block their packets.

**Owner decision 2026-10-20: Claude implements every packet directly; no packets are assigned to DeepSeek.** The packet order, rules, tests and acceptance below still apply, with Claude as implementer and a separate security review for sensitive packets. The owner approves commits and pushes.

This plan follows the [DeepSeek delivery workflow](deepseek-delivery-plan.md): DeepSeek implements **one packet at a time** with its tests; the reviewer (Claude or Codex) checks the diff, security and workspace boundaries and runs the checks; the owner approves each commit. All rules in §1 of that plan apply to every packet here (150-line files, connected mode only, English and Arabic catalogues, logical CSS, synthetic test data, one owner per table, no commits by DeepSeek).

Design reference: the **CRM Inbox design** canvas (8 screens, https://claude.ai/artifact/7gCey1sfjsATtoAw3P2hrY), **approved by the owner on 2026-10-20**. It uses the current forest-green and gold theme and `docs/design-standards.md`. Build to it; any change to it needs owner approval first. One approved change: on the Connections artboard, TikTok gets its own card (TikTok Business, "Connect TikTok", needs a TikTok Business Account and TikTok's Business Messaging approval) in place of the "TikTok, LinkedIn and others · Later" card, with LinkedIn and others noted as later. The canvas itself still shows the old card and must be updated in the canvas editor. The X1 Channels screen is an interim form; it is rebuilt to the Connections artboard as each real provider lands (E1, W1, S1, T1).

## 1. Decisions

| #   | Decision                          | Status (20 Oct 2026)                                                                                                           |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| D1  | WhatsApp provider                 | **Twilio first** (recommended, agreed in discussion). Meta direct can replace it later behind the same adapter.                |
| D2  | WhatsApp number                   | Open: keep the current number (only if Twilio supports coexistence in the UAE) or a new dedicated number.                      |
| D3  | One number per company            | Recommended yes; each company connects its own number through its own Twilio subaccount.                                       |
| D4  | Business email system             | **Google Workspace (owner, 2026-10-20).** E1 builds the Gmail adapter first; Microsoft 365 can follow behind the same adapter. |
| D5  | Social platforms first            | Facebook Page and Instagram first; **TikTok added to the Channels registry by the owner on 2026-10-20** (messaging in T1).     |
| D6  | Meta Business Portfolio and Page  | Owner to create; verification can run in parallel and is needed for higher limits and for serving other companies.             |
| D7  | Public HTTPS address for webhooks | Secure tunnel for development; production depends on the hosting decision.                                                     |
| D9  | TikTok messaging access           | Open: TikTok Business Account plus Business Messaging API approval; confirm UAE eligibility. Blocks T1 only.                   |
| D8  | AI sorting of messages            | Not now. Needs an owner data-handling decision first; rules plus staff review are used until then.                             |

Nothing in this plan sends to real clients during development. Every provider is proved first with a local stub, then the provider's sandbox or test number.

## 2. Product rules (apply to every packet)

1. **Company isolation.** Every connected account, conversation, message, contact match and job belongs to exactly one workspace. A provider account (number, mailbox, Page) can be registered to only one company. Workspace A can never read or reply in workspace B's conversations, including through forged IDs.
2. **Inbox before leads.** An inbound message never creates a lead by itself unless a lead rule allows it (§2.3). Unknown senders wait in the Inbox for a person to choose: **Create lead**, **Link to existing client**, **Not a lead**, or **Block**.
3. **Lead rules** (per company, editable by the Admin):
   - Existing client or lead, matched by **exact** normalised phone (E.164) or email in the same company: join that person's conversation; go to their agent; no new lead.
   - Arrived from our ad, listing link, lead form or a property portal email: create the lead automatically.
   - First message contains at least two property words (English and Arabic list, editable): **suggest** a lead (default) or create it straight away (Admin choice).
   - Several clients share the phone or email: ask staff to choose. Names alone never merge people.
   - Blocked numbers and addresses: drop silently; never shown.
4. **Routing:** agent of the source listing or ad → client's assigned agent → the company's **Unassigned** queue (Admin plus staff allowed to pick up conversations).
5. **Sending rules:**
   - WhatsApp free-form text only inside the 24-hour customer-service window; outside it, only approved templates. The composer shows the window state.
   - Consent is recorded per client and channel; opt-outs stop sends immediately.
   - Email sends from the person's own connected mailbox, in the same thread.
   - Bulk sending is out of scope until a later packet (consent review, spending limit, per-recipient jobs).
6. **Honest statuses:** Queued, Sent, Delivered, Read (WhatsApp only), Failed with a plain reason, and **Status unknown** when the provider outcome is unclear. Email never claims Read. A send is never retried automatically in a way that can duplicate it.
7. **Privacy:**
   - Message bodies, recipient addresses, tokens and provider payloads never enter activity logs, job rows or server logs.
   - Provider access tokens are encrypted at rest.
   - The CRM reads only client conversations and replies to CRM emails, never a whole mailbox.
   - Internal notes are never delivered to clients.
8. **Permissions:** only the company Admin connects or disconnects channels and edits lead rules. Replying uses the existing separate WhatsApp and email permissions (`channel_access`). Staff without them can read but not reply. The Super Admin manages platform settings and does not read company conversations.

## 3. Packet order

| Order | Packet                                   | Outcome                                                                      | Needs from owner |
| ----- | ---------------------------------------- | ---------------------------------------------------------------------------- | ---------------- |
| 0     | X0 Architecture and security design      | Approved data model, module ownership, webhook security and threat review    | Review           |
| 1     | X1 Channel connections registry          | Admin connects/disconnects accounts; encrypted tokens; Channels screen       | None (stubs)     |
| 2     | X2 Inbound receipt and delivery worker   | Verified, deduplicated webhooks and outbound jobs with leases and retries    | None (stubs)     |
| 3     | X3 Conversation kernel and contact match | Conversations, messages, notes, exact matching, routing and lead rules (API) | None             |
| 4     | E1 Email sending and client replies      | Send from the CRM through the connected mailbox; replies thread back         | D4 decided       |
| 5     | W1 WhatsApp sending through Twilio       | Free-form within window, templates outside it, consent, statuses             | D1, D2, D6       |
| 6     | U1 Inbox screens                         | The designed Inbox: list, conversation, client panel, mobile, states         | Design approved  |
| 7     | U2 New-contact review and Inbox rules    | Create lead / link / not a lead / block, and the Inbox rules screen          | None             |
| 8     | W2 WhatsApp inbound                      | Client WhatsApp messages arrive, match and route                             | D7               |
| 9     | S1 Facebook Page and Instagram           | Page and Instagram messages and lead forms into the Inbox                    | D5, D6           |
| 9b    | T1 TikTok business messages              | TikTok direct messages into the Inbox, with permitted replies                | D7, D9           |
| 10    | E2 Portal enquiry emails                 | Property portal enquiry emails create leads automatically                    | Portal samples   |

U1 can start in parallel with E1/W1 once X3's API contract is fixed, because U1 uses the API, not the providers.

## 4. Packets

### X0 — architecture and security design (documentation only)

Specialists: senior architect and security engineer, reviewed separately. No code.

1. Write `docs/messaging-design.md`:
   - module ownership: new modules `integrations/` (connections, provider adapters, webhooks), `inbox/` (conversations, messages, notes, read state, matching, rules) and `outbox/` (job leases, shared with later notifications), each with its own PostgreSQL schema per the owner decision on new large modules;
   - every table and its owner; how matching uses the records module's functions (no direct reads of `crm_records`);
   - the webhook route prefix (`/api/integrations/webhooks/...`, no CRM cookies) and signature verification per provider;
   - token encryption (key from the environment, rotation plan);
   - the status model and the no-duplicate-send rule;
   - retention of message content.
2. Threat model: forged webhooks, replay, cross-company IDs, token theft, oversized or malicious payloads, HTML email (sanitising), link previews, and provider outages.
3. Authorisation matrix: Admin, staff with and without channel permission, assigned agent, Super Admin.
4. Decision-log entries in `docs/service-boundaries.md` for any coupling.

**Acceptance:** the owner approves the design; the security review lists no open high-severity issues.

### X1 — channel connections registry

1. Tables (owned by `integrations/`): connections (workspace, channel, provider, external account ID, display label, status, encrypted credential, created/updated by, version) with a unique external account per provider across all companies.
2. Admin-only, CSRF-protected API: list, connect (provider stub in development), reconnect, disconnect. Disconnect stops intake immediately and keeps history.
3. A provider-adapter interface with a **local stub provider** used by tests.
4. Frontend client `src/services/crm/integrations.js` and the **Channels** settings screen exactly as designed (Connections artboard): cards per channel, health, reconnect banner, disconnect confirmation.
5. Redacted activity: connected / disconnected / reconnect needed (no tokens, no addresses).

**Tests:**

- API: Admin-only access; a second company cannot register the same external account; forged workspace and connection IDs return not-found; disconnect is idempotent; tokens are never returned or logged.
- Unit: credential encryption round trip.
- Browser: Channels screen at 390px and 1280px, both themes.

### X2 — inbound receipt and delivery worker

1. Public webhook endpoint per provider: verify the provider signature before parsing, bound the body size, store a receipt (provider, event ID, connection, received time) and answer fast; process asynchronously.
2. Deduplicate by provider event ID; unknown connection → stored as rejected, no processing.
3. Outbound job table with leases, `FOR UPDATE SKIP LOCKED`, capped attempts, backoff with `Retry-After`, terminal states and **unknown outcome** handling (never auto-resend after a timeout without provider confirmation). Reuse the patterns proven in `signup/jobs/` and `signup/worker.rs`.
4. Graceful shutdown (already in `shutdown.rs`) waits for in-flight jobs.

**Tests:** bad or missing signature → 401 with no receipt row; replayed event processed once; two workers never own one job; restart resumes; a timeout leaves "status unknown" and no second send; logs and job rows contain no bodies, addresses or tokens.

### X3 — conversation kernel, contact matching and lead rules (API)

1. Tables (owned by `inbox/`): conversations (workspace, channel, connection, external thread ID, linked record, assignee, state New/Open/Waiting/Resolved/Spam, first source, last activity, version), messages (direction, provider message ID, status, author, timestamps; body stored only here), internal notes (separate table), read state per member, blocked contacts, lead rules per workspace.
2. Matching: normalise phone to E.164 and email to lower case; exact match against Clients/Leads/Contacts **through records module functions**; zero → unknown contact; one → link; several → needs staff choice.
3. Lead rules and routing as in §2.3–§2.4. A suggested lead is a flag on the conversation, not a record.
4. API: list conversations (scoped by assignment and permissions, keyset pagination), read one, mark read, assign, change state, add internal note, create lead from conversation, link to client, mark not a lead, block/unblock, get/update rules (Admin).
5. Visibility follows the existing record scope: assigned-only staff see their conversations; whole-team staff see the team's; Admin sees all in the company.

**Tests:**

- Matching: exact phone/email, normalisation (spaces, +971/00971/0 prefixes), several matches → choice, names never merge.
- Rules: ad source → lead; two property words → suggestion; one word → nothing; Arabic words; blocked → dropped.
- Access: assigned-only staff cannot list or open others' conversations; foreign IDs → not-found; notes never appear in client-facing payloads.
- Concurrency: two staff creating a lead from the same conversation → one lead.

### E1 — email sending and client replies (Google Workspace, D4 decided 2026-10-20)

Split into E1a (mailbox sign-in, built 2026-10-20), E1b (sending from the composer and a
Start message action), E1c (replies into the Inbox by polling Gmail history; Pub/Sub push
waits for the public HTTPS address, D7) and E1d (My mailbox and Channels screens, the
`/oauth/google` return page and the composer). The Google app is internal to the
company's Workspace (O7), so the restricted-scope verification gate applies only when
other companies or personal Gmail join.

1. Mailbox connection per person with the narrowest scopes: send, plus reading only threads the CRM started or that come from linked clients. Plan Google's restricted-scope verification (or Microsoft's admin consent) as an external gate.
2. Send from the composer through the person's mailbox; keep the thread ID; status Sent / Bounced / Failed.
3. Replies to CRM threads arrive as inbound messages (push notification plus history fetch for Google; subscription for Microsoft).
4. HTML email is sanitised on display; quoted text folds; attachments stay disabled until private storage exists.

**Tests:** stub provider send, thread continuity, bounce handling, sanitising (scripts, tracking pixels, remote images blocked by default), no mailbox content outside linked threads stored, token expiry → "Reconnect" state.

### W1 — WhatsApp sending through Twilio (after D1, D2, D6)

1. Twilio adapter behind the provider interface; one Twilio subaccount per company; credentials in the connection record.
2. Template sync (approved/pending/rejected) and template sending with variables filled from the client record; free-form only inside the 24-hour window.
3. Consent per client and channel (opt-in time and source); opt-out keywords (STOP and Arabic equivalent) honoured automatically.
4. Status callbacks update Queued → Sent → Delivered → Read / Failed with a plain reason.
5. Wire the existing WhatsApp composer (`docs/messaging-preview.md`) to real sending for a single client; bulk stays disabled.

**Tests:** window open → free text allowed; closed → only templates; no consent → send refused with a clear message; opt-out stops further sends; status callback signature verified; Twilio sandbox proof recorded (not in CI).

### U1 — Inbox screens (design approved 2026-10-20)

Specialists: product designer plus frontend engineer (owner rule: every UI change involves the designer).

1. Route `/inbox` replaces the Messages preview in the sidebar, with an unread badge.
2. Three-panel desktop layout from the Main and EmailThread artboards: conversation list (search; Mine, Unassigned, Team, Spam tabs; channel and state filters), conversation (bubbles, statuses, system events, internal notes, composer with Reply/Internal note, window indicator, templates, quick replies, autosaved drafts), client panel (linked record summary, consent, coming up, actions).
3. Mobile from the MobileList and MobileTemplate artboards: list → conversation → client details as separate screens; bottom sheet for templates.
4. All states from the States artboard: empty (no channels / all caught up), skeleton loading, failed send with recovery, status unknown, disconnected channel, no permission to reply.
5. Live updates by polling first (every 10 seconds while visible); WebSockets later.
6. Keyboard: arrow keys move through the list, Enter opens, Escape returns; screen-reader announcements for new messages; right-to-left mirroring; both themes.

**Tests:** unit tests for list models and composer window logic; browser scenarios: open conversation, reply, add note (never shown as sent), template flow when the window is closed, failed send and retry, mobile navigation at 390px, dark and light themes, Arabic layout.

### U2 — new-contact review and Inbox rules (built 2026-10-20)

1. New-contact banner and Create lead panel from the DesktopTriage artboard; details found in messages are prefilled for a person to check.
2. Inbox rules screen from the LeadRules artboard (Admin only), including the property-word list and the suggest/create choice.

**Tests:** create lead links the conversation and keeps first source; link to existing client; not a lead moves to Resolved; block hides future messages; rules save with versions; staff cannot edit rules.

### W2, S1, T1, E2

- **W2 — WhatsApp inbound:** Twilio inbound webhook → receipt → matching → routing; media messages shown as "Media received" until private storage exists.
- **S1 — Facebook Page and Instagram:** Meta app with the needed messaging and lead permissions, Page selection during connect, the 24-hour/7-day messaging windows, lead-form entries → automatic leads. Development mode with the owner as app admin until Meta app review passes.
- **T1 — TikTok business messages:** TikTok for Business app with Business Messaging access, account selection during connect (ownership proven from the token), webhook signature per TikTok's current documentation, the platform's reply-window rules, and replies under `channel_access.social`. Development with the owner's test account until TikTok approves the app.
- **E2 — portal enquiry emails:** parsers for each portal's enquiry email format, built from real sample emails the owner provides, with names and numbers replaced by synthetic data; unknown formats fall back to the Inbox.

Each follows the same test pattern: stub provider, signature checks, dedupe, matching, access and no secrets in logs, then a sandbox proof.

## 5. How each packet is tested

1. DeepSeek runs the packet's focused unit and API tests on the disposable Docker database, plus the formatting, line-limit, boundary and translation checks.
2. The reviewer reads the diff first, traces browser → API → database, tries forged workspace, conversation and connection IDs, checks logs and job tables for message bodies, addresses and tokens, then runs the focused checks and `npm test` and `npm run build`.
3. Sensitive packets (X0–X3, E1, W1, S1) also get a separate security review before approval.
4. The owner tries the feature in the running app (`npm run dev:api` and `npm run dev`) before approving the commit.
5. After the push, CI runs the full API and browser suites.
6. Provider sandbox proofs (Twilio test number, Google or Microsoft test mailbox, Meta development mode) are recorded in the packet's design notes; they are never part of CI.

## 6. DeepSeek prompt template

Use the template in [§13 of the delivery plan](deepseek-delivery-plan.md#13-deepseek-task-prompt-template). For each packet, fill in the goal, read-first list (this document, `docs/messaging-design.md` once X0 exists, the design canvas for UI packets), exact allowed write paths, non-goals, the packet's steps and its tests from §4 above.
