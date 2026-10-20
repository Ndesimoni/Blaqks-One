# Team activity (connected)

Status: security design approved by the owner on 2026-10-16. The decisions are recorded in [Product decisions](product-decisions.md#team-activity-decided-2026-10-16).

## Starting point

- **Endpoint:** `workspaces/handlers.rs` lets only an Admin or the Super Admin read the latest 100 `crm_activity` rows. There are no filters and no cursor, and `record_id` is always returned.
- **`crm_activity`** stores the actor, workspace, collection, record UUID, action and source.
- **`crm_team_activity`** stores the member, action and, for access changes, a name only.
- **`crm_finance_events.changes`** holds amounts and reasons, and `crm_assignment_notes` hold business text. Neither may enter this feed.
- **Frontend:** Team activity is gated by `canManageTeam` in `src/features/server/access.js`.

## Who sees what

Scope always comes from the live member re-read.

- **Admin:** all `crm_activity` and `crm_team_activity` rows in their own workspace, including finance and Targets.
- **Assigned-only staff:** a **My activity** view of their own actions only (`actor_id = self`).
  - Rows are limited to collections they are currently granted.
  - Finance rows need the finance module, and Targets rows need reports.
  - They never see team events.
- **Team-scope staff:** all record activity in the workspace for the collections they are granted.
  - Finance rows need the `teamView` finance action, and Targets rows need reports.
  - They never see team events.
- **Super Admin:** only the feed of a workspace they can already open, including archived workspaces, which are read-only.
  - There is no merged feed across companies and no new power.
  - The SaaS phase replaces this with consented, time-limited, logged support access.
- **Channel events** (connected, reconnected, reconnect needed, disconnected) reach only the company's own Admin. Staff and the Super Admin never see them; `kind=channel` returns 403 for them. See [Channel events](#channel-events).
- **Account events** (password changed, sessions revoked) are **not** in this feed. They belong to a later self-only Security history on My profile, and Admins do not see them.

## Sources and item shape

- **Merge only** `crm_activity`, `crm_team_activity` and `integrations.crm_integration_events`. `crm_activity` already records finance actions (earned, approved, voided) and `assigned` by name only.
- **Never merge** `crm_finance_events.changes` or `reason`, `crm_assignments` from/to/notes, or `crm_account_events`. Per-record history endpoints remain the place for detail, and they apply their own 404 rules.

Each item has this shape:

```
{id, at (UTC ISO), kind: 'record' | 'team' | 'channel', action, collection | null,
 actor: {id, name}, record: {id, legacyId} | null, member: {id, name} | null,
 channel?: 'whatsapp' | 'email' | 'facebook' | 'instagram' | 'tiktok', sample: bool}
```

- **`record`** is filled only when the row still exists **and** the caller can see it now.
  - For record collections that means `records::visibility::predicate` plus the collection grant; for Deals, Payments and Expenses it means `finance_predicate`.
  - Otherwise it is `null` and the UI shows **Record unavailable**. Deleted, hidden and unknown records look identical.
- **No names from the server.** It returns no record names, labels or amounts. The UI resolves a display name only from records it has already loaded within the caller's scope.
- **`member`** is returned only to the Admin and the Super Admin.
- **Never appears:** message bodies, recipient addresses, record names or field values, amounts, reasons, hand-off notes, grant contents, credentials, tokens, IPs or User-Agents, another workspace's IDs, and totals or counts.

## Channel events

Added by packet X1a (2026-10-20, messaging design decision O4). `integrations::activity::page` reads `integrations.crm_integration_events` with the shared window and returns `kind: 'channel'` items. They carry `channel` (the only item kind that has the key), the actor and the time. `collection`, `record` and `member` are `null`, and `sample` is false. The account ID, label and credential never appear. Actions: `connected`, `reconnected`, `reconnect_required`, `disconnected`.

- Unfiltered feeds and `kind=channel` include them; `kind=record`, `kind=team` and any `collection` filter exclude them.
- The UI reads "You connected WhatsApp" under a Channels section. The Type filter offers **Channel changes** to the Admin only. Its words come from the `channels` language catalogue.
- Tests: `tests/api/activity-channels.test.mjs`, `tests/unit/activity-channels.test.js` and the Team activity scenario in `tests/server-browser/channels.spec.js`.

## Endpoint

`GET /api/crm/workspaces/{ws}/activity` is extended. The response keeps the `activity` key so existing API tests still pass.

**Query parameters**

| Parameter    | Rule                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `from`, `to` | `YYYY-MM-DD` in Dubai days (fixed UTC+4). Default is the last 90 days; the span is at most 366 days and `to ≥ from`. |
| `actor`      | Filters by actor.                                                                                                    |
| `kind`       | `record` or `team`.                                                                                                  |
| `collection` | Filters by collection.                                                                                               |
| `action`     | Filters by action.                                                                                                   |
| `cursor`     | Opaque base64url of `(created_at µs, id)`.                                                                           |
| `limit`      | 1–100, default 50.                                                                                                   |

**Order:** `created_at DESC, id DESC` across a `UNION ALL`, with the keyset predicate `(created_at, id) < cursor`.

**Response:** `{activity: [...], nextCursor | null}`.

**Check order**

1. Session (401).
2. `ensure_access`: a single 403 for unknown and foreign workspaces.
3. Permission parameters, each 403:
   - `kind=team` from staff;
   - `actor` other than self from assigned-only staff;
   - a collection the caller is not granted (unknown names get the same 403).
4. Syntax and range checks (400).
5. A `REPEATABLE READ READ ONLY` transaction with a live member re-read (403 if no longer a member), then the query.

An `actor` outside the workspace returns an empty list, never a distinct error.

**Code placement (boundary rule 5)**

- `workspaces/` stays free of business domains, so the handler moves to a new `activity/` read module.
- `activity/` calls `records::activity::page` (the owner of `crm_activity`, which applies the predicates) and `team::audit::page`.
- Remove the `workspaces → crm_activity` allowlist entry from `scripts/boundaries.json`.

## Database: migration 0019 (owners: records and team)

Indexes only. There are no schema or content changes, and the append-only triggers stay as they are.

- `crm_activity (workspace_id, created_at DESC, id DESC)`, replacing `crm_activity_workspace`.
- `crm_activity (workspace_id, actor_id, created_at DESC, id DESC)`.
- `crm_team_activity (workspace_id, created_at DESC, id DESC)`.

On a hosted database, create these indexes `CONCURRENTLY`.

## Threats handled

| Threat                          | Handling                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Inferring hidden records        | `record` is null unless the record is visible now; no counts; assigned staff see their own actions only. |
| Actor enumeration               | An unknown actor returns an empty list.                                                                  |
| Team events                     | Visible to managers only.                                                                                |
| Cross-workspace leakage         | Every subquery binds the path workspace; cursors carry no workspace.                                     |
| Timing                          | Only index-bounded workspace queries, and no per-record lookups that return different codes.             |
| DoS                             | Limit ≤ 100, span ≤ 366 days, keyset pagination.                                                         |
| Super Admin actions in a tenant | Shown with their actor for transparency.                                                                 |

## Frontend (built with the senior product designer)

- **Navigation:** **Team activity** for managers; **My activity** for staff (update `access.js`).
- **Filters:**
  - Dubai date range.
  - Member (managers only).
  - Type (record or team).
  - CRM section and action.
  - Clear filters.

  Filter state lives in the URL, and any filter change resets the cursor.

- **List:**
  - Grouped by Dubai day, with continuous scrolling and **Load more** driven by `nextCursor`. There is no total count.
  - Each row shows time, actor, action, section, the record name from the scoped cache or **Record unavailable**, and a Sample badge.
- **States:** a skeleton while loading, an empty state ("No matching activity"), a retryable error, and a 403 view. None of them falls back to demo data.
- **Standards:** design standards, both themes, mobile first, `OverflowList` modes, and at most 150 lines per file.

## Acceptance tests (disposable test database)

**Visibility and paging**

- An Admin sees record and team events. Pages are stable, with no duplicates across cursors, including rows with the same timestamp.
- Assigned staff see only their own rows. After a reassignment or deletion, `record` is null, and the hidden record's UUID never appears.
- Finance rows are hidden without the finance module, and team finance rows need `teamView`. No amounts or reasons appear anywhere.

**Error codes**

- 403:
  - staff asking for `kind=team` or another actor;
  - a foreign or unknown workspace (byte-identical);
  - an ungranted collection sent with a bad date (403 before 400).
- 400: an invalid cursor, limit 0 or 101, a reversed range, or a span over 366 days.

**Access changes**

- A suspended member loses access mid-session (live re-read).
- The Super Admin has parity only.
- An archived workspace is readable only by the Super Admin.

## Deferred

- CSV export. If built: Admin only, generated on the server with the same filters, guarded against spreadsheet formula injection, and itself logged as activity.
- The self-only account Security history.
- Changed field names.
- Live updates.
- A support-access log visible to Admins (SaaS phase).
- A retention policy.
