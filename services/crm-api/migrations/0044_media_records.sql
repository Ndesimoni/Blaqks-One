-- Owner module: media (docs/media-storage.md). Packet F2: property photos and floor plans
-- are stored files owned by their record (`owner_kind = 'record'`, `owner_id` = the record
-- ID). The records module attaches and removes them in its own transactions.
ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_owner_kind_check;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_owner_kind_check
    CHECK (owner_kind IS NULL OR owner_kind IN ('chat', 'record'));
