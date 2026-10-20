-- Owner module: integrations (services/crm-api/src/integrations, docs/messaging-design.md §3).
-- A disconnected connection keeps its history but releases the provider account, so the
-- same or another company can connect it again. Only live rows hold an account.

DROP INDEX integrations.crm_channel_connections_external;

CREATE UNIQUE INDEX crm_channel_connections_external
    ON integrations.crm_channel_connections (provider, external_account_id)
    WHERE state <> 'disconnected';
