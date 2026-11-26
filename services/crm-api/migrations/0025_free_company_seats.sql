-- Owner module: workspaces. Every customer workspace is now a company workspace.
ALTER TABLE crm_company_profiles DROP CONSTRAINT crm_individual_member_limit;
ALTER TABLE crm_company_profiles DROP CONSTRAINT crm_company_profiles_account_type_check;

WITH occupied AS (
    SELECT c.workspace_id, 1 + count(u.id) FILTER (WHERE
        u.role = 'staff' AND u.deleted_at IS NULL AND (
            (u.active AND u.accepted_at IS NOT NULL) OR
            (u.accepted_at IS NULL AND EXISTS (
                SELECT 1 FROM crm_team_invitations i
                WHERE i.user_id = u.id AND i.workspace_id = c.workspace_id
                  AND i.expires_at > now() AND i.consumed_at IS NULL
                  AND i.revoked_at IS NULL
            ))
        )) AS used
    FROM crm_company_profiles c
    LEFT JOIN crm_users u ON u.workspace_id = c.workspace_id
    GROUP BY c.workspace_id
)
UPDATE crm_company_profiles c
SET account_type = 'brokerage',
    member_limit = GREATEST(3, occupied.used),
    updated_at = now(),
    version = version + 1
FROM occupied
WHERE c.workspace_id = occupied.workspace_id
  AND c.workspace_id <> 'super-admin-workspace';

ALTER TABLE crm_company_profiles ADD CONSTRAINT crm_company_account_type
    CHECK (account_type = 'brokerage');
ALTER TABLE crm_company_profiles ADD CONSTRAINT crm_customer_company_member_limit
    CHECK (workspace_id = 'super-admin-workspace' OR member_limit IS NOT NULL);

CREATE TABLE crm_company_limit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL CHECK (length(workspace_id) BETWEEN 1 AND 200),
    actor_id UUID NOT NULL,
    from_limit INTEGER NOT NULL CHECK (from_limit >= 1),
    to_limit INTEGER NOT NULL CHECK (to_limit >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_limit <> to_limit)
);

CREATE INDEX crm_company_limit_events_workspace
    ON crm_company_limit_events(workspace_id, created_at);
CREATE TRIGGER crm_company_limit_events_immutable
    BEFORE UPDATE OR DELETE ON crm_company_limit_events
    FOR EACH ROW EXECUTE FUNCTION crm_company_events_immutable();
CREATE TRIGGER crm_company_limit_events_no_truncate
    BEFORE TRUNCATE ON crm_company_limit_events
    FOR EACH STATEMENT EXECUTE FUNCTION crm_company_events_immutable();
