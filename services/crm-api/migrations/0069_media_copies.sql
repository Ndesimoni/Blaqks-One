-- Owner module: media (docs/record-sharing.md R2, review amendment 3). A listing shared
-- outside the company carries copies of its photos and floor plans, owned by the listing
-- snapshot (`owner_kind = 'listing_snapshot'`). A copy is reserved as a tracked, unattached
-- row (origin 'copy', `storage_pending`) with its own key and byte size before any bytes
-- move; it is marked stored after the copy succeeds and attached only then. The sweep hides
-- copies left pending after an hour and unattached after a day, and removes their objects.
-- Copies count against the company's stored bytes, never a member's upload limits, and
-- a member can never attach one through the upload paths (they accept 'upload' only).
ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_owner_kind_check;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_owner_kind_check
    CHECK (owner_kind IS NULL OR owner_kind IN ('chat', 'record', 'inbox_message',
        'listing_snapshot'));
ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_origin_check;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_origin_check
    CHECK (origin IN ('upload', 'inbound', 'backfill', 'copy'));
ALTER TABLE media.crm_media_objects
    ADD COLUMN copied_from uuid,
    ADD CONSTRAINT crm_media_objects_copies
        CHECK ((origin = 'copy') = (copied_from IS NOT NULL)),
    ADD CONSTRAINT crm_media_objects_copy_owner
        CHECK (origin <> 'copy' OR owner_kind IS NULL OR owner_kind = 'listing_snapshot'),
    ADD CONSTRAINT crm_media_objects_snapshot_copies
        CHECK (owner_kind IS DISTINCT FROM 'listing_snapshot' OR origin = 'copy');
CREATE INDEX crm_media_objects_copying ON media.crm_media_objects (uploaded_by)
    WHERE origin = 'copy' AND storage_pending AND deleted_at IS NULL;
