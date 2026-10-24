**Status (2026-10-24): built by DeepSeek, then restored, reviewed and fixed by Claude** (see
`docs/broker-marketplace.md` §16). Kept for reference; do not hand this packet out again.
Original: assigned to DeepSeek by the owner; Claude reviews the work before it is accepted. Build exactly what this file says; when something here does not match the code,
STOP and report instead of guessing.

# Packet MK1 — broker marketplace: eligibility, company switch, joining and profiles

## Goal

A company that genuinely uses the CRM applies to the marketplace, and Blaqks One (today the
Super Admin account) approves it. Its Admin can then switch the marketplace on or off for
the company. Its members join with a broker profile (photo, areas, property types,
experience, optional licence), four commitments, a publication consent and the terms, and
see other approved members' profiles. **Client requests and the board are NOT in MK1**
(they are MK2): after joining, the board shows an empty state.

The full design and its reviews are in `docs/broker-marketplace.md` §13 (proposal), §14
(review amendments, which override §13) and §15 (eligibility). This file turns them into
build steps. If this file and §14/§15 disagree, §14/§15 win; report the difference.

## Rules for this packet (read and follow every one)

1. **Start clean.** Run `git status`. If anything is uncommitted, STOP and report. The work
   starts from commit `05a849b` or later on `feature/connected-crm`.
2. **Read first:** `AGENTS.md`, `docs/token-efficient-delivery.md`, `docs/handoff.md` §3–§5,
   `docs/broker-marketplace.md` (all), `docs/service-boundaries.md` (rules 1–12, decision
   log), `docs/design-standards.md`, `docs/record-sharing.md` ("R2a security review").
3. **150 lines per hand-written file** after formatting, imports and comments included.
   Split by responsibility; never compress code. `npm run check:lines:ci` must pass.
4. **English only** (no Arabic, no right-to-left work). New text goes in the English
   catalogue through `useI18n()`.
5. **Connected mode only.** Do not touch the browser-local demo, demo data or demo tests.
6. **Module boundaries:** the new `marketplace` module owns only its own tables. It calls
   other modules' functions; it never reads or writes their tables. No foreign keys into
   other modules' tables. Every `crm_*` name in Rust must have an owner in
   `scripts/boundaries.json` (`npm run check:boundaries`).
7. **No new dependencies** (no image library, no crates, no npm packages).
8. **Tests use synthetic data** in the disposable Docker test database only.
9. **Never claim a check passed without its output.** Read each command's own exit status;
   `cmd | tail` hides failures.
10. **Commit, never push.** The owner pushes. Two commits (MK1a, then MK1b), plain-English
    subjects. Do not rewrite or amend earlier commits.
11. **Stop and report** if a step needs a decision this file does not give, a new table in
    another module, or a change outside the allowed writes.

## Owner decisions (2026-10-23 and 2026-10-24; do not change them)

- Blaqks One users only; never the Super Admin; never the organisation workspace
  (`workspaces::ORGANISATION`, `"super-admin-workspace"`).
- **Eligibility (§15):** company created ≥ 7 days ago; counts from the company's own
  records: Properties ≥ 5, Clients ≥ 5, Contacts ≥ 3, Follow-ups ≥ 3, Viewings ≥ 1, and at
  least one of those records created or changed in the last 30 days. Deals and Agreements do
  not count. Then the Admin applies; Blaqks One approves or declines with a reason; a
  declined company may apply again after **3 days**; Blaqks One may revoke access.
- The platform reviewer sees the company name, type, age, who applied and the **counts
  only**, never records.
- **Company switch:** the company Admin turns the marketplace on or off for the whole
  company; on by default (no row = on).
- **Joining:** profile, the four commitments (each its own tick), a separate publication
  consent, and the terms. The first terms version is a **draft marked for UAE lawyer
  review**. Members may leave.
- No licence needed. Company names and licences are shown as "declared by the broker, not
  verified by Blaqks One".

## Part MK1a — eligibility, application, approval and the company switch

### Migration `0073_marketplace.sql` (owner: marketplace)

Create schema `marketplace` and, in it:

- `crm_market_applications` (insert-only): `id uuid PK`, `workspace_id text NOT NULL`,
  `applied_by uuid NOT NULL`, `counts jsonb NOT NULL` (the checklist numbers at the moment
  of applying), `created_at timestamptz NOT NULL DEFAULT now()`.
- `crm_market_decisions` (insert-only): `id uuid PK`, `application_id uuid` (FK to
  applications, same module; NULL only for `revoked`), `workspace_id text NOT NULL`,
  `decision text NOT NULL CHECK (decision IN ('approved','declined','revoked'))`,
  `reason text CHECK (char_length(reason) BETWEEN 1 AND 500)` (required for declined and
  revoked), `decided_by uuid NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`.
- `crm_market_companies`: `workspace_id text PK`, `enabled boolean NOT NULL`,
  `version bigint NOT NULL`, `changed_by uuid NOT NULL`, `changed_at timestamptz NOT NULL`.
  Plus insert-only history `crm_market_company_events` (`id`, `workspace_id`, `enabled`,
  `changed_by`, `created_at`).
- `crm_market_events` (insert-only): `id`, `workspace_id`, `actor_id`, `member_id`,
  `action text CHECK (action IN ('applied','approved','declined','revoked','switched_on',
'switched_off','joined','left','terms_accepted','profile_updated','photo_changed'))`,
  `created_at`. Names the people and the action only, never field values.
- Insert-only tables get a `BEFORE UPDATE OR DELETE` trigger and a `BEFORE TRUNCATE`
  trigger raising `P0M01` ("marketplace evidence is insert-only"), as migration 0067 does
  for listing snapshots. Use the prefix `P0M` for every marketplace error code (it is free).
- The company's **current state** is its latest decision (approved, declined, revoked) or,
  with an application newer than every decision, `pending`; none = `not_applied`.

### Records function (owner: records)

`services/crm-api/src/records/market_activity.rs` (register in `records/mod.rs`):
`pub async fn counts(tx, workspace) -> ApiResult<Counts>` returning `properties`,
`clients`, `contacts`, `follow_ups`, `viewings` (counts of `crm_records` rows with
`collection` = `Properties`, `Clients`, `Contacts`, `Follow-ups`, `Viewings`) and
`recent: bool` (any of those rows with `updated_at > now() - interval '30 days'`). One
query. Counts only; it never returns record contents.

### Marketplace module (`services/crm-api/src/marketplace/`, register in `lib`/`routes.rs`)

Suggested files (each ≤ 150 lines): `mod.rs`, `routes.rs`, `errors.rs` (P0M mapping,
registered in `routes.rs` `DOMAIN_CODES`), `gate.rs`, `eligibility.rs`,
`application.rs`, `decisions.rs` (platform side), `company.rs` (switch), `events.rs`,
`tests.rs`.

- **Gate (`gate.rs`):** one function every member route calls. It returns the one shared
  not-found (`ApiError::missing()`) for the Super Admin, a path workspace that is not the
  caller's own, and the organisation workspace; it requires a live member (use the same
  live checks as `agreements::listings::access::live`: workspace lock, then
  `workspaces::ensure_writable` for writes) and a company that is not frozen or archived.
  It exposes the company's eligibility, application state and switch so routes can decide.
- **Member routes** (under `/api/crm/workspaces/{workspace}/marketplace`):

| Method and path     | Who                    | Answer                                                                                                                                                                                             |
| ------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /status`       | any member             | `{ company: { state, enabled, canApplyFrom, declineReason, checklist: { ageDays, properties, clients, contacts, followUps, viewings, recent, met } }, member: null }` (`member` is filled in MK1b) |
| `POST /application` | Admin only (staff 403) | `{ status }`; 409 when the checklist is not met, an application is pending, the company is approved, revoked, or within 3 days of a decline (`canApplyFrom`)                                       |
| `PUT /company`      | Admin only             | body `{ enabled, expectedVersion }` (0 when no row); 409 on a stale version; writes the history row and an event under the workspace lock                                                          |

- **Platform routes** (Super Admin only; everyone else gets the shared not-found). Follow
  `team/account_type/limit.rs` (role check, CSRF via `protection::mutation`, workspace
  lock):

| Method and path                                                                             | Answer                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/crm/workspaces/super-admin-workspace/marketplace/applications?state=pending\|all` | newest first, at most 100: `{ applications: [{ id, workspaceId, company, accountType, companyCreatedAt, appliedAt, appliedBy, counts, state, decidedAt, reason }] }` (company name through `workspaces::company`, applicant name through `auth`) |
| `POST /api/crm/workspaces/{company}/marketplace/decision`                                   | body `{ applicationId, decision: 'approved'\|'declined'\|'revoked', reason }`; approve or decline only the pending application; revoke only an approved company; 409 otherwise                                                                   |

- Rate limit `POST /application` to 5 an hour per company with `throttle::consume_window`
  (see `agreements/recipients.rs`).

### MK1a screens

- New **Marketplace** screen for company members: add `{ name: 'Marketplace', path:
'/marketplace' }` to `src/config/routes.js`, a case in `src/features/server/ServerContent.jsx`,
  an access rule in `src/features/server/access.js` (company members only, never the Super
  Admin), and a navigation item in the `SALES & RELATIONSHIPS` group after Agreements
  (follow `withAgreements` in `ServerNavigationGroups.jsx`).
- Screen states: not applied (checklist with ✓/✗ per line and the age; **Apply** for the
  Admin when met; "Ask your Admin to apply" for staff), pending ("Waiting for Blaqks One
  approval"), declined (the reason and "You can apply again on {date}"), revoked ("Blaqks
  One has paused your company's marketplace access."), approved (the Admin sees the company
  switch; when off, staff see "Your company has turned the marketplace off").
- **Platform screen** "Marketplace applications" for the Super Admin only, as a settings
  navigation item (follow `ServerNavigationSettings.jsx`): pending first, each with the
  counts, **Approve**, **Decline** (reason required, confirmation dialog) and, for approved
  companies, **Revoke** (reason required).
- Client: `src/services/crm/marketplace.js`, composed into `src/services/crm/client.js` like
  `agreements.js`. Frontend code in `src/features/server/marketplace/`. English text in a new
  catalogue `src/i18n/catalogs/en/marketplace.js` registered in `catalogs/index.js`.
- Follow `docs/design-standards.md`: current green/gold theme, light and dark, phone width
  first (390 px), 16px gutters, existing components (`Button`, `FinanceDialog`, `Drawer`,
  `FormStepper`), empty, loading and failed states.

### MK1a tests (all must pass)

- `tests/api/marketplace-eligibility.test.mjs`: a fresh company is `not_applied` with the
  failing lines; backdate the company with `query("UPDATE crm_workspaces SET created_at=now()-interval '8 days' WHERE id='…'")`
  and add records with `add()` from `assignment-helpers.mjs` until `met`; staff cannot
  apply; apply → `pending`; Super Admin approves → `approved`; decline with reason →
  `canApplyFrom` is 3 days later and an early apply is 409; revoke works only when approved.
- `tests/api/marketplace-guards.test.mjs`: the Super Admin, another company's member and a
  bad workspace get the same 404 body on every member route; non-Super-Admins get the same
  404 on platform routes; CSRF is required on every POST/PUT; a stale `expectedVersion` is
  409; a direct SQL `UPDATE`/`DELETE` on each insert-only table fails.
- Put the new API files in a new `scripts/crm-api-test-files-marketplace.mjs` and spread it
  into `scripts/crm-api-test-files.mjs` (as `crm-api-test-files-agreements.mjs` is).
- Rust unit tests for the state rules (pending vs latest decision, the 3-day date).
- One browser spec `tests/server-browser/marketplace-apply.spec.js`: the Admin sees the
  checklist, applies, the Super Admin approves in "Marketplace applications", the Admin
  sees the switch. Take screenshots with `shots()` from `tests/server-browser/agreements-helpers.js`.

**Commit MK1a** after every check in "Checks" passes.

## Part MK1b — joining, terms, consent, profile, photo, leaving

### Migration `0074_marketplace_members.sql` (owner: marketplace)

- `crm_market_terms` (insert-only, rows added only by migrations): `version text PK`,
  `body text`, `consent text` (the publication consent), `commitments jsonb` (array of
  strings), `digest text NOT NULL` (lowercase hex SHA-256 of the canonical JSON
  `{"body","commitments","consent","version"}`), `draft boolean NOT NULL`,
  `published_at timestamptz NOT NULL UNIQUE`. Current = newest `published_at <= now()`.
  Insert the first row: version `2026-10-24.1`, `draft = true`, a short plain-English body
  that says it is a draft for UAE lawyer review, the consent "My name, photo, company,
  areas, experience and licence are shown to members of every company on Blaqks One.", and
  the four commitments from `docs/broker-marketplace.md` §2.
- `crm_market_acceptances` (insert-only): `id`, `member_id`, `workspace_id`,
  `terms_version`, `terms_digest`, FK `(terms_version, terms_digest)` to the terms row,
  `UNIQUE (member_id, terms_version)`, `created_at DEFAULT now()`.
- `crm_market_profiles`: `member_id uuid PK`, `workspace_id text NOT NULL`,
  `emirates text[]` (subset of the 7 emirates, at least one), `communities jsonb` (0–12
  `{name, key}`; name ≤ 60 characters of letters, digits, spaces and `' - . &`; key = name
  trimmed and lower-cased), `property_types text[]` (subset of `residential_sale`,
  `residential_rent`, `commercial_sale`, `commercial_rent`, at least one),
  `experience_years smallint CHECK (0..60)`, `licence_number text NULL` (letters and digits,
  ≤ 20), `licence_authority text NULL CHECK (IN ('RERA','ADREC','other'))` (both or
  neither), `photo_id uuid NULL`, `joined_at`, `updated_at`, `version bigint`. **No status
  column** (suspensions come in MK5 as their own table).
- Migration `0075_media_market_profiles.sql` (owner: media): re-create
  `crm_media_objects_owner_kind_check` adding `'market_profile'` (copy the pattern of
  0069; keep every existing kind).

### Routes (member routes run the gate; anything beyond `GET /status`, `GET /terms/…` and `POST /join` also requires an approved, switched-on company and a joined member who accepted the current terms)

| Method and path                  | Answer                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /status`                    | now also `member: { joined, profile, termsCurrent, termsVersion, termsDigest }`                                                                                                                                                                                                                                                                                                              |
| `GET /terms/{version}`           | `{ version, body, consent, commitments, digest, draft }`                                                                                                                                                                                                                                                                                                                                     |
| `POST /join`                     | body `{ profile, commitments: [true…], consent: true, termsVersion, termsDigest }`; one transaction: profile, acceptance, event; 409 `terms_outdated` when the version or digest is not current; the number of `true`s must equal the stored commitments; refused when the company is not approved and on                                                                                    |
| `PATCH /me`                      | `{ expectedVersion, profile }`                                                                                                                                                                                                                                                                                                                                                               |
| `POST /terms/accept`             | `{ termsVersion, termsDigest }` for a newer version                                                                                                                                                                                                                                                                                                                                          |
| `PUT /me/photo`                  | `{ mediaId }`: only an image (`image/jpeg`, `image/png`, `image/webp`) of at most 2 MB that the caller uploaded through `POST /api/crm/workspaces/{ws}/media`; check the type and size before `media::owned::attach` (`owner_kind = 'market_profile'`, owner = member ID); replacing removes the old one (`media::owned::remove_ids`) in the same transaction. `DELETE /me/photo` removes it |
| `POST /leave`                    | removes the profile and photo at once; acceptances and events stay; joining again asks for everything again                                                                                                                                                                                                                                                                                  |
| `GET /profiles/{memberId}`       | another joined member of an approved, switched-on company: `{ memberId, name, company, emirates, communities (names), propertyTypes, experienceYears, licence: { number, authority } \| null, joinedAt, hasPhoto, declared: true }`. Never email or phone. Hidden or unknown → the shared 404                                                                                                |
| `GET /profiles/{memberId}/photo` | the current photo through `media::serve::file` in the profile's own workspace; no media ID in the path                                                                                                                                                                                                                                                                                       |

- **One visibility rule**, written once in SQL in the marketplace module and used by both
  profile routes: profile exists; member active and `owner_active` in that same
  workspace and not the Super Admin; company approved (latest decision), switched on, not
  frozen and not the organisation workspace. Use `crm_user_profiles` through an `auth`
  function, not a direct join from marketplace code (add the function in `auth` if none fits).
- **Free text:** run `agreements::listings::review::looks_like_contact` (make it reachable
  as a shared function if needed, without moving its tests) on every community name and the
  licence number, and refuse text containing `http`, `www.` or `@`.
- **Read limits:** `GET /profiles/…` and `…/photo`: 300 an hour per member and 1,000 an
  hour per company (`throttle::consume_window`).
- **Draft terms when hosted:** refuse joining or accepting a `draft` terms row when the
  server runs in production mode (follow how `auth/consents.rs` refuses draft consent IDs);
  development and tests allow it.

### MK1b screens

- Approved, switched-on, not joined: a short introduction ("Post what your clients are
  looking for; brokers with a matching property answer privately") and **Join the
  marketplace**, a `FormStepper` form: profile → commitments (four separate ticks) and
  consent → terms (readable in full, the draft notice visible) → review → join.
- Joined: "My marketplace profile" (edit, photo upload and remove, **Leave the
  marketplace** with a confirmation) and an empty board ("Client requests arrive with the
  next update"). A newer terms version shows a banner with **Review and accept**.
- Another member's profile opens in a dialog (MK2 will open it from request cards; in MK1
  add a "Preview how others see me" button on your own profile that uses
  `GET /profiles/{yourId}`). Show "Declared by the broker, not verified by Blaqks One" under
  the company and licence.

### MK1b tests (all must pass)

- `tests/api/marketplace-join.test.mjs`: join with all ticks; missing tick, missing consent,
  stale version or digest → refused; edit with `expectedVersion`; leave then the profile and
  photo are 404; rejoin needs consent and terms again; a newer terms row (insert one in the
  test) blocks edits until accepted.
- `tests/api/marketplace-profiles.test.mjs`: a member of another approved company reads a
  profile, never email or phone; the profile hides when the member is suspended, the company
  is switched off, revoked or not approved; the Super Admin and members of unapproved
  companies get the shared 404; a PDF or a 3 MB image as photo → 400; the photo serves to an
  approved member and is 404 after leave; read limits return 429 (pre-fill the throttle row
  as `tests/api/outside-sharing-follow-ups.test.mjs` does).
- Rust unit tests: input validation (communities, licence, contact-like text), the terms
  digest, the commitments count.
- Unit tests for the frontend model readers (strict, like `listingShareModel.js`).
- Extend the browser spec (or add `marketplace-join.spec.js`): join with a photo, see "My
  marketplace profile", preview it, leave. Screenshots with `shots()`.

**Commit MK1b** after every check passes.

## Allowed writes

- `services/crm-api/src/marketplace/` (new), `services/crm-api/src/routes.rs` (merge the
  router and register the error mapping), `services/crm-api/src/lib.rs` or wherever modules
  are declared, `services/crm-api/src/records/market_activity.rs` and `records/mod.rs`, a
  narrow new function in `auth` for the visibility rule if none exists, a re-export of
  `looks_like_contact` if needed, `services/crm-api/migrations/0073…0075`.
- `src/features/server/marketplace/` (new), `src/services/crm/marketplace.js` and
  `client.js`, `src/config/routes.js`, `src/features/server/{ServerContent,access,
ServerNavigationGroups,ServerNavigationSettings}.jsx|js`, `src/i18n/catalogs/en/
marketplace.js` and `catalogs/index.js`.
- `tests/api/marketplace-*.test.mjs`, `tests/api/marketplace-helpers.mjs`,
  `tests/unit/marketplace-*.test.js`, `tests/server-browser/marketplace-*.spec.js`,
  `scripts/crm-api-test-files*.mjs`, `scripts/boundaries.json` (owners for the new tables
  and functions).
- Docs, once built: `docs/broker-marketplace.md` (add "MK1 as built"),
  `docs/service-boundaries.md` (domain map, rule 9 list), `docs/backend-foundation.md`
  (module map), `docs/claude-implementation-roadmap.md` §15 (status), `docs/handoff.md`
  (checkpoint), `docs/database-access.md` (add the marketplace insert-only tables),
  `AGENTS.md` (one feature line).

## Do not change

Listing shares, agreements, co-broking, deals or finance behaviour; existing migrations;
storage, workbook and backup contracts; the demo; other modules' tables; the Arabic
catalogue; anything for MK2 (requests, the board, matching).

## Checks (run all; every one must exit 0; paste the summary lines in your report)

```sh
npm run db:up
cd services/crm-api && cargo fmt --check && cargo clippy --offline --all-targets -- -D warnings && cargo test --offline --lib && cd ../..
npm test && npm run build && npm run check:lines:ci && npm run check:i18n && npm run check:boundaries && npm run format:check
API_TEST_FILES="$(ls tests/api/marketplace-*.test.mjs | paste -sd, -)" npm run test:api
API_TEST_FILES="$(ls tests/api/outside-sharing-*.test.mjs tests/api/agreements*.test.mjs tests/api/team*.test.mjs | paste -sd, -)" npm run test:api
PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only tests/server-browser/marketplace-*.spec.js
```

The full suites run in CI after the owner pushes. If a browser spec is flaky under machine
load, run it alone once more before suspecting the code; never weaken an assertion to pass.

## Report (when both commits are done)

Plain English, at most 30 lines: what a member, an Admin and the Super Admin can now do;
the two commit hashes; every check with its summary line; anything you could not do or
changed from this file and why; screenshots' folder. Then STOP. Do not start MK2.
