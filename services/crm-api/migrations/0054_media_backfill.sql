-- Owner module: media (docs/media-storage.md, "F2 backfill as built"). Property photos and
-- floor plans the trusted `media-backfill` command moves out of record JSON are stored with
-- origin 'backfill': they never count against a member's hourly or pending upload limits,
-- a member can never attach them, and each row stays a durable trace of what the operator
-- moved and when (the command writes no activity row; see the design note). Only inbound
-- files need the two budget keys, as before.
ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_origin_check;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_origin_check
    CHECK (origin IN ('upload', 'inbound', 'backfill'));

ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_inbound_keys;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_inbound_keys
    CHECK (origin <> 'inbound' OR (quota_group IS NOT NULL AND quota_key IS NOT NULL));
