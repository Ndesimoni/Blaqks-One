ALTER TABLE crm_users DROP CONSTRAINT crm_users_role_check;
ALTER TABLE crm_users ADD CONSTRAINT crm_users_role_check
    CHECK (role IN ('super-admin', 'admin', 'staff'));
ALTER TABLE crm_users
    ADD COLUMN owner_id UUID REFERENCES crm_users(id),
    ADD COLUMN workspace_id TEXT REFERENCES crm_workspaces(id),
    ADD COLUMN positions JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN permissions JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN channel_access JSONB NOT NULL DEFAULT '{"email":false,"whatsapp":false}',
    ADD COLUMN version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    ADD COLUMN accepted_at TIMESTAMPTZ DEFAULT now(),
    ADD CONSTRAINT crm_staff_membership CHECK (
        (role='staff' AND owner_id IS NOT NULL AND workspace_id IS NOT NULL AND owner_id<>id)
        OR (role<>'staff' AND owner_id IS NULL AND workspace_id IS NULL)
    ),
    ADD CONSTRAINT crm_positions_array CHECK (jsonb_typeof(positions)='array'),
    ADD CONSTRAINT crm_permissions_object CHECK (jsonb_typeof(permissions)='object'),
    ADD CONSTRAINT crm_channels_object CHECK (jsonb_typeof(channel_access)='object');

CREATE INDEX crm_team_owner ON crm_users(owner_id);
ALTER TABLE crm_workspaces ADD CONSTRAINT crm_workspace_owner_pair UNIQUE(owner_id,id);
ALTER TABLE crm_users ADD CONSTRAINT crm_staff_workspace_owner
    FOREIGN KEY (owner_id,workspace_id) REFERENCES crm_workspaces(owner_id,id);

CREATE VIEW crm_user_profiles AS
SELECT u.id,u.name,u.email,u.phone,u.password_hash,u.role,u.active,u.owner_id,
    COALESCE(u.workspace_id,
        CASE WHEN u.role='super-admin' THEN 'super-admin-workspace' ELSE u.id::text END
    ) AS workspace_id,
    u.positions,u.permissions,u.channel_access,u.version,u.accepted_at,
    CASE WHEN u.role='staff' THEN o.active AND o.role IN ('admin','super-admin')
        ELSE true END AS owner_active
FROM crm_users u LEFT JOIN crm_users o ON o.id=u.owner_id;

CREATE TABLE crm_team_invitations (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES crm_users(id),
    owner_id UUID NOT NULL REFERENCES crm_users(id),
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    created_by UUID NOT NULL REFERENCES crm_users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '48 hours',
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (owner_id,workspace_id) REFERENCES crm_workspaces(owner_id,id)
);

CREATE TABLE crm_team_activity (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES crm_users(id),
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    member_id UUID NOT NULL REFERENCES crm_users(id),
    action TEXT NOT NULL CHECK (action IN ('invited','updated','activated','suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX crm_team_activity_workspace ON crm_team_activity(workspace_id,created_at DESC);
CREATE TRIGGER crm_team_activity_immutable BEFORE UPDATE OR DELETE ON crm_team_activity
    FOR EACH ROW EXECUTE FUNCTION prevent_crm_activity_change();
