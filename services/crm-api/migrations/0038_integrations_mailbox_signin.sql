-- Owner module: integrations (services/crm-api/src/integrations, docs/messaging-design.md §8).
-- Packet E1a: one row per mailbox sign-in a member starts with Google. The state is
-- stored only as a SHA-256 digest; the PKCE verifier is sealed by the application. A row
-- is bound to the member, the workspace and the session that started it, expires after
-- ten minutes and is used at most once. No foreign keys into CRM tables (boundary rule 9).

CREATE TABLE integrations.crm_oauth_requests (
    id uuid PRIMARY KEY,
    state_digest text NOT NULL UNIQUE CHECK (char_length(state_digest) = 64),
    provider text NOT NULL CHECK (provider IN ('google')),
    workspace_id text NOT NULL,
    member_id uuid NOT NULL,
    session_id uuid NOT NULL,
    verifier_sealed bytea NOT NULL,
    key_version integer NOT NULL CHECK (key_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes')
);

CREATE INDEX crm_oauth_requests_expiry ON integrations.crm_oauth_requests (expires_at);

-- Revocations owed to a provider after a mailbox is disconnected, by the member, the
-- Admin, or because the member left or lost the email grant (security review M1, L3).
-- The sealed token is copied unchanged from the connection, so it opens only with that
-- connection's binding; the connection itself is already disconnected and cleared.
-- The messaging worker retries until the provider confirms, then deletes the row.
CREATE TABLE integrations.crm_pending_revocations (
    connection_id uuid PRIMARY KEY REFERENCES integrations.crm_channel_connections (id),
    workspace_id text NOT NULL,
    provider text NOT NULL CHECK (provider IN ('google')),
    channel text NOT NULL,
    credential_sealed bytea NOT NULL,
    credential_key_version integer NOT NULL CHECK (credential_key_version > 0),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_pending_revocations_due ON integrations.crm_pending_revocations (next_attempt_at);

-- M2: the per-member attempt limit counts every unexpired request, used or not.
CREATE INDEX crm_oauth_requests_member ON integrations.crm_oauth_requests (member_id, expires_at);
