-- Owner module: auth (docs/service-boundaries.md); sign-up packet S1.
-- Existing and invited accounts remain unverified. Never edit after release.
ALTER TABLE crm_users ADD COLUMN email_verified_at TIMESTAMPTZ;
ALTER TABLE crm_users ADD COLUMN phone_verified_at TIMESTAMPTZ;

-- Append verification data after the established profile columns. A supplied phone
-- is not verified; a future provider flow is the only writer of phone_verified_at.
CREATE OR REPLACE VIEW crm_all_user_profiles AS
SELECT u.id,u.name,u.email,u.phone,u.password_hash,u.role,u.active,u.owner_id,
    COALESCE(u.workspace_id,
        CASE WHEN u.role='super-admin' THEN 'super-admin-workspace' ELSE u.id::text END
    ) AS workspace_id,
    u.positions,u.permissions,u.channel_access,u.version,u.accepted_at,
    CASE WHEN u.role='staff' THEN o.active AND o.deleted_at IS NULL
        AND o.role IN ('admin','super-admin') ELSE true END AS owner_active,
    u.deleted_at,o.deleted_at AS owner_deleted_at,u.record_scope,u.actions,u.language,
    u.email_verified_at,u.phone_verified_at IS NOT NULL AS phone_verified
FROM crm_users u LEFT JOIN crm_users o ON o.id=u.owner_id;

CREATE OR REPLACE VIEW crm_user_profiles AS
SELECT * FROM crm_all_user_profiles WHERE deleted_at IS NULL AND owner_deleted_at IS NULL;

CREATE TABLE crm_account_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES crm_users(id),
    document TEXT NOT NULL CHECK (document IN ('terms', 'privacy')),
    version TEXT NOT NULL CHECK (length(btrim(version)) BETWEEN 1 AND 100),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, document, version)
);

CREATE INDEX crm_account_consents_user ON crm_account_consents(user_id, accepted_at);

CREATE FUNCTION crm_account_consents_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Account consents are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_account_consents_immutable BEFORE UPDATE OR DELETE ON crm_account_consents
    FOR EACH ROW EXECUTE FUNCTION crm_account_consents_immutable();
CREATE TRIGGER crm_account_consents_no_truncate BEFORE TRUNCATE ON crm_account_consents
    FOR EACH STATEMENT EXECUTE FUNCTION crm_account_consents_immutable();

ALTER TABLE crm_account_events DROP CONSTRAINT crm_account_events_action_check;
ALTER TABLE crm_account_events ADD CONSTRAINT crm_account_events_action_check CHECK (action IN (
    'profile_updated', 'password_changed', 'sessions_revoked', 'session_revoked', 'signed_up'));

ALTER TABLE crm_login_limits ADD COLUMN window_seconds INTEGER NOT NULL DEFAULT 900
    CONSTRAINT crm_login_limits_window_seconds CHECK (window_seconds > 0);
