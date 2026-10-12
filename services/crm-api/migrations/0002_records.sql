CREATE TABLE crm_records (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    collection TEXT NOT NULL CHECK (collection IN ('Clients', 'Contacts', 'Properties')),
    legacy_id TEXT NOT NULL CHECK (length(legacy_id) BETWEEN 1 AND 128),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    contact_id TEXT,
    contact_collection TEXT NOT NULL DEFAULT 'Contacts' CHECK (contact_collection = 'Contacts'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, collection, legacy_id),
    FOREIGN KEY (workspace_id, contact_collection, contact_id)
        REFERENCES crm_records(workspace_id, collection, legacy_id),
    CHECK (collection = 'Properties' OR contact_id IS NULL)
);

CREATE INDEX crm_records_workspace ON crm_records(workspace_id, collection, created_at);

CREATE TABLE crm_activity (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES crm_users(id),
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    collection TEXT NOT NULL CHECK (collection IN ('Clients', 'Contacts', 'Properties')),
    record_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crm_activity_workspace ON crm_activity(workspace_id, created_at DESC);

CREATE FUNCTION prevent_crm_activity_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Activity entries are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_activity_immutable BEFORE UPDATE OR DELETE ON crm_activity
    FOR EACH ROW EXECUTE FUNCTION prevent_crm_activity_change();
