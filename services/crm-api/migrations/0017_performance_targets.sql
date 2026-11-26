-- Owner module: performance (services/crm-api/src/performance, docs/service-boundaries.md).
-- Monthly targets: member_id NULL is the team target. Fees are whole fils; the other
-- measures are counts. Never edit after release. Cross-domain IDs (workspace, member,
-- editor) carry no foreign keys (boundary rule 4): the module validates them under the
-- workspace lock. SQLSTATE P0P01 (performance/errors.rs): a target's identity is fixed.
CREATE TABLE IF NOT EXISTS crm_targets (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) BETWEEN 1 AND 200),
    member_id UUID,
    month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    metric TEXT NOT NULL CHECK (metric IN ('enquiries', 'viewings', 'deals', 'fees')),
    value BIGINT NOT NULL CONSTRAINT crm_targets_value_range CHECK (
        value >= 0 AND value <= 1000000000000 AND (metric = 'fees' OR value <= 1000000)
    ),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_targets_unique UNIQUE NULLS NOT DISTINCT (workspace_id, member_id, month, metric)
);

CREATE INDEX IF NOT EXISTS crm_targets_month ON crm_targets(workspace_id, month);

CREATE OR REPLACE FUNCTION crm_targets_identity_fixed() RETURNS trigger AS $$
BEGIN
    IF NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id
        OR NEW.member_id IS DISTINCT FROM OLD.member_id
        OR NEW.month <> OLD.month OR NEW.metric <> OLD.metric THEN
        RAISE EXCEPTION 'A target keeps its member, month and measure' USING ERRCODE = 'P0P01';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_targets_identity ON crm_targets;
CREATE TRIGGER crm_targets_identity BEFORE UPDATE ON crm_targets
    FOR EACH ROW EXECUTE FUNCTION crm_targets_identity_fixed();

-- Redacted activity (records::audit::append) names the target row only: no values.
ALTER TABLE crm_activity DROP CONSTRAINT IF EXISTS crm_activity_collection_check;
ALTER TABLE crm_activity ADD CONSTRAINT crm_activity_collection_check CHECK (collection IN (
    'Clients', 'Contacts', 'Properties', 'Follow-ups', 'Viewings', 'Shortlist',
    'Interaction log', 'Client care', 'Deals', 'Payments', 'Expenses', 'Targets'));
