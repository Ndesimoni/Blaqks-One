-- Owner module: integrations (docs/messaging-security.md X2-S2).
-- Provider event IDs are unique only within one connected account, so deduplication is
-- per connection: one company's event ID can never suppress another company's event.

DROP INDEX integrations.crm_webhook_receipts_event;

CREATE UNIQUE INDEX crm_webhook_receipts_event
    ON integrations.crm_webhook_receipts (connection_id, event_id);
