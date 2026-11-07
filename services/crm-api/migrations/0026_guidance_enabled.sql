-- Owner module: auth (services/crm-api/src/auth, docs/service-boundaries.md).
-- Per-member field guidance (docs/deepseek-delivery-plan.md packet Q1): each member turns
-- automatic field hints on or off for their own account through PUT /auth/account/guidance.
-- New and existing accounts start with hints on. Never edit after release.

ALTER TABLE crm_users
    ADD COLUMN guidance_enabled BOOLEAN NOT NULL DEFAULT true;

-- Append guidance after the established profile columns. crm_member_profiles lists its
-- columns explicitly, so another member's preference never enters the team directory.
CREATE OR REPLACE VIEW crm_all_user_profiles AS
SELECT u.id,u.name,u.email,u.phone,u.password_hash,u.role,u.active,u.owner_id,
    COALESCE(u.workspace_id,
        CASE WHEN u.role='super-admin' THEN 'super-admin-workspace' ELSE u.id::text END
    ) AS workspace_id,
    u.positions,u.permissions,u.channel_access,u.version,u.accepted_at,
    CASE WHEN u.role='staff' THEN o.active AND o.deleted_at IS NULL
        AND o.role IN ('admin','super-admin') ELSE true END AS owner_active,
    u.deleted_at,o.deleted_at AS owner_deleted_at,u.record_scope,u.actions,u.language,
    u.email_verified_at,u.phone_verified_at IS NOT NULL AS phone_verified,
    u.guidance_enabled
FROM crm_users u LEFT JOIN crm_users o ON o.id=u.owner_id;

CREATE OR REPLACE VIEW crm_user_profiles AS
SELECT * FROM crm_all_user_profiles WHERE deleted_at IS NULL AND owner_deleted_at IS NULL;
