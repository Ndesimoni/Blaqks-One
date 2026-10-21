-- Owner module: media (docs/media-storage.md, F3 design). Packet F3a: email attachments
-- belong to their Inbox message (`owner_kind = 'inbox_message'`). Every file records where
-- it came from: a member's `upload`, or `inbound` mail stored by the CRM (F3b). Members'
-- limits count, and attach, only uploads, so inbound mail can never use up or reach a
-- member's own files (security review H1).
ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_owner_kind_check;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_owner_kind_check
    CHECK (owner_kind IS NULL OR owner_kind IN ('chat', 'record', 'inbox_message'));

ALTER TABLE media.crm_media_objects
    ADD COLUMN origin text NOT NULL DEFAULT 'upload' CHECK (origin IN ('upload', 'inbound'));
