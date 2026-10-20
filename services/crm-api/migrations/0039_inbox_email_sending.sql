-- Owner module: inbox (services/crm-api/src/inbox, docs/messaging-design.md §5).
-- Packet E1b: email sending. A conversation gains the email subject; a message gains the
-- RFC 5322 Message-ID for threading, the message it deliberately repeats ("Send again"),
-- and when its status last changed. `sending` marks a provider call in flight: a message
-- left `sending` by a crash reads as `unknown` and is never re-sent automatically.

ALTER TABLE inbox.crm_inbox_conversations
    ADD COLUMN subject text CHECK (subject IS NULL OR char_length(subject) BETWEEN 1 AND 200);

ALTER TABLE inbox.crm_inbox_messages
    ADD COLUMN rfc_message_id text
        CHECK (rfc_message_id IS NULL OR char_length(rfc_message_id) BETWEEN 3 AND 300),
    ADD COLUMN repeat_of uuid REFERENCES inbox.crm_inbox_messages (id),
    ADD COLUMN status_changed_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE inbox.crm_inbox_messages DROP CONSTRAINT crm_inbox_messages_status_check;
ALTER TABLE inbox.crm_inbox_messages ADD CONSTRAINT crm_inbox_messages_status_check CHECK (
    status IN ('received', 'draft', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'unknown')
);

ALTER TABLE inbox.crm_inbox_events DROP CONSTRAINT crm_inbox_events_action_check;
ALTER TABLE inbox.crm_inbox_events ADD CONSTRAINT crm_inbox_events_action_check CHECK (action IN (
    'created', 'matched', 'assigned', 'state_changed', 'lead_created', 'lead_suggested',
    'linked', 'blocked', 'unblocked', 'send_failed', 'started', 'replied', 'sent_again'
));

