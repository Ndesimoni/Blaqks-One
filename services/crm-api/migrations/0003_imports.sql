CREATE TABLE crm_import_plans (
    token_hash TEXT PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES crm_users(id),
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    records JSONB NOT NULL,
    fingerprint TEXT NOT NULL,
    counts JSONB NOT NULL,
    skipped JSONB NOT NULL,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 minutes'
);

CREATE INDEX crm_import_expiry ON crm_import_plans(expires_at);
