# Action permissions design (roadmap packet A2)

**Status: frozen contract (2026-10-13).** Security-reviewed (approve with changes, §12) and owner-approved (§13). Proposed by senior_architect. It amends the frozen [Assignments design](assignments-design.md) §4/§5 once approved. Owner rules in [Product decisions](product-decisions.md) take precedence.

## 1. Decision summary

1. Module grants (`permissions`, six booleans) are unchanged and mean **can view**. They keep driving navigation, visibility, projections, assignee eligibility and departure release.
2. New per-module **action flags** are stored separately in `crm_users.actions` (JSONB), read through a typed Rust struct, covering the three connected modules:
   - relationships: `create`, `edit`, `assign`, `deleteMain`
   - properties: `create`, `edit`, `assign`, `deleteActivity`, `deleteMain`
   - schedule: `create`, `edit`, `assign`, `deleteActivity`
3. `deleteActivity` covers Shortlist, Follow-ups, Viewings, Interaction log and Client care. `deleteMain` covers Clients, Contacts and Properties and is always ANDed with team scope, so the H2 invariant holds.
4. **Backfill reproduces today exactly** for every non-archived staff member: create, edit, assign and deleteActivity equal the module boolean; deleteMain = module ∧ `record_scope='team'`. New sensitive grants are denied by default: positions never set deleteMain, invitations cannot set it, and a scope change never turns it on.
5. Admins and the Super Admin have every action within their scope by role; their stored `actions` stays `'{}'`. All role checks become allowlists.
6. The action check joins **step 2** of the §4 check order and repeats at **step 4** under the lock. It depends only on the caller and the collection, so it returns 403 before any target is fetched: hidden, unknown and cross-team IDs get the same response.

## 2. Current-state facts

- `Permissions` is six flat booleans with `deny_unknown_fields` (`auth/permissions.rs:3-12`); collection→module mapping at `:26-33`.
- Role deny-lists (defence-in-depth gap; DB limits roles to three, `0004_admin_teams.sql:1-3`): `effective_permissions()` (`auth/profile.rs:38-44`), `manages_team` (`:85`), `team/access.rs:29,43`, `workspaces/handlers.rs:59`. `has_team_scope` is already an allowlist.
- H2 parent delete: handler `records/handlers.rs:88-89`, live re-check `deletion.rs:21-22`, rule and message "Ask your Admin to delete this record." `visibility.rs:51-57`.
- Live re-check under the lock: `ensure_writable(tx, ws, actor, Option<collection>)` (`workspaces/mod.rs:57-78`); bulk and imports pass `None`.
- Assignment: holder or team scope may reassign (`assignments/eligibility.rs:47-63`); queue and return rules (`assignments/handoff.rs`); eligibility uses module read (`eligibility.rs:39-41`); bulk requires team scope (`bulk.rs:36`).
- Team edits run under the workspace lock, `lock_owner` and `FOR UPDATE` with a version check (`team/members/update_store.rs:24-49`), compare effective permissions for release (`:50,69-73`), delete the member's sessions (`:78-79`) and log only the action name (`:80-90`).
- Archived accounts are immutable (`crm_archived_account_immutable`, `0005:31-40`), so a backfill must skip them.
- Frontend: `canDeleteRecord` (`src/features/server/access.js:24-26`) is used in `useServerRecordActions.js`; Add/Edit/Delete are otherwise hidden only for read-only archived workspaces.

## 3. Data model

```sql
-- migrations/0009_action_grants.sql
ALTER TABLE crm_users ADD COLUMN actions JSONB NOT NULL DEFAULT '{}',
  ADD CONSTRAINT crm_actions_object CHECK (jsonb_typeof(actions)='object'),
  ADD CONSTRAINT crm_actions_staff  CHECK (role='staff' OR actions='{}'::jsonb);
-- Backfill non-archived staff (see §1.4) with COALESCE against JSON nulls; versions and
-- sessions untouched. Recreate crm_all_user_profiles → crm_user_profiles →
-- crm_member_profiles with u.actions appended last (as in 0008).
```

- **Why a JSONB column:** nesting inside `permissions` would break older binaries (`deny_unknown_fields`) and the flat OR/release logic; a grants table adds a join and diff-style PATCHes with no foreign-key targets yet; a bitmask is opaque. It matches `permissions`, `channel_access` and `record_scope`, which already change atomically with the member `version`.
- **Rust (`auth/actions.rs`):** `ModuleActions`, `Actions`, `enum Action { Create, Edit, Delete, Assign }`. The stored decoder is lenient (unknown keys ignored, missing keys false); the request decoder is strict.
- **`UserRow::can(collection, action)`:** false without module access; true for `admin`/`super-admin`; false for any other non-`staff` role; for staff: Create→`create`, Edit→`edit`, Assign→assignable collection ∧ `assign`, Delete→ parents: `has_team_scope() ∧ deleteMain`, otherwise `deleteActivity`.
- **Save invariants:** a module that is off has all actions false; `deleteMain` false unless the final scope is team; every staff row holds a complete object.
- **Position presets:** for each module a position grants, create, edit, assign and deleteActivity are true and deleteMain false (today's behaviour). Multiple positions combine with OR.
- **Archived staff** keep `'{}'`; read-only views show "Action access not recorded (archived before action grants)".
- **Deferred §5 rows:** shared business resources (I1), conversations and sending (P2/P3/M2/M3), bulk campaigns (M4), listing drafts/represent/submit/withdraw (W2/P6), monitoring (L1), calendars (S1), exports (P10), finance actions (when Deals connects). Later flags arrive as new module keys, denied by default; resource-specific grants go in a future `crm_resource_grants` table once the I1 registry exists. Admin creation, publication approval and staff management stay role-based.

## 4. Check-order changes (amends assignments-design §4)

| Step       | Change                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2          | Module grant plus `ensure_action(collection, action)` from the session profile; absorbs H2.                                                          |
| 4          | `ensure_writable` takes `(collection, action)` and repeats both checks on the live row. Imports and bulk keep `None`.                                |
| 7 (assign) | A non-holding direct assignee returning a client-linked Follow-up (`null`) needs no Assign grant; any other assign re-checks Assign on the live row. |

403 messages (code `forbidden`, caller-dependent only):

- Create: "Your access doesn't include adding these records."
- Edit: "Your access doesn't include editing these records."
- Delete: "Ask your Admin to delete this record." (unchanged)
- Assign: "Your access doesn't include handing on these records."
- No module: "Access denied."

A member without the action who sends an invalid body gets 403, not 400. POST→Create, PATCH→Edit, DELETE→Delete, `PUT …/assignee`→Assign, bulk→team scope ∧ Assign for every listed collection. Reads, projections, assignee lists, history, eligibility and departure release are unchanged; losing an action releases nothing.

## 5. API contract

- Profile (session, login, team entries) gains `actions` (stored, normalised; all true for Admins) and `recordActions` (effective `{create, edit, delete, assign}` for all eight connected collections). The frontend never re-derives the rules. `GET team` returns `roles[].actions` presets.
- `PATCH /workspaces/{ws}/team/{id}` accepts an optional complete `actions`. 400 for malformed/unknown keys ("Provide valid team member changes."), a non-staff target ("Record actions apply to staff only.") or `deleteMain` with assigned scope ("Deleting clients, contacts or properties needs whole-team visibility."). Absent `actions`: changed positions → presets; module switched on → its preset; otherwise keep stored; scope to assigned clears `deleteMain`. Existing version 409, lock and session deletion apply; activity records only `updated`.
- `POST …/team/invitations` accepts optional `actions` (default presets); `deleteMain: true` → 400.

## 6. Frontend contract (connected only; demo untouched)

- `access.js` `canAct(user, module, action)` reads `recordActions` (Leads→Clients), denying when missing; replaces `canDeleteRecord`. `useServerRecordActions` exposes `can(module, action)`; `add`/`edit`/`deleteRecord` refuse with the server-equivalent message. Demo consumers default to allow-all.
- Hide Add (pages, tables, empty states, Leads, Client desk, PropertyDirectory, DashboardWelcome, PrioritiesPanel, Guide), Edit/Delete (RecordDetails, PropertyRecordDetails), Reassign (`useAssignment`) and bulk move (team scope ∧ assign) when not allowed. Show a "View only" chip when create and edit are both missing; empty state "Records assigned to you will appear here." On 403 keep the draft and show the message.
- Team member form: new `TeamActionFields.jsx` per enabled module (Add · Edit · Hand on · Delete activity · Delete clients & contacts / Delete properties), 44px targets, accessible legends. deleteMain disabled with "Needs whole-team visibility" unless whole team; switching back clears it. Positions re-apply presets; "Use position defaults" resets. The review step lists actions and flags deleteMain as sensitive. Invitations omit deleteMain. Helpers in `server-team/actionModel.js`.

## 7. Migration and rollback

Non-archived staff get the exact equivalent of today; Admins keep `'{}'`; archived rows untouched; no version bumps or session revocation. Prefer forward fixes. An emergency rollback (removing migration 9's `_sqlx_migrations` row) lifts action restrictions while the old binary runs; re-upgrading needs a repair migration re-running the backfill for `'{}'` staff and clearing `deleteMain` where scope is not team. Verify migrator and `FromRow` behaviour in B1. Old frontends ignore the new fields.

## 8. Packets

| Packet | Owner             | Write set                                                                                                                                                                                                                                                                                                                                        | Acceptance                                                                                                                                                            |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1     | backend_database  | `migrations/0009_action_grants.sql`; `auth/{actions,actions_tests,mod,profile,profile_tests}.rs`; `team/catalogue.rs` → new `team/positions.rs`; `team/members/{update,update_store}.rs` (+ new `prepare.rs`); `team/invitations/{create,store}.rs`; `team/access.rs`; `workspaces/handlers.rs`; `tests/api/permission-{migration,team,helpers}` | Seeded backfill equivalence matrix; profile fields; PATCH/invite validation and normalisation; deny-by-default; allowlist tests; no grant data in activity; stale 409 |
| B2     | backend_database  | `workspaces/mod.rs`; `records/{handlers,creation,mutation,deletion,visibility}.rs`; `assignments/{assign,bulk,handoff,handoff_tests}.rs`; `tests/api/permission-matrix-{create,edit,delete,assign}`                                                                                                                                              | Full matrix; identical 403 for visible/hidden/unknown/cross-team; 403 before 400; revocation race; return exemption; bulk per collection; existing suites unchanged   |
| F1     | frontend_engineer | `features/server/{access,useServerRecordActions}.js`; records pages/details; Leads, Client desk (split, 254 lines), PropertyDirectory, Dashboard, Guide; assignment hooks; unit tests                                                                                                                                                            | Every entry point gated; demo unchanged; View-only chip; 403 keeps draft                                                                                              |
| F2     | frontend_engineer | `server-team/{model,actionModel,TeamActionFields,TeamAccessFields,TeamRecordScopeFields,TeamMemberReview}`; `team-actions.css`; unit tests. Do not grow `TeamMemberDialog.jsx`                                                                                                                                                                   | Presets, module on/off, deleteMain gating, payload, review text                                                                                                       |
| Q      | qa_accessibility  | `tests/server-browser/permissions-*`                                                                                                                                                                                                                                                                                                             | Browser matrix below                                                                                                                                                  |

Order: owner answers → contract freeze → security review → B1 → B2 ∥ F2 (F1 after freeze) → Q → docs.

## 9. Test matrix

- **API:** 8 collections × {POST, PATCH, DELETE, PUT assignee, bulk} × {Admin, Super Admin, staff assigned, staff team+deleteMain, staff team without deleteMain, staff view-only, staff without module, other team}; a golden pre-A2 equivalence table; leakage (identical 403 across ID kinds, 403 before 400); revocation race; Follow-up return without Assign; team endpoint authority; migration and audit redaction.
- **Browser:** view-only staff see no Add/Edit/Delete/Reassign and see the chip; create-only member cannot edit; deleteMain shows Delete on Clients only with team scope; team form presets, gating, clearing, review, focus order and 44px targets at 390px and desktop in both themes; existing suites and demo unchanged.

## 10. Risks

Backfill mistakes (mitigated by the seeded equivalence test); a missed UI entry point (server stays authoritative); emergency rollback lifts restrictions (repair migration); Shortlist delete follows `properties.deleteActivity` (document it); form size (only enabled modules shown); view-only members can still hold records.

## 11. Owner questions

1. Deleting clients, contacts and properties: (a) current whole-team members keep it — recommended yes; (b) future whole-team access includes it automatically — recommended no, a separate tick; (c) assigned-only staff ever get it — recommended no.
2. Whole-team members with "Hand on" may move anyone's records, including bulk and the Admin queue (12 Oct rule) — recommended yes, no separate tick yet.
3. View-only members can still be assigned records — recommended yes.

## 12. Security review amendments (2026-10-13)

Security verdict: **approve with these changes**; no High findings. They override earlier sections where they differ.

- **M-A Assign check and the return exemption.** Step 2 requires Assign for `PUT …/assignee` unless the collection is Follow-ups. After body parse, a non-null `assigneeId` requires Assign. At step 7, using the live row from `ensure_writable`, a caller without Assign may only return: `Assigned(caller)` ∧ direct assignee is the caller ∧ `client_ref` present ∧ not holding the client ∧ `null`. Everything else is 403 "Your access doesn't include handing on these records." On this path hidden and unknown IDs give the identical 404 and visible ones 403.
- **M-B Bulk live re-check.** Under the lock, bulk requires team scope ∧ Assign on every listed collection from the live row; optionally a pre-parse check for Assign on any assignable collection.
- **M-C Parent delete covers referencing modules.** `can(Delete)` on a parent also requires view grants on every module that can reference it (Clients: schedule ∧ properties; Properties: schedule; Contacts: properties). The same coverage applies to parent ID changes by team-scope staff (400 "Record IDs cannot be changed."). Otherwise the FK 409 reveals records in modules the member cannot see. Tightening; needs owner sign-off.
- **M-D Positions never widen an enabled module.** With `actions` absent: module newly on → preset; module still on → keep stored; module off → all false; scope to assigned clears deleteMain. "Use position defaults" sends an explicit `actions`.
- **M-E Rollback fails closed.** Never delete the migration row; an old binary refuses to start (sqlx checksum/version). If one must run, suspend staff whose actions are narrower than their modules and delete their sessions first. Write 0009 idempotently (`IF NOT EXISTS` guards); never edit it after release. The stored decoder treats any non-`true` value as false per key, so a malformed row never breaks decoding.
- **L-1 Backfill.** Use `permissions->'<module>' = 'true'::jsonb`; update `crm_users` directly for `role='staff' AND deleted_at IS NULL`, including pending, suspended and suspended-Admin staff; assert no non-boolean module values first.
- **L-2 Database guard.** CHECK that `deleteMain` is true only with `record_scope='team'`; Admin rows always `'{}'` (`actions=COALESCE($n,actions)`); actions on an Admin invitation → 400.
- **L-3 Link changes are Edit.** Re-parenting and contact relinking are Edit, not Assign; document so "Hand on" is not read as a boundary on moving work.
- **L-4 Allowlist inventory.** Also convert `team/members/update.rs:84`, `update_store.rs:69`, `records/history.rs:98`, `auth/profile.rs:79-85`, `team/invitations/store.rs:28`; unit-test that an unknown role gets nothing.
- **L-5** `GET assignees` requires Assign or team scope.
- **L-6** Team activity records an `access_changed` action (no grant contents) when grants change.
- **Info:** path-only 400s (unknown collection, non-assignable PUT) stay before the action check; the frontend denies on missing or failed `recordActions`, never echoes an Admin's synthesised actions, and shows archived `'{}'` as "not recorded".
- **Tests added to §9:** M-A–M-D scenarios, revocation races for single and bulk assign, pending/suspended equivalence rows, unknown-role allowlist, malformed stored actions, rollback dry-run on the disposable database.

## 13. Owner answers (2026-10-13)

The owner accepted every recommendation; see [Product decisions](product-decisions.md#action-permissions-decided-2026-10-13).

1. deleteMain is a separate tick, off by default, team scope only; the backfill keeps it for current whole-team members (subject to M-C coverage); assigned-only staff never get it.
2. Hand on for whole-team members covers bulk and the Admin queue.
3. View-only members remain assignable (eligibility stays a module-view check).
4. M-C referencing-module coverage applies to parent deletes and parent ID changes. The backfill sets deleteMain only where coverage holds, and the migration test lists the members who lose it.
5. **Direct-assignee delete (new rule, B2):** for a client-linked Follow-up, an assigned-only caller who is the direct assignee but does not hold the client cannot delete it: 403 "Only the client's holder, the Admin or a full-team member can delete this follow-up." This check sits after the visibility-filtered fetch, so hidden and unknown IDs still give the identical 404.

## 14. Implementation notes (B1/B2, 2026-10-13)

Deviations and clarifications made while implementing; everything else follows §1–§13.

1. **Relationships deleteMain backfill.** One flag covers Clients and Contacts, whose M-C coverage differs. The backfill sets `relationships.deleteMain = relationships ∧ team ∧ properties` (Contacts coverage), so team members without Scheduling keep Contact deletes; Clients additionally need Scheduling, enforced by `can`. `properties.deleteMain = properties ∧ team ∧ schedule`. The seeded test lists the members who lose a parent delete; 0009 carries the same report query as a comment.
2. **Coverage at check time only.** PATCH does not refuse `deleteMain` when a referencing module is off; `actions.*.deleteMain` shows the stored tick and `recordActions.<Collection>.delete` shows the effective result.
3. **Unrecorded actions.** Staff whose stored value is `{}` (archived before 0009) get `"actions": {}` and all-false `recordActions`; every other staff profile gets the complete normalised object.
4. **Invitation shape.** Invitation `actions` may omit `deleteMain` (treated as false); unknown keys and `deleteMain: true` are still refused (400). PATCH requires complete objects.
5. **Explicit actions are normalised.** Flags sent for a module that is off are cleared rather than refused.
6. **Activity.** `access_changed` is added (alongside `updated`/`suspended`) when stored modules, actions, record scope or channel access change; it never stores contents.
7. **Messages.** `GET assignees` without Assign or team scope returns the Assign 403. Bulk refuses callers without Assign on any assignable collection before reading the body; a listed non-assignable collection is still a 400 for other callers. The §13 item 5 delete check runs after the version check (step 7 order).
8. **Unknown roles.** The database limits roles to three, so the unknown-role allowlist is covered by unit tests (`grants_tests.rs`, `action_grants.rs`); such a role gets no modules, actions or team management. Its display label stays "Staff".
9. **Rollback dry-run.** `tests/api/permission-rollback.test.mjs` runs a pre-0009 build (`CRM_PRE_A2_BINARY`) against the migrated test database: it exits with "CRM schema migration failed." and leaves `_sqlx_migrations` unchanged. Without the variable the check is skipped.
