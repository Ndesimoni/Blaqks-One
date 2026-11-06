-- Owner module: integrations (services/crm-api/src/integrations, docs/whatsapp-design.md §8, §18).
-- Packet W1b: WhatsApp templates read from the company's Twilio account (Content Template
-- Builder, approved by Meta). Only approved `twilio/text` templates with numbered
-- variables are offered to the composer; other states are kept for the Admin's list. The
-- body is the company's own template text. No variable value, phone or message is stored.

-- Composite keys tie rows that name a connection to that connection's own company (L5).
ALTER TABLE integrations.crm_channel_connections
    ADD CONSTRAINT crm_channel_connections_scope UNIQUE (id, workspace_id),
    ADD COLUMN templates_checked_at timestamptz,
    ADD COLUMN templates_synced_at timestamptz;

ALTER TABLE integrations.crm_whatsapp_numbers
    ADD CONSTRAINT crm_whatsapp_numbers_connection_scope
        FOREIGN KEY (connection_id, workspace_id)
        REFERENCES integrations.crm_channel_connections (id, workspace_id);

CREATE TABLE integrations.crm_provider_templates (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    connection_id uuid NOT NULL,
    provider_template_id text NOT NULL CHECK (provider_template_id ~ '^HX[0-9a-f]{32}$'),
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    language text NOT NULL CHECK (language ~ '^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})?$'),
    category text CHECK (category IS NULL OR category ~ '^[A-Z_]{1,40}$'),
    approval text NOT NULL
        CHECK (approval IN ('approved', 'pending', 'rejected', 'paused', 'disabled', 'other')),
    kind text NOT NULL CHECK (kind IN ('text', 'other')),
    body text CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 1024),
    variable_count smallint NOT NULL CHECK (variable_count BETWEEN 0 AND 10),
    synced_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind = 'text') = (body IS NOT NULL)),
    CONSTRAINT crm_provider_templates_connection_scope
        FOREIGN KEY (connection_id, workspace_id)
        REFERENCES integrations.crm_channel_connections (id, workspace_id)
);

CREATE UNIQUE INDEX crm_provider_templates_template
    ON integrations.crm_provider_templates (connection_id, provider_template_id);
