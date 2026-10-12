# Assignments and assigned-only visibility (P1 / A1)

Status: **frozen implementation contract (packet C0), 2026-10-12.** Sources: [product decisions](product-decisions.md) ("Record visibility and assignment", "How assignment works", "Assignment details") and the security review (H1–H4, M1–M7 binding; L1–L5 adopted). Changes to this contract require the primary agent's approval, and the owner's where a product decision is involved. Open items are marked **UNRESOLVED**.

## 1. Scope and non-goals

In scope: assignees on Clients, Properties and Contacts; direct assignees on Follow-ups; inherited visibility for child records; the full-team grant (`recordScope`); server-issued record IDs; the assignment API with history and hand-off notes; the Admin queue; departure and permission-reduction release; the `references`, `taskClients` and `listingViewings` projections; and the connected UI for all of these.

Non-goals: **A2** (separate read/create/edit/delete/assign actions) is deferred, so module grants are unchanged and `recordScope` is layered on top. Notifications and "keep sender informed" (P2), server pagination, and server-computed exports, reports and dashboards are out of scope. When those are built they must use the visible set (§3) intersected with module grants, require the `exports`/`reports` grant, never include projections, and draw recipient suggestions only from visible Clients and Contacts. The demo is unchanged.

Terms:

- **Team scope:** Admin, Super Admin, or staff with `record_scope='team'`.
- **Assigned-only:** any other staff member.
- **Holder:** for Clients, Properties and Contacts, `assignee_id`. For a Follow-up, `assignee_id` if set, otherwise the holder of its linked client.
- **Owner:** `crm_workspaces.owner_id` (the Super Admin for the organisation workspace).

## 2. Schema: `migrations/0008_assignments.sql`

```sql
ALTER TABLE crm_users ADD COLUMN record_scope TEXT NOT NULL DEFAULT 'assigned'
  CHECK (record_scope IN ('assigned','team'));
ALTER TABLE crm_users ADD CONSTRAINT crm_record_scope_staff
  CHECK (role='staff' OR record_scope='assigned');            -- Admins are team by role
-- Recreate crm_all_user_profiles, crm_user_profiles, crm_member_profiles in dependency
-- order with record_scope APPENDED as the last column (CREATE OR REPLACE cannot reorder).

ALTER TABLE crm_records ADD COLUMN assignee_id UUID REFERENCES crm_users(id),
  ADD CONSTRAINT crm_records_assignable CHECK
    (assignee_id IS NULL OR collection IN ('Clients','Properties','Contacts','Follow-ups'));
-- Clients/Properties/Contacts: NULL = Admin queue ("Unassigned · needs owner").
-- Follow-ups: NULL = no direct assignee (inherits from client).

CREATE TABLE crm_assignments (                 -- append-only audit; NO FK to crm_records (M4)
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
  record_id UUID NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('Clients','Properties','Contacts','Follow-ups')),
  from_id UUID REFERENCES crm_users(id),
  to_id UUID REFERENCES crm_users(id),
  actor_id UUID REFERENCES crm_users(id),
  reason TEXT NOT NULL CHECK (reason IN
    ('created','backfill','reassigned','bulk','departure','access_removed','import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (actor_id IS NOT NULL OR reason='backfill'));
CREATE TRIGGER crm_assignments_immutable BEFORE UPDATE OR DELETE ON crm_assignments
  FOR EACH ROW EXECUTE FUNCTION prevent_crm_activity_change();

CREATE TABLE crm_assignment_notes (            -- business content; never in activity/logs/errors
  assignment_id UUID PRIMARY KEY REFERENCES crm_assignments(id),
  record_id UUID NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 1000));
CREATE FUNCTION prevent_crm_note_update() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Hand-off notes are read-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER crm_assignment_notes_immutable BEFORE UPDATE ON crm_assignment_notes
  FOR EACH ROW EXECUTE FUNCTION prevent_crm_note_update();      -- cascade DELETE allowed

ALTER TABLE crm_activity DROP CONSTRAINT crm_activity_action_check;
ALTER TABLE crm_activity ADD CONSTRAINT crm_activity_action_check
  CHECK (action IN ('created','updated','deleted','assigned'));

CREATE INDEX crm_records_assignee ON crm_records(workspace_id, assignee_id)
  WHERE assignee_id IS NOT NULL;
CREATE INDEX crm_records_queue ON crm_records(workspace_id, collection)
  WHERE assignee_id IS NULL AND collection IN ('Clients','Properties','Contacts');
CREATE INDEX crm_records_contact_links ON crm_records(workspace_id, contact_id)
  WHERE contact_id IS NOT NULL;
CREATE INDEX crm_assignments_record ON crm_assignments(record_id, created_at);
CREATE INDEX crm_assignment_notes_record ON crm_assignment_notes(record_id);
```

**Backfill (M6).** Leaves `version` and `updated_at` untouched.

```sql
WITH creators AS (
  SELECT DISTINCT ON (a.record_id) a.record_id, a.actor_id
  FROM crm_activity a JOIN crm_records r
    ON r.id=a.record_id AND r.workspace_id=a.workspace_id AND r.collection=a.collection
  WHERE a.action='created' ORDER BY a.record_id, a.created_at, a.id),
resolved AS (
  SELECT r.id, w.owner_id, CASE WHEN EXISTS (
      SELECT 1 FROM crm_user_profiles p
      WHERE p.id=c.actor_id AND p.role='staff' AND p.active AND p.owner_active
        AND p.workspace_id=r.workspace_id
        AND (p.permissions ->> CASE r.collection WHEN 'Properties' THEN 'properties'
             WHEN 'Follow-ups' THEN 'schedule' ELSE 'relationships' END) = 'true')
    THEN c.actor_id END AS staff_creator, r.collection
  FROM crm_records r JOIN crm_workspaces w ON w.id=r.workspace_id
  LEFT JOIN creators c ON c.record_id=r.id
  WHERE r.collection IN ('Clients','Properties','Contacts','Follow-ups'))
UPDATE crm_records r SET assignee_id = CASE WHEN x.collection='Follow-ups'
  THEN x.staff_creator ELSE COALESCE(x.staff_creator, x.owner_id) END
FROM resolved x WHERE r.id=x.id;
INSERT INTO crm_assignments (id,workspace_id,record_id,collection,to_id,reason)
SELECT gen_random_uuid(), workspace_id, id, collection, assignee_id, 'backfill'
FROM crm_records WHERE assignee_id IS NOT NULL;
```

Viewings, Shortlist, Interaction log and Client care are not backfilled; they inherit visibility. The migration notes include a read-only report query that lists staff-created child records whose client the creator will no longer hold.

**Eligibility backstop.** Created **after** the backfill, because archived workspaces keep their archived owner as assignee.

```sql
CREATE FUNCTION crm_check_assignee() RETURNS trigger AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM crm_user_profiles p WHERE p.id=NEW.assignee_id
       AND p.workspace_id=NEW.workspace_id AND p.active AND p.owner_active) THEN
    RAISE EXCEPTION 'Assignee is not an active member of this workspace' USING ERRCODE='23514';
  END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER crm_records_assignee BEFORE INSERT OR UPDATE OF assignee_id ON crm_records
  FOR EACH ROW EXECUTE FUNCTION crm_check_assignee();
```

The module grant is checked in Rust by `assignments::eligible`. A 23514 from the trigger means a Rust bug and surfaces as the generic 503.

## 3. Visibility (`records/visibility.rs`, the only place)

`RecordScope::{Team, Assigned(Uuid)}` comes from the **profile row re-read under the workspace lock** (H4). `workspaces::ensure_writable` returns that `UserRow`; reads re-read the profile inside the list transaction. Every result is also filtered by `can_collection` (M7), so team scope never bypasses module grants.

```sql
visible AS (  -- Assigned(me); $1 = workspace, $2 = caller
  SELECT r.id FROM crm_records r WHERE r.workspace_id=$1 AND (
    r.assignee_id=$2
    OR (r.collection IN ('Follow-ups','Viewings','Shortlist','Interaction log','Client care')
        AND r.client_ref IN (SELECT legacy_id FROM crm_records
              WHERE workspace_id=$1 AND collection='Clients' AND assignee_id=$2))
    OR (r.collection='Contacts' AND r.legacy_id IN (SELECT contact_id FROM crm_records
              WHERE workspace_id=$1 AND collection='Properties' AND assignee_id=$2))))
```

`Team` returns every row in the workspace. In both cases only granted collections are returned.

**Reads (L3).** `GET records` runs as one `REPEATABLE READ READ ONLY` transaction: profile → scope → records → references → taskClients → listingViewings.

- **`references` (M1):** records linked from a visible row (through `contact_id`, `client_ref`, `property_ref` or `referral_ref`) that the caller cannot see. Only for collections the caller has a grant for. ID and name only (`Clients {client_id, full_name}`, `Properties {property_id, listing_title}`, `Contacts {contact_id, full_name}`). No counts; never pickable.
- **`taskClients` (decision 2, a narrow exception to M1):** Clients linked from visible Follow-ups whose `assignee_id` is the caller, where that Client is not visible to the caller. Contains `{client_id, full_name, phone, email}` (string payload values or `null`). Delivered **even without the relationships grant**, and excluded from `references.Clients`. Nothing else from the client is returned, and these entries are never pickable. M1 otherwise holds unchanged.
- **`listingViewings` (decision 6):** Viewings whose `property_ref` is a Property with `assignee_id` equal to the caller, where the Viewing itself is not visible to the caller. Requires the properties grant. Contains `{property_id, appointment_date_time (string ≤64 chars or null), agent: {id, name} | null}`, where agent is the holder of the viewing's client (null means queue or no client). Ordered by `appointment_date_time`, then agent name. It never includes the viewing UUID, `viewing_id`, `client_id`, client name, status, feedback or `next_action`, and nothing in it can be used to fetch a viewing. What it intentionally reveals is the timing and number of other agents' viewings on a property the caller holds, and which teammate is responsible for each. A team-scope caller with the schedule grant receives `[]`, because they already see every Viewing.

## 4. Canonical check order (H1)

Every endpoint runs these steps in this order, and no step runs after an earlier failure. Hidden and unknown targets use the same single query (L2).

| #   | Step                                                                                                                                | Failure                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Workspace access (`ensure_access`); then Origin/CSRF (`protection::mutation`) on writes                                             | 403 `forbidden` "Access denied." (existing protection responses)                                                                             |
| 2   | Module grant for the path collection (plus the per-endpoint rules below)                                                            | 403 `forbidden` "Access denied."                                                                                                             |
| 3   | Target-independent body validation (JSON, `validate`, reserved keys, version ≥ 1, UUID syntax, scope-only rules)                    | 400 `invalid_request` (messages below)                                                                                                       |
| 4   | `workspaces::lock`; re-read profile → scope (inactive or grant lost → 403)                                                          | 403 `forbidden`                                                                                                                              |
| 5   | Fetch target `WHERE id=$ AND workspace_id AND collection AND id IN visible FOR UPDATE`                                              | 404 `not_found` "Record not found."                                                                                                          |
| 6   | Version                                                                                                                             | 409 `version_conflict` "This record changed. Reload before saving." (delete: "…before deleting.")                                            |
| 7   | Legacy-ID immutability, holder and re-parenting rules (§5), compared only with the row from step 5                                  | per §5                                                                                                                                       |
| 8   | Scoped link checks: a changed link must target a visible record; an unchanged link (compared with step 5's link columns) is allowed | 409 `link_missing` with the existing per-slot message; hidden and missing are identical                                                      |
| 9   | Absent-link rule (assigned-only child with no client)                                                                               | 400 `invalid_request` "Choose one of your clients for this record."                                                                          |
| 10  | Write → history → activity → commit                                                                                                 | 23505 → 409 `conflict` "That record ID is already in use." (team scope only); 23503 → 409 `conflict` "A linked record prevents this change." |

Steps per endpoint:

- **Create:** 1–4, then ID allocation (§5), then 8–10. Steps 5–7 are skipped because there is no target.
- **Update:** 1–10.
- **Delete:** 1–3 (with the H2 rule at 3), then 4–6, then 10.
- **Assign:** 1–7, then eligibility (§6), then 10.
- **Bulk:** see §6.

The stale-vs-missing follow-up `EXISTS` queries in `mutation.rs` and `deletion.rs` are replaced: fetch the row once, visibility-filtered and without the version filter, then compare the version in Rust.

## 5. Write rules

- **Edit authority:** any visible record within the caller's grants. Reassigning requires being the holder or having team scope.
- **H2:** an assigned-only caller who deletes a Client, Property or Contact gets 403 `forbidden` "Ask your Admin to delete this record." at step 3, before any database work. Child records remain deletable.
- **Legacy-ID immutability:** an assigned-only update with an ID different from the stored one gets 400 `invalid_request` "Record IDs cannot be changed."
- **H3 (assigned-only callers):**
  - A child's `client_ref` must be unchanged or a Client the caller holds; otherwise the step 8 `link_missing` applies.
  - Only Follow-ups may have no client; otherwise the step 9 rule applies.
  - A Follow-up direct assignee who isn't the client holder may not change `client_ref`: 403 `forbidden` "Only the client's holder can move this follow-up."
  - If an update leaves a Follow-up with no client and no assignee, the server sets `assignee_id` to the caller (reason `reassigned`).
- **Default assignee on create:**
  - Clients, Properties and Contacts go to the creator if staff, to the Admin if the Admin creates, and to the owner when the Super Admin creates in another workspace.
  - A Follow-up gets the creator as assignee only when it has no client; otherwise NULL.
  - Every assignment writes a history row with reason `created`.
- **Imports:** Clients, Properties and Contacts go to the destination owner (reason `import`). Follow-ups get NULL.
- **Server-issued IDs (L1), `records/ids.rs`:**
  - Prefixes: Clients CL, Contacts CT, Properties PR, Follow-ups FU, Viewings VW, Shortlist MT, Interaction log LG, Client care CA.
  - On create with the ID missing or blank, under the lock: `COALESCE(max(substring(legacy_id FROM '^PR-([0-9]{1,9})$')::bigint),0)+1` across all of the workspace's rows in that collection, zero-padded to at least 3 digits. IDs that don't parse are ignored.
  - If the next number would exceed 999 999 999: 409 `conflict` "No record IDs are left for this collection. Ask your Admin."
  - Assigned-only callers who supply a non-empty ID get 400 `invalid_request` "Record IDs are issued by the server." at step 3.
  - Team scope may type an ID explicitly.
  - `validate` gains a create variant in which the ID is optional.
- **Reserved keys (M2):** add `assignee`, `assigneeId`, `assignee_id`, `record_scope`, `recordScope`, `references`, `taskClients` and `listingViewings`. They return the existing 400 message. `Entry.assignee` comes from the database column only.

## 6. API contract (under `/api/crm`)

```text
GET /workspaces/{ws}/records
200 { "scope": "team"|"assigned",
      "records": { "<Collection>": [Entry] },        // all 8 keys always present
      "references": { "Clients":[{"client_id","full_name"}],
                      "Properties":[{"property_id","listing_title"}],
                      "Contacts":[{"contact_id","full_name"}] },
      "taskClients": [{"client_id","full_name","phone","email"}],
      "listingViewings": [{"property_id","appointment_date_time","agent":{"id","name"}|null}] }
Entry = { "id": uuid, "version": int, "record": {...}, "assignee": uuid|null }

POST /workspaces/{ws}/records/{collection}         { "record": {...} }   → 201 Entry
PATCH /workspaces/{ws}/records/{collection}/{id}   { "record": {...}, "version": n } → 200 Entry
DELETE /workspaces/{ws}/records/{collection}/{id}  { "version": n } → 200 { "ok": true }
  Errors per §4/§5.

GET /workspaces/{ws}/assignees?collection=Clients|Properties|Contacts|Follow-ups   (M5)
  Caller: any member holding that collection's grant (else 403). Other collection → 400.
200 { "assignees": [{"id","name"}] }  // active, owner-active staff of {ws} with the grant,
                                       // plus the owner; Super Admin only in the org workspace

PUT /workspaces/{ws}/records/{collection}/{id}/assignee
  { "version": n, "assigneeId": uuid|null, "note": "≤1000 chars, optional" }
  Steps 1–3: assignable collection (else 400 "This record type cannot be assigned."),
    note trimmed (empty → none), assigneeId null only for team scope
    (else 403 "Only your Admin can move records to the queue.").
  Steps 4–6 as §4. Step 7: caller is holder or team scope,
    else 403 "Only the current assignee, the Admin or a full-team member can reassign this record."
  Eligibility (eligible(): FOR SHARE on the target user row): unknown, other-team, inactive,
    or lacking the grant → 400 "Choose an active team member with access to this record type."
  Same assignee → 200, no write. Otherwise version+1, updated_at, history row(s), note row,
    crm_activity 'assigned'.
200 { "entry": Entry|null }   // null = caller can no longer see the record

POST /workspaces/{ws}/assignments/bulk   (L4, M7)
  { "toId": uuid|null, "note": "...", "records": [{"collection","id","version"}] }
  Body ≤ 64 KB, 1–500 distinct records. Caller: team scope (else 403) plus the grant for
  every listed collection (else 403); CSRF required. Under lock: all rows fetched FOR UPDATE
  ORDER BY id in {ws}; any missing → 404; any stale → 409 version_conflict; eligibility per
  collection → 400. All-or-nothing; reason 'bulk'.
200 { "entries": [Entry] }

GET /workspaces/{ws}/records/{collection}/{id}/assignments   (M4)
  Record must be visible (else 404, identical to unknown).
200 { "history": [{ "at", "reason", "from":{"id","name"}|null, "to":{"id","name"}|null,
                    "actor":{"id","name"}|null, "note": string|null }] }
  For assigned-only callers, reasons 'departure' and 'access_removed' are returned as
  "admin_reassigned" with actor null ("Reassigned by Admin").

PATCH /workspaces/{ws}/team/{id}  gains  "recordScope": "assigned"|"team"   (M7)
  Admin/Super Admin team endpoint only; target must be staff
  (else 400 "Full-team access applies to staff only."). Invitations and positions never
  set it. Sessions of the member are already deleted on update.
Profile (session responses) gains "recordScope": "team"|"assigned" ("team" for Admins).
Member (team list) gains "recordScope".
```

## 7. Departures and permission reductions (M3): `assignments/departure.rs::release`

Runs inside the existing transactions, after their locks: `members/update_store.rs` (already holds the workspace lock and `lock_owner`) and `archive/store.rs` (staff archive).

- **Effective-permission comparison:** `before = current.effective_permissions()`, and `after` = the permissions produced by `update::prepare` (positions change the defaults). For each assignable collection, release when `active` becomes false, or when `before.collection(c)` is true and `after.collection(c)` is false.
- **Release:** `UPDATE crm_records SET assignee_id=NULL, version=version+1, updated_at=now() WHERE workspace_id=$ws AND assignee_id=$member AND collection=ANY($released) RETURNING id, collection`, plus a history row per record (reason `departure` or `access_removed`, actor = the acting Admin) and a `crm_activity` `assigned` row. Follow-ups lose their direct assignee; Clients, Properties and Contacts go to the queue.
- **Unchanged cases:** archiving an Admin freezes the workspace, so assignments are left as they are. The Super Admin suspending an Admin releases nothing; concurrent assigns are serialised by `eligible()` taking `FOR SHARE` on the user row. Reactivation does not restore assignments. Changing `recordScope` from team to assigned releases nothing.

## 8. Frontend contract (connected mode only; the demo is untouched)

**Data:** `server/records.js` reads `scope`, `assignee`, `references`, `taskClients` and `listingViewings`. The assignee is kept as entry metadata and never written into the record payload. Workbook export uses visible records only and never includes the projections.

**UI states:**

- **IDs:** the ID field shows "Issued when saved" on create. It is read-only for assigned-only staff; team scope may type an ID.
- **Assignee:** shown in details and the editor; the picker is fed by `GET assignees`.
- **Hand-off dialog:** before confirming, if the caller is assigned-only and not the new holder, warn "You will no longer see this record", with an optional note of up to 1000 characters.
- **Queue:** "Unassigned · needs owner" when a Client, Property or Contact has `assignee=null`.
- **Team scope tools:** an "Assigned to" filter (a member, "Unassigned · needs owner", or Everyone) and bulk reassignment from the filtered list.
- **References:** "ID · name (not assigned to you)", read-only. `LinkSelect` shows only the current value and never lists references (M1).
- **Task and listing projections:** `taskClients` show name, phone and email on the Follow-up details. `listingViewings` appear on Property details as "date/time · agent" (or "Unassigned").
- **Delete:** hidden for assigned-only staff on Clients, Properties and Contacts.
- **Team form:** a separate "Record visibility: whole team" toggle in the team member form, off by default and staff only, shown in the review step.

**L5:**

- On a 404, remove the entry locally and show "This record is no longer available to you."
- Re-fetch records after any hand-off or when the response says `entry:null`.
- Never store connected records in browser storage.

**Files** (each ≤150 lines):

- `services/crm/assignments.js`.
- `useServerRecordActions.js` stops using `newId`.
- `features/server/assignment/{AssigneeField, HandoffDialog, AssignmentHistory, AssignedToFilter, BulkReassignDialog, ListingViewings, useAssignment.js, assignmentModel.js}`.
- `features/records/*` only gains optional slot props.
- `RecordField` moves its link select into `LinkSelect.jsx`.
- Nothing is added to `RecordTable.jsx`.
- `server-team/TeamAccessFields.jsx`, `model.js` and `TeamMemberReview.jsx` gain the toggle.

## 9. Packets

The backend packets run in sequence; the frontend runs in parallel against this contract.

| Packet | Owner             | Write set                                                                                                                                                                                        | Must test                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1     | backend_database  | `migrations/0008_assignments.sql`, `auth/profile.rs`, `team/members/{update,update_store,directory}.rs` (recordScope only), `records/validation/mod.rs` (reserved keys)                          | M6 backfill (staff, archived, inactive-owner and no-grant creators; Admin and import records; versions unchanged; no assignee outside its record's workspace); migration on a seeded 0007 database; M7 PATCH rules and staff-target-only; M2 reserved keys                                                                                                                                                                                                       |
| B2     | backend_database  | `records/{visibility,ids,handlers,mutation,deletion,links}.rs` (+ new list/projection files), `workspaces/mod.rs` (ensure_writable returns the row), `imports/insertion.rs`                      | H1 matrix (hidden, unknown and cross-team UUIDs give identical status, body and code on update and delete, with links equal and unequal); create with hidden vs nonexistent link identical; H2 (same 403 with and without hidden dependents; child delete OK); H3 every re-parenting attempt; H4 parallel reassign vs PATCH; L1 overflow; 20 parallel creates give unique IDs; the M1, decision 2 and decision 6 projections contain only the allowed fields; L3 |
| B3     | backend_database  | new `assignments/*`, `routes.rs`, `team/members/update_store.rs` and `team/archive/store.rs` (release calls)                                                                                     | M5 assignees; PUT holder, eligibility and no-CSRF 403; M7 bulk per-collection grant, CSRF, cap and all-or-nothing; M4 notes absent from activity, generic departure label, cascade delete keeps history; M3 positions change dropping relationships sends Clients and Contacts to the queue; suspend/archive atomic with history; suspend racing assign                                                                                                          |
| F1     | frontend_engineer | `src/services/crm/*`, `src/features/server/records.js`, `useServerRecordActions.js`, `features/records/{LinkSelect,RecordField,RecordDetails}.jsx` slots, `server-team/*` toggle; `tests/unit/*` | Model parsing, server IDs, projection display, delete hidden, L5                                                                                                                                                                                                                                                                                                                                                                                                 |
| F2     | frontend_engineer | `src/features/server/assignment/*`, shell wiring                                                                                                                                                 | Hand-off warning, filter, queue, bulk                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Q      | qa_accessibility  | `tests/server-browser/assign-*.spec.js`                                                                                                                                                          | Connected flows in both themes and at mobile width, keyboard focus, staff dashboard counts                                                                                                                                                                                                                                                                                                                                                                       |

Order: C0 → B1 → B2 (in parallel with F1) → B3 (in parallel with F2) → Q → docs (primary agent). Each backend packet runs fmt, Clippy, `cargo test`, `npm run test:api` and `npm run check:lines`.

## 10. Acceptance checklist

- [ ] Assigned-only members see only the visible set (§3), within their grants, across lists, counts, pickers, exports and the dashboard.
- [ ] Hidden and unknown targets produce byte-identical responses on every endpoint, and the H1 order is verified.
- [ ] Assigned-only staff cannot trigger a 23505 or a parent-delete 23503, and cannot change IDs.
- [ ] Projections contain only the specified fields; `taskClients` and `listingViewings` follow decisions 2 and 6.
- [ ] Assignment, bulk reassignment, history and notes behave as in §6, and notes never reach `crm_activity`.
- [ ] Departures and grant reductions release records atomically, using the effective-permission comparison.
- [ ] The backfill creates no cross-workspace assignees and leaves versions unchanged.
- [ ] `recordScope` defaults to assigned, applies to staff only, and is never set by positions.
- [ ] The §8 UI states work in both themes and at mobile width. Every file is ≤150 lines; fmt, Clippy, `test:api`, `test:server:e2e` and `check:lines` (no new violations) pass.

**UNRESOLVED (not blocking B1):**

1. History rows for deleted records are kept but unreadable; they will be exposed later through a Super Admin audit view.
2. `listingViewings` returns the raw `appointment_date_time` string; timezone normalisation is P10.
3. Whether reassigning a Client should offer to move Follow-ups directly assigned to the previous holder. Default: no; this is the owner's call if requested.
