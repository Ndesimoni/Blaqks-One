-- Assignments and the full-team grant (docs/assignments-design.md section 2).
ALTER TABLE crm_users ADD COLUMN record_scope TEXT NOT NULL DEFAULT 'assigned'
    CHECK (record_scope IN ('assigned', 'team'));
-- Admins and the Super Admin have team scope by role; only staff carry the grant.
ALTER TABLE crm_users ADD CONSTRAINT crm_record_scope_staff
    CHECK (role = 'staff' OR record_scope = 'assigned');

-- Append record_scope as the last column of each profile view, in dependency order.
-- Every earlier column, its order and each filter are unchanged from 0004/0005.
CREATE OR REPLACE VIEW crm_all_user_profiles AS
SELECT u.id,u.name,u.email,u.phone,u.password_hash,u.role,u.active,u.owner_id,
    COALESCE(u.workspace_id,
        CASE WHEN u.role='super-admin' THEN 'super-admin-workspace' ELSE u.id::text END
    ) AS workspace_id,
    u.positions,u.permissions,u.channel_access,u.version,u.accepted_at,
    CASE WHEN u.role='staff' THEN o.active AND o.deleted_at IS NULL
        AND o.role IN ('admin','super-admin') ELSE true END AS owner_active,
    u.deleted_at,o.deleted_at AS owner_deleted_at,u.record_scope
FROM crm_users u LEFT JOIN crm_users o ON o.id=u.owner_id;

CREATE OR REPLACE VIEW crm_user_profiles AS
SELECT * FROM crm_all_user_profiles WHERE deleted_at IS NULL AND owner_deleted_at IS NULL;

CREATE OR REPLACE VIEW crm_member_profiles AS
SELECT p.id,p.name,p.email,p.phone,p.password_hash,p.role,p.active,p.owner_id,
    p.workspace_id,p.positions,p.permissions,p.channel_access,p.version,p.accepted_at,
    p.owner_active,p.deleted_at,p.owner_deleted_at,
    p.accepted_at IS NOT NULL AS accepted,p.deleted_at IS NOT NULL AS archived,
    to_char(p.deleted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS archived_at,
    EXISTS(SELECT 1 FROM crm_team_invitations i WHERE i.user_id=p.id
        AND i.revoked_at IS NOT NULL) AS revoked,
    p.record_scope
FROM crm_all_user_profiles p;

-- Clients, Properties and Contacts: NULL is the Admin queue ("Unassigned · needs owner").
-- Follow-ups: NULL means no direct assignee; visibility follows the linked client.
ALTER TABLE crm_records ADD COLUMN assignee_id UUID REFERENCES crm_users(id),
    ADD CONSTRAINT crm_records_assignable CHECK (
        assignee_id IS NULL OR collection IN ('Clients', 'Properties', 'Contacts', 'Follow-ups')
    );

-- Append-only assignment history. No foreign key to crm_records, so history
-- survives record deletion (M4).
CREATE TABLE crm_assignments (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    record_id UUID NOT NULL,
    collection TEXT NOT NULL
        CHECK (collection IN ('Clients', 'Properties', 'Contacts', 'Follow-ups')),
    from_id UUID REFERENCES crm_users(id),
    to_id UUID REFERENCES crm_users(id),
    actor_id UUID REFERENCES crm_users(id),
    reason TEXT NOT NULL CHECK (reason IN (
        'created', 'backfill', 'reassigned', 'bulk', 'departure', 'access_removed', 'import'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (actor_id IS NOT NULL OR reason = 'backfill')
);
CREATE TRIGGER crm_assignments_immutable BEFORE UPDATE OR DELETE ON crm_assignments
    FOR EACH ROW EXECUTE FUNCTION prevent_crm_activity_change();

-- Hand-off notes are business content: never copied into activity, logs or errors.
CREATE TABLE crm_assignment_notes (
    assignment_id UUID PRIMARY KEY REFERENCES crm_assignments(id),
    record_id UUID NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
    note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 1000)
);
CREATE FUNCTION prevent_crm_note_update() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Hand-off notes are read-only';
END;
$$ LANGUAGE plpgsql;
-- Only UPDATE is blocked, so deleting a record still cascades to its notes.
CREATE TRIGGER crm_assignment_notes_immutable BEFORE UPDATE ON crm_assignment_notes
    FOR EACH ROW EXECUTE FUNCTION prevent_crm_note_update();

ALTER TABLE crm_activity DROP CONSTRAINT crm_activity_action_check;
ALTER TABLE crm_activity ADD CONSTRAINT crm_activity_action_check
    CHECK (action IN ('created', 'updated', 'deleted', 'assigned'));

CREATE INDEX crm_records_assignee ON crm_records(workspace_id, assignee_id)
    WHERE assignee_id IS NOT NULL;
CREATE INDEX crm_records_queue ON crm_records(workspace_id, collection)
    WHERE assignee_id IS NULL AND collection IN ('Clients', 'Properties', 'Contacts');
CREATE INDEX crm_records_contact_links ON crm_records(workspace_id, contact_id)
    WHERE contact_id IS NOT NULL;
CREATE INDEX crm_assignments_record ON crm_assignments(record_id, created_at);
CREATE INDEX crm_assignment_notes_record ON crm_assignment_notes(record_id);

-- Backfill (M6): each record starts with its creator from the activity history when
-- that creator is an active staff member of the workspace with the module grant;
-- otherwise Clients, Properties and Contacts go to the workspace owner and Follow-ups
-- get no direct assignee. Child collections inherit. version and updated_at are untouched.
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
    WHERE r.collection IN ('Clients', 'Properties', 'Contacts', 'Follow-ups'))
UPDATE crm_records r SET assignee_id = CASE WHEN x.collection='Follow-ups'
    THEN x.staff_creator ELSE COALESCE(x.staff_creator, x.owner_id) END
FROM resolved x WHERE r.id=x.id;
INSERT INTO crm_assignments (id, workspace_id, record_id, collection, to_id, reason)
SELECT gen_random_uuid(), workspace_id, id, collection, assignee_id, 'backfill'
FROM crm_records WHERE assignee_id IS NOT NULL;

-- Read-only report for the release notes (not executed here): staff-created child
-- records whose client the creator will no longer hold after the backfill.
--   SELECT ch.workspace_id, ch.collection, ch.legacy_id, a.actor_id
--   FROM crm_records ch
--   JOIN crm_activity a ON a.record_id=ch.id AND a.workspace_id=ch.workspace_id
--       AND a.action='created'
--   JOIN crm_users u ON u.id=a.actor_id AND u.role='staff'
--   JOIN crm_records cl ON cl.workspace_id=ch.workspace_id AND cl.collection='Clients'
--       AND cl.legacy_id=ch.client_ref
--   WHERE ch.collection IN ('Viewings','Shortlist','Interaction log','Client care','Follow-ups')
--       AND cl.assignee_id IS DISTINCT FROM a.actor_id
--       AND ch.assignee_id IS DISTINCT FROM a.actor_id;

-- Eligibility backstop, created after the backfill because archived workspaces keep
-- their archived owner as assignee. Module grants are checked in Rust.
CREATE FUNCTION crm_check_assignee() RETURNS trigger AS $$
BEGIN
    IF NEW.assignee_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM crm_user_profiles p WHERE p.id=NEW.assignee_id
            AND p.workspace_id=NEW.workspace_id AND p.active AND p.owner_active) THEN
        RAISE EXCEPTION 'Assignee is not an active member of this workspace'
            USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER crm_records_assignee BEFORE INSERT OR UPDATE OF assignee_id ON crm_records
    FOR EACH ROW EXECUTE FUNCTION crm_check_assignee();
