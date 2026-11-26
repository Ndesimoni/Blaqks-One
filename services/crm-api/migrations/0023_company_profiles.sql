-- Owner module: workspaces (docs/service-boundaries.md); sign-up packet S2.
-- No cross-domain foreign keys: identity is checked through auth under workspace locks.
CREATE TABLE crm_company_profiles (
    workspace_id TEXT PRIMARY KEY CHECK (length(workspace_id) BETWEEN 1 AND 200),
    account_type TEXT NOT NULL CHECK (account_type IN ('brokerage', 'individual')),
    member_limit INTEGER CHECK (member_limit >= 1),
    display_name TEXT CHECK (display_name = btrim(display_name)
        AND char_length(display_name) BETWEEN 1 AND 120),
    emirate TEXT CHECK (emirate IN ('abu-dhabi', 'dubai', 'sharjah', 'ajman',
        'umm-al-quwain', 'ras-al-khaimah', 'fujairah')),
    origin TEXT NOT NULL CHECK (origin IN ('existing', 'operator', 'signup')),
    setup_completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_individual_member_limit CHECK (
        account_type <> 'individual' OR member_limit IS NOT DISTINCT FROM 1)
);

-- Includes pending, suspended, archived, organisation and Super Admin personal scopes.
-- Migration evidence is the schema version; do not invent runtime creation history.
INSERT INTO crm_company_profiles (workspace_id, account_type, member_limit, origin)
SELECT id, 'brokerage', NULL, 'existing' FROM crm_workspaces;

CREATE TABLE crm_company_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) BETWEEN 1 AND 200),
    actor_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'details_updated', 'type_changed')),
    from_type TEXT CHECK (from_type IN ('brokerage', 'individual')),
    to_type TEXT CHECK (to_type IN ('brokerage', 'individual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_company_event_types CHECK (
        (action = 'created' AND from_type IS NULL AND to_type IS NOT NULL)
        OR (action = 'details_updated' AND from_type IS NULL AND to_type IS NULL)
        OR (action = 'type_changed' AND from_type IS NOT NULL AND to_type IS NOT NULL
            AND from_type <> to_type))
);

CREATE INDEX crm_company_events_workspace ON crm_company_events(workspace_id, created_at);

CREATE FUNCTION crm_company_events_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Company events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_company_events_immutable BEFORE UPDATE OR DELETE ON crm_company_events
    FOR EACH ROW EXECUTE FUNCTION crm_company_events_immutable();
CREATE TRIGGER crm_company_events_no_truncate BEFORE TRUNCATE ON crm_company_events
    FOR EACH STATEMENT EXECUTE FUNCTION crm_company_events_immutable();
