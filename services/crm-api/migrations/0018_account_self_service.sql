-- Owner module: auth (services/crm-api/src/auth, docs/service-boundaries.md).
-- Account self-service (docs/account-self-service.md): session list and revocation,
-- password-change time and an immutable account event history. Never edit after release.

-- Sessions gain a random public ID (never the token hash), a last-seen time refreshed by
-- the session extractor at most every 5 minutes, and a coarse "Browser · OS" label from an
-- allowlist parse at sign-in. Never the raw User-Agent and never an IP address.
ALTER TABLE crm_sessions
    ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid() CONSTRAINT crm_sessions_id_key UNIQUE,
    ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN device TEXT CONSTRAINT crm_sessions_device_length CHECK (char_length(device) <= 60);

CREATE INDEX crm_sessions_user ON crm_sessions(user_id);

-- NULL until the member first changes their password; existing passwords keep working.
ALTER TABLE crm_users ADD COLUMN password_changed_at TIMESTAMPTZ;

-- Self-service history: who did what to which account, never field values, passwords,
-- tokens, IP addresses or User-Agents. actor_id stays separate from user_id so a future
-- Admin-issued reset fits the same table. workspace_id carries no foreign key (boundary
-- rule 4); it is the account's workspace, resolved by auth under the workspace lock.
CREATE TABLE crm_account_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES crm_users(id),
    actor_id UUID NOT NULL REFERENCES crm_users(id),
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) BETWEEN 1 AND 200),
    action TEXT NOT NULL CHECK (action IN (
        'profile_updated', 'password_changed', 'sessions_revoked', 'session_revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crm_account_events_user ON crm_account_events(user_id, created_at);

CREATE FUNCTION crm_account_events_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Account events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_account_events_immutable BEFORE UPDATE OR DELETE ON crm_account_events
    FOR EACH ROW EXECUTE FUNCTION crm_account_events_immutable();
CREATE TRIGGER crm_account_events_no_truncate BEFORE TRUNCATE ON crm_account_events
    FOR EACH STATEMENT EXECUTE FUNCTION crm_account_events_immutable();
