-- Owner module: auth (services/crm-api/src/auth, docs/service-boundaries.md).
-- Per-member interface language (docs/i18n.md): an allowlisted preference each member sets
-- only for themselves through PUT /auth/account/language. Never edit after release.

ALTER TABLE crm_users
    ADD COLUMN language TEXT NOT NULL DEFAULT 'en'
        CONSTRAINT crm_users_language CHECK (language IN ('en', 'ar'));

-- Append language as the last column of the profile views, in dependency order.
-- Every earlier column, its order and each filter are unchanged from 0009.
-- crm_member_profiles lists its columns explicitly and stays as it is.
CREATE OR REPLACE VIEW crm_all_user_profiles AS
SELECT u.id,u.name,u.email,u.phone,u.password_hash,u.role,u.active,u.owner_id,
    COALESCE(u.workspace_id,
        CASE WHEN u.role='super-admin' THEN 'super-admin-workspace' ELSE u.id::text END
    ) AS workspace_id,
    u.positions,u.permissions,u.channel_access,u.version,u.accepted_at,
    CASE WHEN u.role='staff' THEN o.active AND o.deleted_at IS NULL
        AND o.role IN ('admin','super-admin') ELSE true END AS owner_active,
    u.deleted_at,o.deleted_at AS owner_deleted_at,u.record_scope,u.actions,u.language
FROM crm_users u LEFT JOIN crm_users o ON o.id=u.owner_id;

CREATE OR REPLACE VIEW crm_user_profiles AS
SELECT * FROM crm_all_user_profiles WHERE deleted_at IS NULL AND owner_deleted_at IS NULL;
