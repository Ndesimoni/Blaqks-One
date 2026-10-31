-- Owner module: integrations (services/crm-api/src/integrations, docs/whatsapp-design.md).
-- Packet W1a: WhatsApp through the company's Twilio account. A Twilio connection belongs to
-- the company, not one member: its account ID is the Account SID and its sealed credential
-- the Auth Token. The Admin gives each member their own number from the account's WhatsApp
-- senders (WQ3). A number is active for one member of one company at a time, across every
-- company; a disconnected row keeps history and is never handed on. No foreign key into
-- team tables (service-boundaries rule 9).

ALTER TABLE integrations.crm_channel_connections
    ADD CONSTRAINT crm_channel_connections_twilio_company
        CHECK (provider <> 'twilio' OR (channel = 'whatsapp' AND owner_member_id IS NULL));

CREATE TABLE integrations.crm_whatsapp_numbers (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    connection_id uuid NOT NULL REFERENCES integrations.crm_channel_connections (id),
    member_id uuid NOT NULL,
    phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
    sender_sid text CHECK (sender_sid ~ '^XE[0-9a-f]{32}$'),
    state text NOT NULL CHECK (state IN ('active', 'disconnected')),
    version bigint NOT NULL CHECK (version > 0),
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- A number serves one company at a time, whichever company asks (design §3).
CREATE UNIQUE INDEX crm_whatsapp_numbers_phone
    ON integrations.crm_whatsapp_numbers (phone_e164)
    WHERE state = 'active';

-- One active number per member.
CREATE UNIQUE INDEX crm_whatsapp_numbers_member
    ON integrations.crm_whatsapp_numbers (workspace_id, member_id)
    WHERE state = 'active';

-- Disconnecting the company account finds its numbers.
CREATE INDEX crm_whatsapp_numbers_connection
    ON integrations.crm_whatsapp_numbers (connection_id)
    WHERE state = 'active';

-- Redacted number events: they name the company connection, never the phone or member.
ALTER TABLE integrations.crm_integration_events
    DROP CONSTRAINT crm_integration_events_action_check,
    ADD CONSTRAINT crm_integration_events_action_check CHECK (
        action IN (
            'connected',
            'reconnected',
            'reconnect_required',
            'disconnected',
            'number_connected',
            'number_disconnected'
        )
    );
