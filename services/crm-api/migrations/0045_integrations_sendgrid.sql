-- Owner module: integrations (services/crm-api/src/integrations, docs/sendgrid-design.md).
-- Packet E3a: company email through SendGrid. A SendGrid connection belongs to the company,
-- not one member, and its account ID is the authenticated domain. Members send from
-- addresses on that domain; an address is never given to another person (decision E3d),
-- so its local part stays taken in the company for ever, across reconnects (review L2).

ALTER TABLE integrations.crm_channel_connections
    DROP CONSTRAINT crm_channel_connections_provider_check,
    ADD CONSTRAINT crm_channel_connections_provider_check
        CHECK (provider IN ('twilio', 'google', 'microsoft', 'meta', 'tiktok', 'sendgrid')),
    DROP CONSTRAINT crm_channel_connections_check1,
    ADD CONSTRAINT crm_channel_connections_email_owner
        CHECK (channel <> 'email' OR provider = 'sendgrid' OR owner_member_id IS NOT NULL),
    ADD CONSTRAINT crm_channel_connections_sendgrid_company
        CHECK (provider <> 'sendgrid' OR (channel = 'email' AND owner_member_id IS NULL));

CREATE TABLE integrations.crm_sendgrid_addresses (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    domain text NOT NULL CHECK (char_length(domain) BETWEEN 3 AND 160),
    local_part text NOT NULL CHECK (local_part ~ '^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$'),
    member_id uuid NOT NULL,
    display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
    state text NOT NULL CHECK (state IN ('active', 'reserved')),
    version bigint NOT NULL CHECK (version > 0),
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX crm_sendgrid_addresses_local
    ON integrations.crm_sendgrid_addresses (workspace_id, domain, local_part);

-- One sending address per member and domain at a time.
CREATE UNIQUE INDEX crm_sendgrid_addresses_member
    ON integrations.crm_sendgrid_addresses (workspace_id, domain, member_id)
    WHERE state = 'active';
