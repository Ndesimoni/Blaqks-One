-- Owner module: inbox (docs/media-storage.md, F3 design). Packet F3b: how many files of an
-- incoming email were not kept (an unsupported type, an unverified or spam sender, a daily
-- budget, a duplicate, or storage failing), so the thread can say so honestly.
ALTER TABLE inbox.crm_inbox_messages
    ADD COLUMN files_not_kept smallint NOT NULL DEFAULT 0
        CHECK (files_not_kept BETWEEN 0 AND 100);
