-- Owner module: integrations (services/crm-api/src/integrations, docs/sendgrid-design.md §4, §6).
-- Packet E3b: the signed Event Webhook the CRM creates in a company's SendGrid account.
-- The public key is not secret; it verifies each event's ECDSA signature. The row ends
-- with the connection's disconnect. E3c adds the incoming-mail webhook as kind 'inbound'.

CREATE TABLE integrations.crm_sendgrid_webhooks (
    connection_id uuid NOT NULL REFERENCES integrations.crm_channel_connections (id),
    kind text NOT NULL CHECK (kind IN ('events', 'inbound')),
    workspace_id text NOT NULL,
    provider_webhook_id text NOT NULL CHECK (char_length(provider_webhook_id) BETWEEN 1 AND 100),
    public_key text NOT NULL
        CHECK (char_length(public_key) BETWEEN 40 AND 400 AND public_key ~ '^[A-Za-z0-9+/=]+$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (connection_id, kind)
);
