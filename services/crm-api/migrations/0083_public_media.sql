-- Owner module: media. Public snapshots own separate processed copies, never share copies.
ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_owner_kind_check;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_owner_kind_check
 CHECK (owner_kind IS NULL OR owner_kind IN ('chat','record','inbox_message',
 'listing_snapshot','public_snapshot'));
ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_copy_owner;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_copy_owner
 CHECK (origin <> 'copy' OR owner_kind IS NULL OR owner_kind IN ('listing_snapshot','public_snapshot'));
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_public_copies
 CHECK (owner_kind IS DISTINCT FROM 'public_snapshot' OR origin='copy');
