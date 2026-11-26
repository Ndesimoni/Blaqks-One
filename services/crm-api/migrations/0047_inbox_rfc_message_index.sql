-- Owner module: inbox (services/crm-api/src/inbox, docs/sendgrid-design.md §12).
-- Packet E3c review M3: company mail threads by the Message-IDs it answers. Without an
-- index that lookup scanned every message under the workspace lock.

CREATE INDEX crm_inbox_messages_rfc
    ON inbox.crm_inbox_messages (rfc_message_id)
    WHERE rfc_message_id IS NOT NULL;
