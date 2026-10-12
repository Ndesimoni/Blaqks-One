ALTER TABLE crm_users ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE crm_users ADD CONSTRAINT crm_archived_accounts_inactive
    CHECK (deleted_at IS NULL OR (NOT active AND role<>'super-admin'));
CREATE INDEX crm_user_archives ON crm_users(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE VIEW crm_all_user_profiles AS
SELECT u.id,u.name,u.email,u.phone,u.password_hash,u.role,u.active,u.owner_id,
    COALESCE(u.workspace_id,
        CASE WHEN u.role='super-admin' THEN 'super-admin-workspace' ELSE u.id::text END
    ) AS workspace_id,
    u.positions,u.permissions,u.channel_access,u.version,u.accepted_at,
    CASE WHEN u.role='staff' THEN o.active AND o.deleted_at IS NULL
        AND o.role IN ('admin','super-admin') ELSE true END AS owner_active,
    u.deleted_at,o.deleted_at AS owner_deleted_at
FROM crm_users u LEFT JOIN crm_users o ON o.id=u.owner_id;

CREATE OR REPLACE VIEW crm_user_profiles AS
SELECT * FROM crm_all_user_profiles WHERE deleted_at IS NULL AND owner_deleted_at IS NULL;

CREATE VIEW crm_member_profiles AS
SELECT p.*,p.accepted_at IS NOT NULL AS accepted,p.deleted_at IS NOT NULL AS archived,
    to_char(p.deleted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS archived_at,
    EXISTS(SELECT 1 FROM crm_team_invitations i WHERE i.user_id=p.id
        AND i.revoked_at IS NOT NULL) AS revoked
FROM crm_all_user_profiles p;

ALTER TABLE crm_team_activity DROP CONSTRAINT crm_team_activity_action_check;
ALTER TABLE crm_team_activity ADD CONSTRAINT crm_team_activity_action_check
    CHECK (action IN ('invited','updated','activated','suspended','archived'));

CREATE FUNCTION prevent_crm_account_restore() RETURNS trigger AS $$
BEGIN
    IF OLD.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Archived accounts are read-only';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER crm_archived_account_immutable BEFORE UPDATE ON crm_users
    FOR EACH ROW EXECUTE FUNCTION prevent_crm_account_restore();
