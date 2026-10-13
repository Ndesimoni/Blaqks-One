-- Per-module action grants (docs/action-permissions-design.md §3, §12, §13).
-- Written idempotently (M-E): every step is guarded, so a repair run is harmless.
-- Never edit this file after release; ship a new migration instead.
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS actions JSONB NOT NULL DEFAULT '{}';

-- L-1: module grants must be booleans before the backfill reads them.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM crm_users u, jsonb_each(u.permissions) AS grant_value(key, value)
        WHERE u.role='staff' AND u.deleted_at IS NULL AND jsonb_typeof(grant_value.value)<>'boolean'
    ) THEN
        RAISE EXCEPTION 'crm_users.permissions holds a non-boolean module grant';
    END IF;
END $$;

-- Backfill (§1.4, L-1, M-C): every non-archived staff member, including pending,
-- suspended and suspended-Admin staff, keeps exactly today's abilities. deleteMain
-- needs team scope and coverage of the referencing modules (relationships: properties,
-- so Contacts stay deletable; Clients additionally need schedule, enforced in Rust;
-- properties: schedule). Archived rows are immutable and keep '{}'. version, sessions
-- and updated timestamps are untouched. Only '{}' rows are filled, so re-runs are no-ops.
WITH grants AS (
    SELECT id, record_scope='team' AS team,
        COALESCE(permissions->'relationships' = 'true'::jsonb, false) AS r,
        COALESCE(permissions->'properties' = 'true'::jsonb, false) AS p,
        COALESCE(permissions->'schedule' = 'true'::jsonb, false) AS s
    FROM crm_users WHERE role='staff' AND deleted_at IS NULL AND actions='{}'::jsonb)
UPDATE crm_users u SET actions=jsonb_build_object(
    'relationships', jsonb_build_object('create', g.r, 'edit', g.r, 'assign', g.r,
        'deleteMain', g.r AND g.team AND g.p),
    'properties', jsonb_build_object('create', g.p, 'edit', g.p, 'assign', g.p,
        'deleteActivity', g.p, 'deleteMain', g.p AND g.team AND g.s),
    'schedule', jsonb_build_object('create', g.s, 'edit', g.s, 'assign', g.s,
        'deleteActivity', g.s))
FROM grants g WHERE u.id=g.id;

-- §3 and L-2: an object; only staff carry grants; deleteMain needs whole-team scope.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='crm_actions_object') THEN
        ALTER TABLE crm_users ADD CONSTRAINT crm_actions_object
            CHECK (jsonb_typeof(actions)='object');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='crm_actions_staff') THEN
        ALTER TABLE crm_users ADD CONSTRAINT crm_actions_staff
            CHECK (role='staff' OR actions='{}'::jsonb);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='crm_actions_delete_main') THEN
        ALTER TABLE crm_users ADD CONSTRAINT crm_actions_delete_main CHECK (
            record_scope='team' OR NOT (
                actions @> '{"relationships":{"deleteMain":true}}'::jsonb
                OR actions @> '{"properties":{"deleteMain":true}}'::jsonb));
    END IF;
END $$;

-- L-6: grant changes are logged by name only, never with their contents.
ALTER TABLE crm_team_activity DROP CONSTRAINT IF EXISTS crm_team_activity_action_check;
ALTER TABLE crm_team_activity ADD CONSTRAINT crm_team_activity_action_check
    CHECK (action IN ('invited','updated','activated','suspended','archived','access_changed'));

-- Append actions as the last column of each profile view, in dependency order.
-- Every earlier column, its order and each filter are unchanged from 0008.
CREATE OR REPLACE VIEW crm_all_user_profiles AS
SELECT u.id,u.name,u.email,u.phone,u.password_hash,u.role,u.active,u.owner_id,
    COALESCE(u.workspace_id,
        CASE WHEN u.role='super-admin' THEN 'super-admin-workspace' ELSE u.id::text END
    ) AS workspace_id,
    u.positions,u.permissions,u.channel_access,u.version,u.accepted_at,
    CASE WHEN u.role='staff' THEN o.active AND o.deleted_at IS NULL
        AND o.role IN ('admin','super-admin') ELSE true END AS owner_active,
    u.deleted_at,o.deleted_at AS owner_deleted_at,u.record_scope,u.actions
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
    p.record_scope,p.actions
FROM crm_all_user_profiles p;

-- Read-only report for the release notes (not executed here): whole-team staff whose
-- parent deletes are removed by the M-C coverage rule (§13 item 4).
--   SELECT id, name,
--       (permissions->'relationships'='true'::jsonb AND NOT (permissions->'schedule'='true'::jsonb
--           AND permissions->'properties'='true'::jsonb)) AS loses_clients,
--       (permissions->'relationships'='true'::jsonb
--           AND permissions->'properties' IS DISTINCT FROM 'true'::jsonb) AS loses_contacts,
--       (permissions->'properties'='true'::jsonb
--           AND permissions->'schedule' IS DISTINCT FROM 'true'::jsonb) AS loses_properties
--   FROM crm_users WHERE role='staff' AND deleted_at IS NULL AND record_scope='team';
