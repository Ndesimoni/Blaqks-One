-- Owner module: media (services/crm-api/src/media, docs/media-storage.md). Packet F1:
-- one row per stored file. The bytes live in private object storage under a random key;
-- this row holds only what the CRM needs to check access and serve it. A file is pending
-- (no owner) until an owning module attaches it to its own item in that module's
-- transaction; unattached files are removed after 24 hours. No foreign keys into CRM tables.

CREATE SCHEMA IF NOT EXISTS media;

CREATE TABLE media.crm_media_objects (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    uploaded_by uuid NOT NULL,
    storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^[a-f0-9]{32}$'),
    file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
    content_type text NOT NULL CHECK (
        content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    ),
    byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 20971520),
    sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    -- The owning module and its item; both NULL while pending.
    owner_kind text CHECK (owner_kind IS NULL OR owner_kind IN ('chat')),
    owner_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    attached_at timestamptz,
    -- Hidden at once; the storage object is removed by the worker's sweep.
    deleted_at timestamptz,
    storage_removed_at timestamptz,
    CHECK ((owner_kind IS NULL) = (owner_id IS NULL)),
    CHECK ((owner_id IS NULL) = (attached_at IS NULL))
);

CREATE INDEX crm_media_objects_owner ON media.crm_media_objects (owner_kind, owner_id)
    WHERE owner_id IS NOT NULL;
CREATE INDEX crm_media_objects_pending ON media.crm_media_objects (created_at)
    WHERE owner_id IS NULL AND deleted_at IS NULL;
CREATE INDEX crm_media_objects_sweep ON media.crm_media_objects (deleted_at)
    WHERE deleted_at IS NOT NULL AND storage_removed_at IS NULL;
CREATE INDEX crm_media_objects_uploader ON media.crm_media_objects (uploaded_by, created_at);
CREATE INDEX crm_media_objects_usage ON media.crm_media_objects (workspace_id)
    WHERE deleted_at IS NULL;
