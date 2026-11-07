-- Owner module: integrations (services/crm-api/src/integrations, docs/messaging-design.md).
-- Packet X1: channel connections registry in its own schema. Credentials are sealed by
-- the application (AES-256-GCM); no column holds a readable token. No foreign keys into
-- CRM tables (service-boundaries rule 9). Later packets add tables in new migrations.

CREATE SCHEMA IF NOT EXISTS integrations;

CREATE TABLE integrations.crm_channel_connections (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'facebook', 'instagram')),
    provider text NOT NULL CHECK (provider IN ('twilio', 'google', 'microsoft', 'meta')),
    external_account_id text NOT NULL CHECK (char_length(external_account_id) BETWEEN 1 AND 160),
    display_label text NOT NULL CHECK (char_length(display_label) BETWEEN 1 AND 80),
    owner_member_id uuid,
    state text NOT NULL CHECK (state IN ('connected', 'reconnect_required', 'disconnected')),
    credential_sealed bytea,
    credential_key_version integer CHECK (credential_key_version > 0),
    credential_updated_at timestamptz,
    version bigint NOT NULL CHECK (version > 0),
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (state = 'disconnected' OR (credential_sealed IS NOT NULL AND credential_key_version IS NOT NULL)),
    CHECK (channel <> 'email' OR owner_member_id IS NOT NULL)
);

-- One provider account belongs to one company; a disconnected row keeps history but
-- releases the account for a fresh connection.
CREATE UNIQUE INDEX crm_channel_connections_external
    ON integrations.crm_channel_connections (provider, external_account_id);

-- One live connection per channel; email mailboxes are per member, other channels are
-- company-wide (owner decision on one number per company).
CREATE UNIQUE INDEX crm_channel_connections_active
    ON integrations.crm_channel_connections (
        workspace_id,
        channel,
        COALESCE(owner_member_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE state <> 'disconnected';

CREATE INDEX crm_channel_connections_workspace
    ON integrations.crm_channel_connections (workspace_id, channel, created_at);

CREATE TABLE integrations.crm_integration_events (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    connection_id uuid NOT NULL REFERENCES integrations.crm_channel_connections (id),
    action text NOT NULL CHECK (
        action IN ('connected', 'reconnected', 'reconnect_required', 'disconnected')
    ),
    actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_integration_events_feed
    ON integrations.crm_integration_events (workspace_id, created_at DESC);

CREATE FUNCTION integrations.crm_integration_events_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Integration events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_integration_events_immutable
    BEFORE UPDATE OR DELETE ON integrations.crm_integration_events
    FOR EACH ROW EXECUTE FUNCTION integrations.crm_integration_events_immutable();
CREATE TRIGGER crm_integration_events_no_truncate
    BEFORE TRUNCATE ON integrations.crm_integration_events
    FOR EACH STATEMENT EXECUTE FUNCTION integrations.crm_integration_events_immutable();
