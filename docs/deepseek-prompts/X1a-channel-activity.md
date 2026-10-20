**Status (2026-10-20): built by Claude at the owner's request instead of DeepSeek.** Kept for reference; do not hand this packet out again.

Packet: X1a — channel events in Team activity

Goal:
An Admin opens Team activity and sees when a channel was connected, reconnected,
marked "reconnect needed" or disconnected, by whom and when — with no account IDs,
labels, phone numbers, email addresses or credentials anywhere in the feed. The Admin can
filter to these events with a new "Channels" kind. (Owner decision O4, 2026-10-20.)

Precondition:

- Start only from a clean, committed checkpoint that includes packet X1 (Channels
  registry, migrations 0031–0032). If `git status` shows uncommitted X1 files, STOP and
  report; do not build on them.

Read first:

- AGENTS.md
- docs/token-efficient-delivery.md
- docs/deepseek-delivery-plan.md §1 (rules for every packet)
- docs/messaging-design.md (§3 `crm_integration_events`, §9, §11, §13 O4)
- docs/messaging-security.md (whole file; the reviewed rules override your X0 draft)
- docs/team-activity-design.md
- docs/service-boundaries.md (rules 9–12 and the decision log D1–D10)
- services/crm-api/src/activity/ (handlers.rs, query.rs, window.rs, query_tests.rs)
- services/crm-api/src/team/audit.rs and services/crm-api/src/records/activity.rs
  (the two existing `page` sources — copy their pattern exactly)
- services/crm-api/src/integrations/ (model.rs, store.rs, store_write.rs)
- src/features/server/activity/ (activityVocabulary.js, activityModel.js,
  activityFilters.js, ActivityRow.jsx, ActivityFilters.jsx)

Allowed writes:

- services/crm-api/src/integrations/activity.rs (new) and integrations/mod.rs
- services/crm-api/src/activity/handlers.rs, query.rs, window.rs, query_tests.rs, and a
  new sibling file under services/crm-api/src/activity/ if a split is needed for the
  150-line limit (handlers.rs is already 140 lines; query.rs is 146)
- src/features/server/activity/ (only the files needed for the new kind, labels and filter)
- src/i18n/catalogs/en/channels.js and src/i18n/catalogs/ar/channels.js
- tests/api/activity-channels.test.mjs (new), scripts/crm-api-test-files.mjs
- tests/server-browser/channels.spec.js (one added scenario)
- scripts/boundaries.json (only if the boundary check needs it)
- docs/service-boundaries.md (new decision-log row D11), docs/team-activity-design.md,
  docs/messaging-integrations-plan.md (status line only)

Do not change:

- browser-local demo, demo data or demo tests
- storage/workbook/backup contracts
- migrations (no new migration is needed: `crm_integration_events` already has
  `id, workspace_id, connection_id, action, actor_id, created_at`)
- integrations write paths, crypto, provider adapters or the Channels screen behaviour
- the response shape of existing activity items (record and team items must serialise
  byte-for-byte as today)
- any other module, provider setting or public route

Implementation steps:

1. Add `integrations::activity::page(transaction, &Window, &UserRow) -> ApiResult<Vec<Item>>`,
   following `team::audit::page`: same `Window::clause("e")`, `Window::stamps("e")`,
   `Window::bind`, ordering `created_at DESC, id DESC`, `LIMIT $7`.
   - It reads only `integrations.crm_integration_events` joined to
     `integrations.crm_channel_connections` for the channel name, plus the actor's display
     name resolved the same way `team::audit::page` and `records::activity::page` resolve
     it. Record the cross-module name lookup as decision-log row D11.
   - It returns `kind: "channel"`, `collection: None`, `record: None`, `member: None`,
     `sample: false`.
2. Add one optional field to `activity::window::Item`: `channel: Option<&'static str>`
   (one of whatsapp/email/facebook/instagram/tiktok), with
   `#[serde(skip_serializing_if = "Option::is_none")]` so existing items are unchanged.
   Map the stored channel through `integrations::model::Channel::parse(..).as_str()`;
   never pass stored text through.
3. Visibility: only a live company Admin of that workspace receives channel items. Staff
   and the Super Admin receive none (design §11 and SEC-10). Decide this from the
   re-read live member inside the REPEATABLE READ snapshot, as the other sources do.
4. `handlers::list`: include channel items when `kind` is absent or `kind=channel`, and
   when no `collection` filter is set (same rule as team items). `kind=record` and
   `kind=team` exclude them.
5. `query.rs`: accept `kind=channel`, only for an Admin (staff naming it get the same
   403 as `kind=team`); accept the four channel actions in the `action` filter.
   Unknown kinds and actions still return 400.
6. Frontend: the "Channels" kind in the filter (Admins only), a row label per action,
   e.g. "Connected WhatsApp", "Reconnected Email", "WhatsApp needs reconnecting",
   "Disconnected Instagram", and the channel icon used on the Channels screen. All new
   text goes through `useI18n()` with English and Arabic keys in the channels catalogues;
   new CSS uses logical properties only.
7. Docs: D11 in service-boundaries, a short "Channel events" section in
   team-activity-design.md, and update the plan status line to "X1a built, awaiting
   review".

Required behavior:

- No feed response, log line or error ever contains an external account ID, display
  label, credential, phone number or email address from a channel connection.
- Paging, cursors, date ranges, the actor filter and newest-first merging behave exactly
  as for the existing sources; channel items interleave correctly with record and team
  items on the same page and across page boundaries.
- Another company's channel events never appear, including through a forged workspace in
  the path (the existing single 403 applies).
- An archived or demoted Admin stops seeing channel items on the next request.

Required tests (synthetic data, disposable PostgreSQL only):

- Rust (query_tests.rs or a new tests file): `kind=channel` and the four actions parse;
  unknown kind/action rejected; `Item` without a channel serialises with no `channel` key.
- API (tests/api/activity-channels.test.mjs, registered in scripts/crm-api-test-files.mjs):
  1. Admin connects, reconnects and disconnects a stub WhatsApp connection; the feed shows
     the three events newest first with `kind: "channel"`, `channel: "whatsapp"`, the
     actor and no `record`/`member`.
  2. The response text contains neither the synthetic account ID nor the label nor the
     credential.
  3. Staff (whole-team and assigned-only) see no channel items; `kind=channel` returns 403
     for staff.
  4. The Super Admin reading that company's activity sees no channel items.
  5. A second company's Admin never sees the first company's channel events.
  6. `kind=channel` returns only channel items; `kind=record`/`kind=team` return none;
     a `collection` filter excludes them.
  7. Paging with `limit=1` across a mix of record, team and channel events returns each
     event exactly once.
- Browser (one scenario in tests/server-browser/channels.spec.js): after connecting and
  disconnecting, Team activity filtered to Channels shows both rows; check 390px and
  1280px and both themes as the existing scenarios do.

Required checks:

- cargo fmt --check, cargo clippy --all-targets -D warnings, cargo test
  (manifest services/crm-api/Cargo.toml)
- npm test, npm run build, npm run check:lines (no changed file over 150 lines),
  npm run check:boundaries, npm run check:i18n, npm run format:check
- npm run test:api, then
  PLAYWRIGHT_CHANNEL=chrome npm run test:server:e2e -- --browser-only tests/server-browser/channels.spec.js
- Do not run npm run test:e2e (frozen demo).

Output:
Changed / Checks / Problems / Next
Report the exact command output for any failing check. Do not commit.
