-- Owner module: media (docs/broker-marketplace.md §14 amendment 7, packet MK1b). A member's
-- marketplace profile photo is an original upload owned by the member (`owner_kind =
-- 'market_profile'`), served only to members who may see that profile. Every other kind stays.
ALTER TABLE media.crm_media_objects DROP CONSTRAINT crm_media_objects_owner_kind_check;
ALTER TABLE media.crm_media_objects ADD CONSTRAINT crm_media_objects_owner_kind_check
    CHECK (owner_kind IS NULL OR owner_kind IN ('chat', 'record', 'inbox_message',
        'listing_snapshot', 'market_profile'));
