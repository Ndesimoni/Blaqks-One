-- Owner module: media (docs/media-storage.md, F3 design). Packet F3b: files kept from
-- incoming email. A file is reserved inside the owning module's transaction, already
-- attached and marked `storage_pending`, and stored after the commit; only stored files
-- are listed or served, and the sweep hides any left pending. Inbound files carry two opaque
-- budget keys from the owning module (its connection, and a SHA-256 of the sender) so the
-- daily limits hold without media knowing who sent what (security review H2).
ALTER TABLE media.crm_media_objects
    ADD COLUMN storage_pending boolean NOT NULL DEFAULT false,
    ADD COLUMN quota_group uuid,
    ADD COLUMN quota_key text CHECK (quota_key IS NULL OR quota_key ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT crm_media_objects_inbound_keys
        CHECK (origin = 'upload' OR (quota_group IS NOT NULL AND quota_key IS NOT NULL));

CREATE INDEX crm_media_objects_inbound ON media.crm_media_objects (quota_group, created_at)
    WHERE origin = 'inbound';
