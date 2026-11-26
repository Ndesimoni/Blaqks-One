**Status (2026-10-24): assigned to DeepSeek by the owner.** Claude reviews and tests the work
before it is accepted. Build exactly what this file says. When something here does not match
the code, STOP and report instead of guessing.

# Packet MK2 — broker marketplace: client requests and the board

## Goal

A joined member of an approved, switched-on company posts a **client request** from a client
in their own CRM: what the client is looking for, never who the client is. Members of other
companies browse a **board** of open requests with filters, and open the poster's profile.
The poster sees **My requests** and can edit, renew, close and see when a request expires.
**Answers, matching and alerts are NOT in MK2** (they are MK3).

Read the whole design first: `docs/broker-marketplace.md` §3 (requests), §13–§16 (technical
design, review amendments, eligibility, MK1 as built). MK1 is built: reuse its gate,
visibility rule, free-text rules, events, error codes and screens.

## Rules for this packet (every one is required)

1. **Start clean.** Run `git status`. If anything is uncommitted, STOP and report. Start
   from commit `6609603` or later on `feature/connected-crm`.
2. **Read first:** `AGENTS.md`, `docs/handoff.md` §3–§5, `docs/broker-marketplace.md`,
   `docs/service-boundaries.md`, `docs/design-standards.md`, and the MK1 code in
   `services/crm-api/src/marketplace/` and `apps/crm/src/features/server/marketplace/`.
3. **150 lines per hand-written file** after formatting. Split by responsibility; never
   compress code. `npm run check:lines:ci` must pass.
4. **English only.** New text goes in the English catalogue through `useI18n()`, as **flat
   keys** (`'requests.title': '…'`), never nested objects. Every key you use must exist in the
   catalogue; check with the key scan in "Checks".
5. **Style every class you use.** A class with no CSS is a defect. Use the shared patterns:
   `form-grid` with `<div className="field"><label htmlFor>` for fields, `record-review-grid`
   for facts, `market-card`, `market-check`/`market-checks` (marketplace-join.css) for ticks,
   `MarketplacePerson`/`MarketplaceAvatar` for brokers. Light and dark, 390 px first.
6. **Module boundaries:** marketplace owns only its tables and calls other modules'
   functions. Every new `crm_*` name in Rust needs an owner in `scripts/boundaries.json`.
7. **No new dependencies.** **Synthetic data only**, in the disposable test database.
8. **Never touch the development database:** do not run `npm run db:migrate` or restart the
   dev API. Tests use their own database. Claude applies migrations after review.
9. **Never move, stash or delete work outside the repository** (no `/tmp` copies, no
   `git stash`, no reverting shared files to split commits). If you cannot finish, leave the
   work in place and report.
10. **Never claim a check passed without its output.** Read each command's own exit status.
11. **One commit** when every check passes, plain-English subject. Never push.
12. **Stop and report** when a step needs a decision this file does not give, a change in
    another module beyond what is listed, or when a check fails twice for the same reason.

## Decisions in force (owner and design; do not change them)

- Requests come only from a **client in the poster's CRM** that they hold, or any client if
  they are the company Admin, with the Clients permission (`records::shares::rules::shareable`
  with collection `Clients` already applies exactly this rule).
- **5 open requests per member; 1 open request per client.** 30 days, renewable.
- **Never shown to anyone but the poster:** the client's name, phone, email, notes, lead
  source, stage, any free text from the client record, and the client's record ID.
- **Client consent tick** before posting: "My client agreed that what they are looking for
  (not their name or contact details) is shared with brokers of other companies on Blaqks
  One."
- **Board:** other companies' open requests only (your own company's appear under My
  requests or not at all), newest first, no totals, filters on the server.
- **MK2 defaults, approved by the owner on 2026-10-24** (report if they conflict with the code):
  - Areas stay typed community names, normalised for matching (trimmed, lower-cased,
    inner spaces collapsed), with the MK1 free-text rules. A fixed community list is later.
  - Budgets are shown as **bands**; the exact numbers stay on the server for MK3 matching.
  - Editing a request does not reset its expiry; **Renew** sets it to 30 days from now.

## Data model — migration `0077_marketplace_requests.sql` (owner: marketplace)

- `marketplace.crm_market_requests`
  - `id uuid PK` (random, `Uuid::new_v4()`), `workspace_id text NOT NULL`,
    `member_id uuid NOT NULL`
  - `purpose text CHECK (purpose IN ('buy','rent'))`
  - `emirate text` (one of the MK1 emirate slugs: `dubai`, `abu-dhabi`, `sharjah`, `ajman`,
    `umm-al-quwain`, `ras-al-khaimah`, `fujairah`)
  - `communities jsonb` (0–12 `{name,key}`, same rules as MK1 profiles)
  - `open_to_other_areas boolean NOT NULL DEFAULT false`
  - `property_type text` (one of the Property type options in
    `apps/crm/src/config/fields/stageAndListingOptions.js`, stored as the label)
  - `bedrooms smallint NULL CHECK (bedrooms BETWEEN 0 AND 20)` (NULL = any; 0 = studio)
  - `budget_min_aed bigint NULL`, `budget_max_aed bigint NOT NULL`, CHECK min ≤ max, max > 0
  - `budget_band text NOT NULL` (computed by the server, see below)
  - `ready text CHECK (ready IN ('ready','off_plan','any'))`
  - `furnishing text CHECK (furnishing IN ('furnished','unfurnished','part_furnished','any'))`
  - `cheques smallint NULL CHECK (cheques IN (1,2,3,4,6,12))` (rent only, else NULL)
  - `building_age text CHECK (building_age IN ('new','under_5','5_to_10','over_10','any'))`
  - `move_in text NULL CHECK (move_in ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')` (a month)
  - `client_consent_at timestamptz NOT NULL`
  - `expires_at timestamptz NOT NULL`, `closed_at timestamptz NULL`,
    `close_reason text NULL CHECK (close_reason IN ('done','left','client_changed'))`
  - `round smallint NOT NULL DEFAULT 1` (used by MK3), `created_at`, `updated_at`,
    `version bigint NOT NULL`
  - Indexes: `(workspace_id, member_id)`, and for the board
    `(created_at DESC, id DESC) WHERE closed_at IS NULL`.
- `marketplace.crm_market_request_sources` (the poster's side only; no cross-company
  response may read it): `request_id uuid PK REFERENCES crm_market_requests`,
  `workspace_id text NOT NULL`, `source_record_id uuid NOT NULL` (no foreign key into
  `crm_records`, decision D6), `open boolean NOT NULL`. Partial unique index
  `(workspace_id, source_record_id) WHERE open` (one open request per client). Keep `open`
  in step with `closed_at` in the same transaction.
- Extend the MK1 `crm_market_events` action CHECK (drop `crm_market_events_action_check` and
  add it again with the old values plus the new ones, as migration 0072 did for
  `crm_listing_share_events_action_check`) with `'request_posted'`, `'request_edited'`,
  `'request_renewed'`, `'request_closed'`.
- **Budget bands** (`budget_band`, from `budget_max_aed`): buy: `buy_1m` (≤ 1,000,000),
  `buy_2m`, `buy_3m`, `buy_5m`, `buy_10m`, `buy_10m_plus`; rent (yearly): `rent_50k`,
  `rent_100k`, `rent_150k`, `rent_250k`, `rent_500k`, `rent_500k_plus`. Each band holds the
  values up to its number (above the previous band). Unit-test the edges.

## Records function (owner: records) — `records/market_requirements.rs`

`pub async fn read(tx, workspace, live: &UserRow, client: Uuid) -> ApiResult<Requirements>`:
calls `shares::rules::shareable(tx, workspace, live, ("Clients", client))` (403/404 as it
answers), reads the client's payload and returns **only**: `buy_rent` → purpose (`Buy` →
`buy`, `Rent` → `rent`, anything else none), `emirate` (label → slug), `preferred_communities`
(split on commas, semicolons and new lines, at most 12, each through the MK1 community rules;
invalid names are dropped, never sent), `property_type`, `bedrooms`, `minimum_budget_aed`,
`maximum_budget_aed` (numbers may be stored as JSON numbers or numeric strings), `target_date`
→ month. Every other Clients field is never returned. Add a Rust test that lists **every**
Clients workbook field (`apps/crm/src/data/schemas/people.js` order) as used or never sent, so a new
field fails the build until it is classified (like `records::outside_facts` tests do).

Also `pub async fn still_held(tx, items: &[(String, Uuid, Uuid)]) -> ApiResult<HashSet<Uuid>>`:
of `(workspace, record, member)` triples, the records that still exist in that workspace and
are held by that member (`crm_records.assignee_id`) or whose member is that company's Admin.
One query. Records are deleted outright (no soft delete), so a missing row means the client is
gone.

## Routes (under `/api/crm/workspaces/{workspace}/marketplace`; every one runs the MK1 gate)

All require a joined member who accepted the current terms in an approved, switched-on company
(`gate::company_open`, `gate::joined`), except where noted.

| Method and path                                                                                                                                                                                        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /requests/draft?clientId=`                                                                                                                                                                        | The requirements of one of your clients (`market_requirements::read`), pre-filled for the form. Only to the poster's side.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `POST /requests`                                                                                                                                                                                       | Body: `{ clientId, request, clientConsent: true }` where `request` holds the fields below. One transaction: request + source + event. 409 at 5 open (count under the member's row lock) or when the client already has an open request; 400 without consent or with invalid fields.                                                                                                                                                                                                                                                                                              |
| `GET /requests/mine`                                                                                                                                                                                   | Your requests, newest first, with `clientId` and the client's name from `records::lookup::summary` (the poster's own                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| view; none when they can no longer see it), state (`open`, `expired`, `closed`), `expiresAt`, `canRenew`. Closes, in this read, your open requests whose client you no longer hold (`client_changed`). |
| `PATCH /requests/{id}`                                                                                                                                                                                 | `{ expectedVersion, request }`; your own open request only; 409 on a stale version.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /requests/{id}/renew`                                                                                                                                                                            | Your own open (or expired less than 30 days ago) request: `expires_at = now() + 30 days`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `POST /requests/{id}/close`                                                                                                                                                                            | Your own open request: `closed_at = now()`, reason `done`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `GET /board?purpose=&emirate=&propertyType=&bedrooms=&band=&cursor=`                                                                                                                                   | Other companies' open, unexpired requests whose poster is visible (the MK1 visibility rule) and still holds the client (`still_held`; hide, do not write), 20 per page, `nextCursor` (opaque, `created_at` + `id`), **no totals**. Each item: `id`, `purpose`, `emirate`, `communities` (names), `openToOtherAreas`, `propertyType`, `bedrooms`, `budgetBand`, `ready`, `furnishing`, `cheques`, `buildingAge`, `moveIn`, `createdAt`, `expiresAt`, and `broker: { memberId, name, company, hasPhoto }`. Never the client, the source, the exact budget or the poster's contact. |

- **Request fields** (`request`): `purpose`, `emirate`, `communities` (array of names),
  `openToOtherAreas`, `propertyType`, `bedrooms` (null or 0–20), `budgetMinAed` (null or ≥ 0),
  `budgetMaxAed` (> 0), `ready`, `furnishing`, `cheques` (rent only), `buildingAge`, `moveIn`
  (`YYYY-MM` or null). Validate every one against the lists above on the server.
- **Limits:** `GET /board` 120 an hour per member and 600 per company; `POST /requests` 20 a
  day per member (`crate::auth::throttle::consume_window`, called as `marketplace/limits.rs`
  does, keys named for their budget, counted after the role and gate checks).
- **Leaving** (MK1 `POST /leave`) now also closes the member's open requests (`left`) in the
  same transaction. A company switched off, revoked or a member suspended hides requests at
  read time; nothing else changes their stored state.
- Errors use the MK1 `P0M` prefix for any new database check.

## Screens (`apps/crm/src/features/server/marketplace/`)

- The joined member's Marketplace screen gets two tabs below "My marketplace profile":
  **Board** and **My requests** (`role="tablist"`, as the Agreements screen does).
- **Post a request** (button on My requests): pick a client (search your clients, as other
  pickers do) → the form pre-filled from `GET /requests/draft` → review → consent tick → post.
  The form uses `form-grid`; choices use `market-check` ticks or selects; budget in AED with
  the band shown live; "Open to other areas" tick under the communities.
- **Board:** filters (purpose, emirate, property type, bedrooms, budget band) in a row that
  wraps on phones; cards with the facts in `record-review-grid`, the band as a chip, "Posted
  {date} · ends {date}", and the broker (`MarketplacePerson`, opening
  `MarketplaceProfileDialog`); **Load more** while `nextCursor`; empty and loading states.
- **My requests:** each request with its state, ends on, **Edit**, **Renew** (shown when 7
  days or fewer are left, or expired), **Close** (confirmation dialog sized like the MK1 leave
  dialog); "No answers yet" note (answers arrive in MK3); empty state with **Post a request**.
- Client: extend `apps/crm/src/services/crm/marketplace.js`. New text in a new catalogue
  `apps/crm/src/i18n/catalogs/en/marketplaceRequests.js` (flat keys), registered in `catalogs/index.js`.

## Tests (all must pass)

- `apps/crm/tests/api/marketplace-requests.test.mjs`: draft pre-fill returns only the allowed fields
  (scan the whole response for the client's name, phone and email: absent); post needs the
  consent tick; 5 open per member (6th 409); 1 per client (2nd 409); edit with a stale
  version 409; renew and close; leaving closes open requests; a reassigned client closes the
  request on the poster's next My requests read.
- `apps/crm/tests/api/marketplace-board.test.mjs`: the board lists another company's request and never
  your own company's; filters; paging with `nextCursor` and no totals; the response never
  contains the client's name, phone, email, record ID or exact budget; requests hide when the
  poster's company is switched off, revoked, the poster is suspended, left, or no longer
  holds the client; expired and closed requests never appear; read limits return 429
  (pre-fill the throttle row as `apps/crm/tests/api/outside-sharing-follow-ups.test.mjs` does); the
  Super Admin, another company's member on your workspace path and unapproved companies get
  the one shared 404 on every new route.
- Rust unit tests: budget bands and their edges, request validation, the requirements
  allowlist sort, community splitting.
- Frontend unit tests for the new model readers (strict, like `marketplaceModel.js`).
- Add the new API files to `scripts/crm-api-test-files-marketplace.mjs`.
- Browser spec `apps/crm/tests/server-browser/marketplace-requests.spec.js`: two approved companies; a
  member posts a request from a client; a member of the other company sees it on the board,
  filters, opens the broker's profile; the poster renews and closes it. Screenshots with
  `shots()` (`apps/crm/tests/server-browser/agreements-helpers.js`) of the form, the board and My
  requests. Use `jpegPhoto()` from `apps/crm/tests/api/media-helpers.mjs` for any photo.

## Allowed writes

- `services/crm-api/src/marketplace/` (new files and the hooks: `mod.rs`, `routes.rs`,
  `leave.rs`), `services/crm-api/src/records/market_requirements.rs` and `records/mod.rs`,
  `services/crm-api/migrations/0077_marketplace_requests.sql`, `scripts/boundaries.json`.
- `apps/crm/src/features/server/marketplace/` (new files and the MK1 screen files you extend),
  `apps/crm/src/services/crm/marketplace.js`, `apps/crm/src/i18n/catalogs/en/marketplaceRequests.js` and
  `catalogs/index.js`.
- `apps/crm/tests/api/marketplace-*`, `apps/crm/tests/unit/marketplace-*`,
  `apps/crm/tests/server-browser/marketplace-requests.spec.js`,
  `scripts/crm-api-test-files-marketplace.mjs`.
- Docs once built: `docs/broker-marketplace.md` (add "§18 MK2 as built"),
  `docs/claude-implementation-roadmap.md` §15 (status), `docs/handoff.md` (checkpoint),
  `docs/database-access.md` (new tables), `docs/service-boundaries.md` (records function).

## Do not change

MK1 behaviour (apart from leaving closing requests), listing shares, agreements, co-broking,
deals, finance, the demo, other modules' tables, existing migrations, the Arabic catalogue,
and anything for MK3 (answers, matching, alerts).

## Checks (run all; every one must exit 0; paste each summary line in the report)

```sh
npm run db:up
cd services/crm-api && cargo fmt --check && cargo clippy --offline --all-targets -- -D warnings && cargo test --offline --lib && cd ../..
npm test && npm run build && npm run check:lines:ci && npm run check:i18n && npm run check:boundaries && npm run format:check
API_TEST_FILES="$(node -e "import('./scripts/crm-api-test-files-marketplace.mjs').then(m=>console.log(m.marketplaceTestFiles.join(',')))")" npm run test:api
PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only apps/crm/tests/server-browser/marketplace-apply.spec.js apps/crm/tests/server-browser/marketplace-requests.spec.js
```

**Key scan** (every static `t('namespace.key')` in `apps/crm/src/features/server/marketplace/` must
exist): adapt the snippet Claude used for MK1 (load the `en` catalogues, regex
`t\(\s*'([a-zA-Z]+)\.([^']+)'`, report missing keys) and list every template-literal key with
the values it can take, and check those too. Paste the result.

If a browser spec is flaky under machine load, run it alone once more before suspecting the
code; never weaken an assertion to pass.

## Report (then STOP)

Plain English, at most 30 lines: what a poster and a browsing member can now do; the commit
hash; every check with its summary line; the key scan result; anything you changed from this
file and why; the screenshots' folder. Then STOP. Do not start MK3.

## After MK2 (not for this packet)

- **MK3 answers and matching:** listing shares gain an `origin`; an answer is a listing share
  from the answering broker's CRM to the poster, checked against the must-match rules, 3 per
  round, with Not a match and Still available; the R2a send path is split into a reusable
  function. It changes agreements code and needs its own design and security review before it
  is handed out.
- **MK4 choosing:** choosing an answer starts co-broking from the share; the exact unit and
  both phones appear after the agreement is accepted; profile stats.
- **MK5 disputes and suspension:** needs the Blaqks One console (BO1) and a UAE lawyer's
  review.
