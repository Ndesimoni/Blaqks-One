-- Owner module: integrations (services/crm-api/src/integrations, docs/messaging-design.md §3).
-- TikTok business accounts join the Channels registry (owner, 2026-10-20). Only the
-- allowed values change; existing rows already satisfy the wider checks.

ALTER TABLE integrations.crm_channel_connections
    DROP CONSTRAINT crm_channel_connections_channel_check,
    ADD CONSTRAINT crm_channel_connections_channel_check
        CHECK (channel IN ('whatsapp', 'email', 'facebook', 'instagram', 'tiktok')),
    DROP CONSTRAINT crm_channel_connections_provider_check,
    ADD CONSTRAINT crm_channel_connections_provider_check
        CHECK (provider IN ('twilio', 'google', 'microsoft', 'meta', 'tiktok'));
