-- Owner module: team (services/crm-api/src/team, docs/service-boundaries.md).
-- BO1b Blaqks One team (docs/blaqks-one-console.md §8): a `platform` role in the Blaqks One
-- organisation, owned by its Owner as staff are by their Admin, with one row of area
-- levels per person. The identity views carry the position and access so the one platform
-- guard and the signed-in profile read them live. Never edit after release.

ALTER TABLE crm_users DROP CONSTRAINT crm_users_role_check;
ALTER TABLE crm_users ADD CONSTRAINT crm_users_role_check
    CHECK (role IN ('super-admin', 'admin', 'staff', 'platform'));

-- Platform staff belong to the organisation and its Owner; the existing composite key
-- (owner_id, workspace_id) -> crm_workspaces(owner_id, id) ties the two together.
ALTER TABLE crm_users DROP CONSTRAINT crm_staff_membership;
ALTER TABLE crm_users ADD CONSTRAINT crm_staff_membership CHECK (
    (role='staff' AND owner_id IS NOT NULL AND workspace_id IS NOT NULL AND owner_id<>id)
    OR (role='platform' AND owner_id IS NOT NULL AND owner_id<>id
        AND workspace_id='super-admin-workspace')
    OR (role NOT IN ('staff','platform') AND owner_id IS NULL AND workspace_id IS NULL)
);

-- The fixed area table (owner 2026-11-05): each area is Off (left out), View or Manage, at a
-- level it allows. The preset is the position the Owner started from; the saved levels
-- decide.
CREATE FUNCTION crm_platform_access_valid(access JSONB) RETURNS BOOLEAN AS $$
    SELECT CASE WHEN jsonb_typeof(access)<>'object' OR access='{}'::jsonb THEN false
    ELSE NOT EXISTS (
        SELECT 1 FROM jsonb_each(access) e
        WHERE jsonb_typeof(e.value)<>'string' OR NOT (
            (e.key='dashboard' AND e.value#>>'{}'='view')
            OR (e.key='invite_admins' AND e.value#>>'{}'='manage')
            OR (e.key IN ('companies','marketplace','platform_website','help_requests','clients')
                AND e.value#>>'{}' IN ('view','manage'))))
    END
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE crm_platform_access (
    user_id UUID PRIMARY KEY REFERENCES crm_users(id),
    preset TEXT NOT NULL CHECK (preset IN ('manager','sales','support','analyst','custom')),
    access JSONB NOT NULL CHECK (crm_platform_access_valid(access)),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backstop for the Rust checks: only a platform account holds areas.
CREATE FUNCTION crm_platform_access_member() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM crm_users WHERE id=NEW.user_id AND role='platform') THEN
        RAISE EXCEPTION 'Platform access belongs to a Blaqks One team member';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER crm_platform_access_member BEFORE INSERT OR UPDATE ON crm_platform_access
    FOR EACH ROW EXECUTE FUNCTION crm_platform_access_member();

-- Every earlier column, its order and each filter are unchanged from 0026, except that a
-- platform member, like staff, is live only while the Owner is; preset and access are
-- appended last.
CREATE OR REPLACE VIEW crm_all_user_profiles AS
SELECT u.id,u.name,u.email,u.phone,u.password_hash,u.role,u.active,u.owner_id,
    COALESCE(u.workspace_id,
        CASE WHEN u.role='super-admin' THEN 'super-admin-workspace' ELSE u.id::text END
    ) AS workspace_id,
    u.positions,u.permissions,u.channel_access,u.version,u.accepted_at,
    CASE WHEN u.role='staff' THEN o.active AND o.deleted_at IS NULL
            AND o.role IN ('admin','super-admin')
        WHEN u.role='platform' THEN o.active AND o.deleted_at IS NULL
            AND o.role='super-admin'
        ELSE true END AS owner_active,
    u.deleted_at,o.deleted_at AS owner_deleted_at,u.record_scope,u.actions,u.language,
    u.email_verified_at,u.phone_verified_at IS NOT NULL AS phone_verified,
    u.guidance_enabled,a.preset AS platform_preset,a.access AS platform_access
FROM crm_users u LEFT JOIN crm_users o ON o.id=u.owner_id
LEFT JOIN crm_platform_access a ON a.user_id=u.id AND u.role='platform';

CREATE OR REPLACE VIEW crm_user_profiles AS
SELECT * FROM crm_all_user_profiles WHERE deleted_at IS NULL AND owner_deleted_at IS NULL;
