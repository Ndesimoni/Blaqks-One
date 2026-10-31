# Blaqks One implementation plan for DeepSeek delivery

**UI assignment update, 2026-10-24:** the owner now requests a whole-product UI plan and
DeepSeek handoff. For that scope, use the [UI redesign plan](ui-redesign-plan.md) and
[UI0 prompt](deepseek-prompts/UI0-ui-redesign.md), not the historical implementer note or
packet queue below. Current English-only rules supersede this document's old Arabic/RTL
instructions. This update prepares a UI assignment; it does not authorize unrelated
feature implementation, deployment or external delivery.

**Owner decision 2026-10-20: Claude implements every packet directly; no packets are assigned to DeepSeek.** The packet order, rules, tests and acceptance below still apply, with Claude as implementer and a separate security review for sensitive packets. The owner approves commits and pushes.

Owner workflow, 19 October 2026. This plan turns the approved roadmap into small implementation packets. DeepSeek may implement one packet and its focused tests. Codex then reviews the diff, verifies the security and workspace boundaries, runs the agreed checks and approves or returns the packet for correction.

## 1. Rules for every packet

1. Start from a reviewed, committed checkpoint. Do not stack new work on an unknown or failing diff.
2. Give DeepSeek one packet only. Include exact allowed files, non-goals and acceptance checks.
3. Keep every handwritten code, test and configuration file at 150 physical lines or fewer.
4. Build only connected mode. Do not add demo features or demo tests.
5. Preserve workbook keys, browser storage, backups and existing API contracts unless the packet includes an explicit migration.
6. Keep every record, report, export, message and recipient inside its authorized workspace.
7. Use one owning backend module per table. Other modules call its functions rather than querying its tables.
8. Use English and Arabic catalogues for all new UI text and logical CSS properties for right-to-left layouts.
9. Use fictional synthetic data in tests and the disposable Docker database. Never test against development or user data.
10. DeepSeek must report changed files, checks, failures, assumptions and remaining work. It must not commit.
11. Codex reviews and tests before the next packet begins. The owner authorizes commits.

## 2. Priority order

| Order | Product outcome                                 | Why it is here                                                                                             |
| ----- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0     | Stable universal-company baseline               | Current sign-up, Team and three-seat work must be reliable before more features land.                      |
| 1     | Field hints and commission calculator           | Small, useful improvements that exercise the language and design foundations with low risk.                |
| 2     | UAE calculators                                 | Valuable daily tools with no cross-company or provider risk.                                               |
| 3     | Durable jobs, sign-up outbox and Turnstile      | Shared reliability and abuse protection needed before hosted sign-up, notifications and external delivery. |
| 4     | Production account security                     | Real email delivery, recovery, Admin MFA, legal text and restricted support access are launch blockers.    |
| 5     | Cross-company agreement foundation              | Creates the secure evidence model for handovers, co-broking and commission promises.                       |
| 6     | Registered-company agreements and certificates  | Delivers the main Blaqks One differentiator for Admins and agents in different companies.                  |
| 7     | Deal-room chat                                  | Adds participant-only communication to an agreement without exposing private CRM records.                  |
| 8     | External-agent agreement links                  | Lets named recipients outside Blaqks One accept with verified contact details.                             |
| 9     | Internal messaging and notifications            | Adds company channels, direct messages and a shared notification model.                                    |
| 10    | Private media, publication and public enquiries | Enables approved listings, the shared website and safe lead routing.                                       |
| 11    | Email, WhatsApp and Calendar integrations       | Uses the durable delivery and messaging foundations with one provider at a time.                           |
| 12    | Production operations and scaling               | Deployment, backups, monitoring, pagination and measured Redis adoption.                                   |

AI, video calls, customer mobile, social lead agents and the developers module follow these foundations.

## 3. Packet B0 — stabilize the current baseline

### DeepSeek implementation steps

1. Inventory the current diff and map every new sign-up, company, Team and language file to the relevant documentation.
2. Remove or retire the obsolete individual-account choice, switching UI, routes and test expectations. Keep compatibility fields only where a migration or stored contract still needs them.
3. Update sign-up expectations to the three-step flow: Details, Verify email, Set up company.
4. Update Team expectations to three total Free seats, with owner, active teammates and live invitations consuming seats.
5. Confirm that Super Admin seat-limit changes are the only exposed limit mutation and that the system workspace remains unlimited.
6. Preserve the two fixes already made: valid seat-usage SQL and the Team toolbar loading guard.
7. Reconcile security, sign-up, backend and roadmap documentation with the universal-company decision.

### DeepSeek checks

- Focused signup model and Team unit tests.
- Focused signup and team-limit API tests on disposable PostgreSQL.
- One connected browser flow covering signup, company setup and Team loading.
- `cargo fmt`, CRM Clippy, `npm run build`, `npm run check:i18n`, `npm run check:boundaries`, `npm run check:lines` and `git diff --check`.

### Codex acceptance

- Review migration 0025 for existing-seat preservation.
- Re-run the Team page through browser, API and database boundaries.
- Confirm no individual-mode navigation or account-switch action remains reachable.
- Review the final diff and obtain owner approval before the baseline commit.

## 4. Packet Q1 — field hints foundation

### DeepSeek implementation steps

1. Add a server-owned `guidance_enabled` preference for connected members, defaulting to true for new accounts.
2. Expose it through the authenticated account profile and a CSRF-protected preference update.
3. Add one reusable `FieldHint` component with focus, typing and information-icon behavior.
4. Add central English and Arabic hint catalogues. Do not place hint sentences directly in form components.
5. Add hints first to the most difficult Client, Property, Deal and Payment fields.
6. Add the switch in My profile and keep the information icon available when automatic hints are off.
7. Use `aria-describedby`, keyboard focus, logical spacing and both themes.

### Acceptance

- The preference survives reload and applies only to the signed-in member.
- Hints disappear after typing, can be reopened and are announced by screen readers.
- No workbook or saved-record field changes occur.
- English, Arabic, right-to-left, mobile and dark mode pass focused checks.

## 5. Packets Q2–Q6 — calculators

Build one calculator per packet so formula review remains clear.

### Q2 — commission preview

1. Locate the current Rust finance calculation and `apps/crm/src/lib/finance/commission.js` mirror.
2. Extract shared client selectors rather than copying formulas into the component.
3. Place an accessible live preview beside Deal commission and share fields.
4. Show gross commission, brokerage share, agent share, referral/co-broker share, VAT and net amount.
5. Keep server results authoritative for saved deals.
6. Add golden cases that compare client output with the Rust cases, including rounding to fils.

### Q3 — VAT, DLD and agency fee

Use pure functions, configurable price and fee inputs, the UAE 5% VAT default, the approved DLD default and clear text that defaults can be edited.

### Q4 — mortgage repayment

Support principal, rate, term, down payment and monthly repayment. Define zero-rate and invalid-term behavior explicitly.

### Q5 — rental yield and ROI

Separate gross yield, net yield, annual costs and cash invested. Do not present estimates as guaranteed returns.

### Q6 — off-plan payment schedule

Allow milestone percentages and dates, require totals to equal 100%, and export a readable schedule without mutating a property unless a later packet approves persistence.

### Acceptance for every calculator

- Pure formula tests cover zero, boundary, rounding and invalid inputs.
- AED, percentages and dates use the selected locale.
- No database write occurs unless the packet explicitly adds a stored business record.
- Mobile, keyboard, dark theme, English and Arabic states are checked.

## 6. Packet R1 — durable sign-up delivery worker

This packet adds reliability but does not enable live sign-up or contact a real provider.

### DeepSeek implementation steps

1. Add lease, attempt, retry, terminal-state and redacted-error fields for sign-up delivery jobs.
2. Keep sign-up as the owner of sign-up message data. A shared jobs module may own generic leases, but generic job rows store only a domain and object ID, never codes, addresses or rendered bodies.
3. Change start and resend handlers to commit the pending request and outbox job, then return `202` without calling a provider in the request path.
4. Claim work with `FOR UPDATE SKIP LOCKED`, bounded concurrency and expiring leases.
5. Use the outbox UUID as the stable idempotency key. A retry must not generate a new verification code.
6. Retry transport errors, `429` and `5xx` with bounded exponential backoff and jitter. Respect `Retry-After`.
7. Stop at code/request expiry. Mark permanent `4xx`, cancellation and expiry as terminal states.
8. Coordinate resend with leased work so an old code cannot be delivered after replacement.
9. Run the current guarded development outbox through the same worker path.
10. Clear plaintext codes after provider acceptance, cancellation, expiry or terminal failure.
11. Recover abandoned leases on restart and shut down gracefully.

### Acceptance

- The signup API succeeds while the worker is stopped.
- Restarting resumes the queued job once.
- Two workers cannot actively own the same job.
- Resend never delivers a superseded code.
- Logs, activity and generic job rows contain no code, email address, body, token or credential.
- `CRM_SIGNUP=live` remains rejected.

### Status (2026-10-19)

Built: migrations 0027 and 0028, `signup/jobs/{claim,deliver}.rs`, `worker.rs`, `retry.rs`, lease-aware cleanup, and the start/resend `202` contract. The worker tests prove lease exclusivity, restart resumption, retry backoff, the attempt cap and terminal/permanent handling; the delivery tests prove success clears the code, supersession never sends, and a permanent failure stores no code. `CRM_SIGNUP_WORKER=off` keeps API suites inspecting pending codes. See `docs/sign-up-design.md` §19.

## 7. Packet R2 — trusted client limits and Cloudflare Turnstile

### DeepSeek implementation steps

1. Obtain the real socket peer with Axum `ConnectInfo`.
2. Accept a forwarded client-IP header only when the socket peer belongs to an explicit trusted-proxy allowlist.
3. Reject duplicate or malformed forwarded values. Store only a keyed digest of the canonical address.
4. Add separate per-client budgets for signup start/resend, wrong verification attempts and successful company creation.
5. Run the cheap client budget before Turnstile. Keep successful company creation limits inside the creation transaction.
6. Replace the synchronous bot interface with an asynchronous adapter.
7. Add a `reqwest` rustls Siteverify client with a fixed endpoint, short timeout, bounded response and bounded concurrency.
8. Require success, exact action, exact hostname and a challenge no older than five minutes. Fail closed on timeout or malformed/provider failure.
9. Expose only the public site key through signup status. Keep the secret server-side.
10. Render an explicit Turnstile widget for start and resend. Use fresh single-use tokens and reset after submission, expiry, provider error, theme or language changes.
11. Keep the local bypass available only under the existing loopback plus local-database guard.

### Acceptance

- Forged forwarding headers cannot rotate rate limits.
- Wrong action, hostname, stale/duplicate token, timeout and malformed responses fail closed.
- Raw addresses and Turnstile tokens never persist or enter logs.
- A local HTTP stub verifies success and failure behavior without calling Cloudflare.
- CSP requirements are documented; live mode stays locked.

Cloudflare documents that Turnstile tokens are single use, expire after five minutes and require server-side Siteverify validation.

### Status (2026-10-19)

Built: `signup/client.rs` (trusted-proxy digest), `signup/limits.rs` per-client budgets, async `signup/bot.rs`, `signup/turnstile.rs` with local stub tests, status `botCheck`, and the frontend `useTurnstile` widget with reset-on-submit. CSP: the widget loads `https://challenges.cloudflare.com` as a script and frame source, so live mode must allow both and must let the proxy set the trusted client header while stripping client copies of it. `CRM_SIGNUP=live` stays locked. See `docs/sign-up-design.md` §20.

## 8. Packets R3–R6 — production account security

### R3 — transactional email provider

The owner must first choose the provider, sending domain, processing region/DPA, From address, Reply-To, bounce policy and acceptable idempotency behavior.

1. Implement one provider adapter behind the delivery contract.
2. Render English and Arabic verification and account-notice templates inside the application.
3. Never store rendered bodies in generic jobs or log recipients/content.
4. Use the outbox UUID as provider idempotency metadata where supported.
5. Handle provider acceptance, permanent failure, throttling, bounce, suppression and complaints honestly.
6. Prove behavior with a local stub, then the provider sandbox. Do not send to real customers during development.

### R4 — invitation privacy

1. Return a uniform accepted result for invitation attempts regardless of whether the email is usable.
2. Stop returning activation tokens to the browser outside guarded local development.
3. Deliver invitation links only through the mailbox worker.
4. Prevent directory state from revealing another company's member email.
5. Record current legal consent versions during invitation acceptance.

### R5 — recovery and Admin two-step login

1. Add email-backed password recovery with opaque, hashed, expiring, single-use tickets.
2. Revoke existing sessions after successful reset.
3. Choose the Admin two-step method before implementation. TOTP is preferred when avoiding repeated email dependence; recovery codes must be hashed and shown once.
4. Require two-step verification for Admin and Super Admin sessions before hosted launch.

### R6 — live-mode gate

1. Replace draft Terms and Privacy text with lawyer-approved versions.
2. Limit Super Admin to company metadata by default. Add explicit, time-limited, company-consented and visible support access before allowing private company inspection.
3. Require all mail, Turnstile, proxy, hostname, sender and secret settings at startup.
4. Enable `CRM_SIGNUP=live` only after R1–R6 pass in staging.

## 9. Packets A1–A6 — cross-company agreements and deal rooms

Create a separately owned `agreements` backend module and client service. Do not reuse private CRM records as shared agreement documents.

### A1 — architecture and decisions

1. Confirm agreement types: full handover, handover with referral share and co-broking.
2. Define allowed terms, expiry, revocation, counter-offers, amendments and payment tracking.
3. Define participant verification levels and what minimal client/property information may be frozen into an agreement.
4. Define retention, dispute export and legal wording with UAE counsel.
5. Produce an authorization matrix for sender, named recipient, company Admin, staff, Super Admin and guest.

### A2 — immutable agreement core

1. Add agreement, participant, immutable revision, action and acceptance tables owned by `agreements`.
2. Store globally unique IDs, explicit party/workspace IDs, current state, exact revision and optimistic version.
3. Freeze agreement terms into each revision. Store a digest for evidence; never rely on mutable Deal or Client fields as the accepted text.
4. Add database protection against revision/action/acceptance updates and deletes.
5. Implement participant-scoped list/detail APIs and CSRF-protected create/update/send/accept/decline/counter/revoke commands.
6. Use existing finance module functions for any handover or payment effect. Do not query or write finance tables directly.

### A3 — in-company evidence and certificate

1. Connect existing same-company handover/referral workflows to the agreement core.
2. Require the eligible receiving member to accept the exact revision.
3. Keep earlier accepted revisions after amendments.
4. Generate a deterministic downloadable certificate containing parties, terms, verification level, timestamps, revision digest and event history.
5. Track amounts due and paid without Blaqks One holding or moving money.

### A4 — registered cross-company agreements

1. Address a verified Blaqks One member or company through a non-enumerating public identity/connection contract, never by searching private login email.
2. Freeze only the explicitly shared agreement snapshot. Do not grant either company access to the other's Deal, Client, Property, finance or team records.
3. Allow only the named recipient to accept, decline or counter.
4. Apply the accepted outcome to each company's private workflow through its owning module and explicit authorization.
5. Handle concurrent accept, counter, revoke, suspension and archive races under locks and exact versions.

### A5 — deal-room chat

1. Create participant-only rooms derived from an agreement. Room membership cannot be edited independently.
2. Store messages outside activity logs. Activity records only redacted actions and object IDs.
3. Make sent content append-only. Corrections create visible revisions; deletion becomes a retained moderation/tombstone event.
4. Add unread counts, mentions and notifications.
5. Build HTTP correctness before WebSockets. Add real-time delivery after authorization and persistence are proven.
6. Defer attachments until private media storage exists.

### A6 — outside-agent links

1. Require the real email/SMS delivery foundation.
2. Create expiring, revocable, recipient-locked links whose tokens are stored only as hashes.
3. Verify the named guest with a one-time code before viewing sensitive terms or acting.
4. Let the guest download their evidence copy without requiring account creation.
5. Attach prior guest agreements to a later account only after the same contact is verified.
6. Add UAE PASS and RERA Form I references in later dedicated packets.

### Status (2026-10-20)

A1 is written (`docs/agreements-design.md`); its §11 decisions await the owner. The A2 core is built: migrations 0029–0030, `services/crm-api/src/agreements/` and two API suites. A review fixed cross-company ID probing, expired-agreement revival by counter-offer, unsendable expired drafts, same-company recipients causing a 503, the cross-workspace version race, evidence digests that did not name the parties, and unregistered API tests. See the design's §12 for what remains.

### Agreement acceptance gates

- Workspace A cannot read any private identifier or record from workspace B through forged IDs.
- Only the named recipient can act; Admin status alone does not replace them.
- Accepted text and prior revisions cannot change.
- Share calculations and payment tracking match finance rules exactly.
- Super Admin has metadata/audit visibility only unless a separately consented support flow applies.

## 10. Packets M1–M4 — internal messaging and provider communication

### M1 — messaging kernel

Add separately owned conversation, participant, message, revision, read-state and notification tables. Support company channels, direct messages and agreement rooms through explicit participant policies.

### M2 — inbox and notifications

Build searchable conversation lists, unread indicators, safe drafts, mentions and protected navigation. Keep internal notes distinct from customer-visible communication.

### M3 — real time

Add authenticated WebSockets after HTTP persistence works. Recheck live membership on connect and before each subscription/send. Use PostgreSQL for truth.

### M4 — external adapters

Add one provider at a time: transactional/business email, WhatsApp Business, then Calendar. Each needs provider authorization, verified resources, webhooks, deduplication, consent/suppression and sandbox evidence.

Redis/Valkey is added when more than one application server needs WebSocket pub/sub or distributed rate limits. It is not the load balancer and never becomes the source of truth.

## 11. Packets W1–W4 — media, publication and public website

### W1 — private media

Choose UAE or nearby object storage. Implement authorized upload intents, strict type/size limits, scanning/re-encoding, metadata removal, immutable derivatives and protected downloads. Keep originals and floor plans private.

### W2 — listing revisions and approval

Create an explicit public-field allowlist, immutable listing revisions, eligible public-agent profiles and exact-version Super Admin approval. A private Property is never serialized directly to the public API.

### W3 — public catalogue and enquiries

Publish only the currently approved revision. Add immediate withdrawal, cache invalidation, safe search projections, spam controls and durable enquiries routed to the original workspace/agent with Admin fallback inside that company.

### W4 — website

Build responsive search, property details, agent pages, enquiry forms, SEO and approved contact links. Stale pages must never make the origin accept an enquiry for an ineligible listing.

## 12. Packet O1 — deployment, scaling and Redis

1. Choose the UAE-region hosting topology, managed PostgreSQL, object storage, backup retention and restore targets.
2. Use Cloudflare and Nginx for HTTPS, request limits, routing and load balancing.
3. Add restricted runtime database roles, secret management, migrations, health/readiness checks, metrics, redacted errors and alerts.
4. Move large record, team, activity, inbox and public search lists to indexed server pagination.
5. Add Redis/Valkey only for measured needs: distributed rate limiting, WebSocket fan-out, ephemeral public caching or coordination across multiple instances.
6. Keep sessions, permissions, agreements, records and durable jobs authoritative in PostgreSQL.
7. Run backup restore and rollback drills before production launch.

## 13. DeepSeek task prompt template

```text
Packet: [one packet ID and name]

Goal:
[one complete user outcome]

Read first:
- AGENTS.md
- docs/token-efficient-delivery.md
- [relevant design/security docs]

Allowed writes:
- [exact files/directories]

Do not change:
- browser-local demo
- storage/workbook/backup contracts
- unrelated modules
- public/live provider settings unless explicitly included

Implementation steps:
1. ...

Required behavior:
- ...

Required tests:
- focused unit/API/browser tests using synthetic data and disposable PostgreSQL

Required checks:
- formatting
- line limit
- affected boundary/i18n checks
- focused build, Rust and browser checks

Output:
Changed / Checks / Problems / Next
Do not commit.
```

## 14. Codex review after each DeepSeek packet

1. Read the diff before running commands; reject unrelated edits and compressed files.
2. Trace browser to API to database and back for the complete user outcome.
3. Review authorization using forged workspace, record and participant IDs.
4. Review migrations for backfill, rollback strategy, constraints, indexes and preserved existing data.
5. Check logs, activity and job tables for secrets, codes, addresses, message bodies and provider payloads.
6. Run the focused checks listed in the packet, then the completion build and unit suite. Leave broad API/browser matrices to CI unless the packet is security-sensitive or CI is unavailable.
7. Use a specialist security review for authentication, cross-company access, finance, deletion, storage and integrations.
8. Record durable decisions and limitations in the relevant design document once.
9. Report Changed, Checks, Problems and Next. Ask the owner to authorize the commit only after the packet is reviewable and complete.

## 15. First execution sequence

Start with these packets in separate sessions:

1. **B0:** stabilize and commit the universal-company baseline.
2. **Q1:** field hints foundation.
3. **Q2:** commission calculator.
4. **R1:** durable sign-up delivery worker.
5. **R2:** trusted client limits and Turnstile.
6. **A1:** agreement architecture and authorization matrix.
7. **A2:** immutable agreement core.
8. **A3:** in-company certificate and payment tracking.
9. **A4:** registered cross-company agreements.
10. **A5:** deal-room chat.

Provider selection, legal review, production credentials and hosting decisions can proceed alongside these packets, but they do not authorize live external delivery.
