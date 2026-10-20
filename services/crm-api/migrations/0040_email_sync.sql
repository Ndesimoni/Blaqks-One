-- Packet E1c: reading client replies from connected Google mailboxes.
-- Owner module integrations: each mailbox's Gmail history cursor and last sync time.
-- Owner module inbox: nothing new; replies use the E1b subject and Message-ID columns.
-- Only mail in a thread the CRM knows, or from a linked Client or Contact, is stored.

ALTER TABLE integrations.crm_channel_connections
    ADD COLUMN mail_history_id text
        CHECK (mail_history_id IS NULL OR mail_history_id ~ '^[0-9]{1,30}$'),
    ADD COLUMN mail_synced_at timestamptz;

-- Security review E1c (M1, M2): who actually sent each inbound email, when it is not the
-- conversation's contact, and whether Gmail could not authenticate that sender.
ALTER TABLE inbox.crm_inbox_messages
    ADD COLUMN sender text CHECK (sender IS NULL OR char_length(sender) BETWEEN 3 AND 320),
    ADD COLUMN sender_unverified boolean NOT NULL DEFAULT false;
