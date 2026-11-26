-- Owner module: chat (docs/team-chat.md). Packet F1: a message may be only photos or
-- files, so its text may be empty while it is not deleted (the API still requires text or
-- at least one attachment). Attachments live in `media`, keyed by the message ID.
DO $$
DECLARE
    check_name text;
BEGIN
    SELECT conname INTO check_name FROM pg_constraint
    WHERE conrelid = 'chat.crm_chat_messages'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%deleted_at IS NULL%';
    EXECUTE format('ALTER TABLE chat.crm_chat_messages DROP CONSTRAINT %I', check_name);
END $$;

ALTER TABLE chat.crm_chat_messages ADD CONSTRAINT crm_chat_messages_body CHECK (
    (deleted_at IS NULL AND char_length(body) <= 4000)
    OR (deleted_at IS NOT NULL AND body = '')
);
