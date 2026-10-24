# Handoff for the next coding agent

Latest checkpoint (2026-10-24): after R1 (`4232ba5`), A3b (`a0b039b`) and the R2/A6/BO1
designs (`8ad0b58`), Claude built **R2a, sharing a listing with an agent at another
company** ([as built](record-sharing.md#r2a-as-built-2026-10-23)), then **co-broking from a
listing share** ([as built](record-sharing.md#co-broking-from-a-share-as-built-2026-10-23)).
Migrations run through **0072**. The R2a review follow-ups (L6, L7 as the owner decided,
L8, L10; [record sharing](record-sharing.md#r2a-security-review-2026-10-23)) are built. Lead
referrals (R2b) are dropped (owner, 2026-10-24): only properties are shared with other
companies. A6 is revised (outside agents accept by creating a free basic account) and waits
for BO1. BO1, P1 and the broker marketplace (MK) wait until the owner says. R2a's code
security review is done and its Medium findings fixed (migration 0071, [record
sharing](record-sharing.md#r2a-security-review-2026-10-23)). A3b and the co-broking flow now
have separate specialist code reviews (2026-10-24): their Medium findings were fixed
(consistent payment-read snapshots and mandatory fee collector on every share-bound
revision). Regression tests cover the read interleaving, concurrent opposite-party sends,
unchanged versions on rejected revisions and introduction preservation through amendments.

Updated 2026-10-22, after commit `20955d8` on `feature/connected-crm`. Read this with
`AGENTS.md` (project rules), the [token-efficient delivery protocol](token-efficient-delivery.md)
and [roadmap §15](claude-implementation-roadmap.md#15-remaining-connected-crm-work-outside-the-integrations).
The owner chooses the next packet: nothing in §2 starts until they say so.

## 1. Done in this stretch (2026-10-21 to 2026-10-22)

| Area                                | What works now                                                                                                                                                                                         | Commits                                    | Details                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Company email through SendGrid (E3) | Each company connects its own SendGrid account (restricted key, verified domain); every member gets an address on the company domain; sending with delivery statuses; client replies land in the Inbox | `432c70a` … `77dc083`                      | [SendGrid design](sendgrid-design.md) §10–§13, [setup guide](connecting-platforms.md) |
| Archiving a company                 | Archiving an Admin disconnects every company channel in the same transaction                                                                                                                           | `1acdb49`                                  | [SendGrid design](sendgrid-design.md) §10                                             |
| Sending from the Inbox              | Inbox sends from the SendGrid address (not Google); labelled New email; the Admin can give themselves an address; an address never used can be removed                                                 | `705e9ba`, `8528d8d`, `e1f4e01`, `519c1c5` | [SendGrid design](sendgrid-design.md) §13                                             |
| Email attachments (F3)              | Sending photos and PDFs with an email (F3a); keeping the photos and PDFs clients email in, labelled "from outside the company", with daily budgets (F3b)                                               | `ea30219`, `68d9311`, `377a6a2`, `20955d8` | [Media storage](media-storage.md) F3                                                  |
| Conversation layout                 | Messenger-style: the thread fills the screen, one-line message box growing with the text, `+` outside the box, files inside it                                                                         | `f2b3c8e`, `a857aa7`, `d135e2a`, `e112de9` | `src/features/server/composer/`                                                       |

Migrations then ran through `0066` (now `0072`, see the checkpoint above). **Evidence limit:** all of this is proven against the local
SendGrid stand-in only; nothing has been tried with a real SendGrid account yet, and files
from clients are labelled but not virus-scanned.

## 2. Next packets, in the recommended order

### N1 — Real SendGrid check (waits for the owner's domain and SendGrid account)

The owner has no domain or SendGrid account yet (2026-10-22); everything up to the live
check is built and checked.

Proves E3 and F3 with the owner's real account before more is built on them. **Preflight
done (2026-10-22):** the calls were checked against SendGrid's documentation and three
mismatches fixed; [SendGrid design §14](sendgrid-design.md#14-preflight-against-sendgrids-documentation-2026-10-22)
lists what the live check must still prove.

- **Owner first:** steps 1–7 of [Connecting platforms](connecting-platforms.md#email-through-sendgrid-packet-e3)
  (domain, SendGrid account, domain authentication, MX and DMARC records, a Custom Access
  key, two-factor sign-in).
- **Agent:**
  1. In `.env`, remove `CRM_SENDGRID_ENDPOINT` (it points at the stand-in on 8793) so the
     API calls SendGrid itself.
  2. Start a tunnel to the API (port 8788; webhooks are under `/api/integrations/webhooks/`)
     and set `CRM_PUBLIC_URL` to its https address. Restart the API and worker.
  3. The Admin pastes the restricted key on Channels; check the domain shows verified, with
     delivery updates and incoming mail on.
  4. Send from the Inbox to an address the owner controls (never a real client); check the
     status reaches Delivered. Reply from that address with a photo and a PDF; check the
     reply joins the conversation with both files.
  5. Write a dated "Live check" section in [SendGrid design](sendgrid-design.md) with what
     matched and what differed; fix differences as their own small packet. Stop the tunnel
     afterwards and restore the stand-in setting for local work.

### N2 — Inbox time-savers: templates, quick replies, drafts (built 2026-10-22)

Built as [Saved replies and drafts](saved-replies-drafts.md).

Needs nothing from outside. Write a short design first and ask the owner: templates per
company (Admin-managed) and/or per member; placeholders such as the client's name.
Drafts are already planned as `status = draft` messages in
[Messaging design](messaging-design.md) §5; reuse that. A per-member email send limit is
queued in the roadmap and fits here. UI goes through `product_designer`, Messenger style.

### N3 — Move existing inline property photos into storage (built 2026-10-22)

Built as the `media-backfill` command; see [Media storage](media-storage.md) "F2 backfill as built". Run it on real data only after backing up the database and the bucket.

Photos saved before F2 still sit inside record JSON (`{name, src}`). A trusted command that,
per workspace, puts each into media storage and rewrites the entry to `{name, file, thumb}`
in the record's own transaction with its version check; repeatable, with a dry run first;
connected records only, never browser or demo data. Security review first (it rewrites
stored records). Test on the disposable database with synthetic records.

### Also built 2026-10-22

- **Agreements screens:** the Agreements page for the A2 server core; see
  [Agreements design](agreements-design.md) §13.
- **Team chat C3:** private groups (with adding people later) and in-app @mentions; see
  [Team chat](team-chat.md).
- **Agreements A3a:** every deal hand-over inside a company is recorded as an agreement;
  the receiver reviews the full offer before accepting; see
  [Agreements design](agreements-design.md) §14–§16. Next in this line: **A3b** (amend,
  complete, cancel, archive, the certificate and payment tracking between companies).
- **H2** (built 2026-10-22, design §17): a receiver reviews a hand-over (deal and
  property, client details hidden) before accepting or declining; Deals and Agreements
  badges; full hand-overs to the company Admin; an agent may tick Needs approval and choose
  the approver, and the deal moves only after the receiver accepts and the approver
  approves. Migrations 0059 and 0060.
- **H3** (built 2026-10-22, design §18): the client (with its conversations) and the
  listing move with an accepted deal; the sender keeps them view only with a badge; a
  listing other deals use stays and is shared view only; the review shows all listing
  details and photos. Migrations 0061 and 0062; code security and design reviews done.
- **R1** (built 2026-10-23, [Record sharing](record-sharing.md)): the holder or the Admin
  shares one client, property or contact with an assigned-only colleague, who accepts a
  view-only copy (no notes, no messaging) or declines; Copy link and Share on WhatsApp;
  shares end when the record changes holder. Migration 0063.
- **A3b** (built 2026-10-23, [A3b](agreements-a3b.md)): amend, complete, cancel and archive
  agreements between companies, the certificate (print and evidence file) and payment
  records (payer records, payee confirms). Migrations 0064–0066.
- **R2 and A6** are designed and reviewed ([R2/A6 design review](sharing-guest-design-review.md)),
  with the owner's answers in [Product decisions](product-decisions.md). Next: build R2,
  then A6 (live use needs a Blaqks One platform sender). P1 waits until the owner says.

### N4 — WhatsApp (blocked on the owner)

Needs decisions D1, D2 and D6, a Twilio account and approved templates; see
[Connecting platforms](connecting-platforms.md#whatsapp-through-twilio-w1-w2).

### Smaller follow-ups already recorded

- Virus scanning of files from clients before hosting (F3b review M1).
- Showing the Admin how much mail the budgets dropped (E3c M2); rate limits for the public
  webhook routes at the hosting edge.
- Spam reports and unsubscribes becoming an email opt-out (with the consents table, W1).
- A test for an inbound file whose storage fails (hidden and counted, not yet automated).
- Address changes in Team activity.
- Database access rules (DB1, [plan](database-access.md)): separate owner and app roles,
  evidence tables add-and-read only; queued for the hosting phase (owner, 2026-10-24).
- Agreement screens (product designer, 2026-10-24): the certificate strip uses 24px padding
  against the 16px phone gutter and seems to cover the body; an unticked checkbox looks
  filled in light mode.

## 3. How a packet is run here

1. Take one owner-approved packet. Read its design doc and the code it touches.
2. Anything touching access, storage, sign-in, providers or incoming data gets a written
   design in its feature doc and a **separate security review** (`security_engineer` in
   `.codex/agents/`) before building; write the fixes into the design. Ask the owner only
   real business questions, each with a recommended option, and record the answers in
   [Product decisions](product-decisions.md).
3. Build in small modules: one owning module per table ([Service boundaries](service-boundaries.md)),
   150 lines per file, English text only ([English only](product-decisions.md#english-only-decided-2026-10-22)). UI changes go through
   `product_designer`; conversations keep the Messenger layout.
4. Test with synthetic data on the disposable Docker database. Add every new API suite to
   `scripts/crm-api-test-files*.mjs`.
5. Run a code security review of the diff; fix High and Medium findings; record what was
   accepted.
6. Write "as built" in the feature doc and the status in roadmap §15.
7. Run every check in §4, then commit with a plain-English subject. **Never push: the
   owner pushes.**
8. Apply new migrations to the dev database and restart the dev API and worker, so the
   owner can try the work at once.
9. Report to the owner in simple English: what they can now do, how to try it, and what is
   not done.

Owner preferences: simple English; everything in English, no Arabic or right-to-left work
(2026-10-22); function first, whole-app redesign later; connected
mode only (the demo is frozen); never real client data.

## 4. Running and checking

```sh
npm run db:up && npm run db:migrate   # Docker PostgreSQL and file storage
npm run dev:api                       # API on 127.0.0.1:8788
npm run dev:worker                    # outbox, inbound mail, media sweep
npm run dev:sendgrid                  # SendGrid stand-in on 8793
npm run dev                           # http://localhost:5173

cd services/crm-api && cargo fmt --check && cargo clippy --offline --all-targets -- -D warnings && cargo test --offline
npm test && npm run build && npm run check:lines:ci && npm run check:i18n && npm run check:boundaries
API_TEST_FILES="tests/api/a.test.mjs,tests/api/b.test.mjs" npm run test:api
PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only tests/server-browser/x.spec.js
```

CI runs the full `npm run test:api` and `npm run test:server:e2e`. The test harness uses
ports 8790–8792 and 5175; development uses 8788, 5173 and 8793.

## 5. Pitfalls met in this stretch

- `some-check | tail` hides a failing exit code; two commits once went in with failing
  checks. Read each command's own exit status.
- New index and constraint names must be listed in `scripts/boundaries-*.json`, and string
  arguments that look like table names (such as `crm_message`) trip the boundary check.
- PostgreSQL regular expressions allow repeat counts up to 255 only.
- Renaming a translation key onto an existing one clashes silently; the browser suites
  catch it.
- The outbox gives each provider call 30 seconds; storage reads and the send must fit
  inside it (F3a review M1).
- Inbound files are stored after the commit in a background task; tests wait with
  `filesStored` in `tests/api/sendgrid-inbound-helpers.mjs`.
- Browser suites get flaky when the machine is loaded (other Docker projects); every spec
  passes alone, so retry when the load drops before suspecting the code.
