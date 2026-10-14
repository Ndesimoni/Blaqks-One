-- Finance grants, settings, commission agreements and finance history
-- (docs/finance-design.md §2.2, §5.1, §13). Additive and idempotent; never edit after release.
CREATE EXTENSION IF NOT EXISTS btree_gist; -- trusted extension (PG13+), for the overlap guard

-- L-1: module grants must be booleans before the backfill reads them.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM crm_users WHERE role='staff' AND deleted_at IS NULL
        AND permissions ? 'finance' AND jsonb_typeof(permissions->'finance')<>'boolean') THEN
        RAISE EXCEPTION 'crm_users.permissions holds a non-boolean finance grant';
    END IF;
END $$;

-- Backfill (§5.1, §8): non-archived staff with recorded grants get finance create, edit and
-- assign equal to their finance module; approve and teamView are denied by default. Rows
-- already holding a finance key, unrecorded '{}' rows and archived rows are untouched, as
-- are versions, sessions and timestamps, so re-runs are no-ops.
WITH grants AS (
    SELECT id, COALESCE(permissions->'finance' = 'true'::jsonb, false) AS granted
    FROM crm_users WHERE role='staff' AND deleted_at IS NULL
        AND actions<>'{}'::jsonb AND NOT actions ? 'finance')
UPDATE crm_users u SET actions = u.actions || jsonb_build_object('finance', jsonb_build_object(
    'create', g.granted, 'edit', g.granted, 'assign', g.granted,
    'approve', false, 'teamView', false))
FROM grants g WHERE u.id=g.id;

-- §5.1 and §13 L-F1: teamView needs whole-team scope, approve needs teamView, and any
-- finance flag needs the finance module.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='crm_actions_finance_team') THEN
        ALTER TABLE crm_users ADD CONSTRAINT crm_actions_finance_team CHECK (
            record_scope='team' OR NOT actions @> '{"finance":{"teamView":true}}'::jsonb);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='crm_actions_finance_approve') THEN
        ALTER TABLE crm_users ADD CONSTRAINT crm_actions_finance_approve CHECK (
            NOT actions @> '{"finance":{"approve":true}}'::jsonb
            OR actions @> '{"finance":{"teamView":true}}'::jsonb);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='crm_actions_finance_module') THEN
        ALTER TABLE crm_users ADD CONSTRAINT crm_actions_finance_module CHECK (
            COALESCE(permissions->'finance' = 'true'::jsonb, false) OR NOT (
                actions @> '{"finance":{"create":true}}'::jsonb
                OR actions @> '{"finance":{"edit":true}}'::jsonb
                OR actions @> '{"finance":{"assign":true}}'::jsonb
                OR actions @> '{"finance":{"approve":true}}'::jsonb
                OR actions @> '{"finance":{"teamView":true}}'::jsonb));
    END IF;
END $$;

-- One row per workspace; the company share is the remainder of agent_share_bp.
CREATE TABLE IF NOT EXISTS crm_finance_settings (
    workspace_id TEXT PRIMARY KEY REFERENCES crm_workspaces(id),
    id UUID NOT NULL UNIQUE, -- finance history entity ID
    agent_share_bp INTEGER NOT NULL CHECK (agent_share_bp BETWEEN 0 AND 10000),
    second_agent_source TEXT NOT NULL CHECK (second_agent_source IN ('first_agent','company')),
    max_referral_share_bp INTEGER NOT NULL DEFAULT 0
        CHECK (max_referral_share_bp BETWEEN 0 AND 10000), -- §13 H-F1
    vat_registered BOOLEAN NOT NULL DEFAULT false,
    vat_rate_bp INTEGER NOT NULL DEFAULT 500 CHECK (vat_rate_bp = 500), -- 5% by decision
    trn TEXT CHECK (trn ~ '^[0-9]{15}$'),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_by UUID NOT NULL REFERENCES crm_users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-agent shares; effective_to is exclusive and set only by an auto-close.
CREATE TABLE IF NOT EXISTS crm_commission_agreements (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    agent_id UUID NOT NULL REFERENCES crm_users(id),
    agent_share_bp INTEGER NOT NULL CHECK (agent_share_bp BETWEEN 0 AND 10000),
    effective_from DATE NOT NULL,
    effective_to DATE CHECK (effective_to IS NULL OR effective_to > effective_from),
    created_by UUID NOT NULL REFERENCES crm_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_agreements_no_overlap EXCLUDE USING gist (workspace_id WITH =,
        agent_id WITH =, daterange(effective_from, effective_to, '[)') WITH &&)
);
CREATE INDEX IF NOT EXISTS crm_agreements_agent
    ON crm_commission_agreements(workspace_id, agent_id, effective_from);

-- §13 M-F7: distinct SQLSTATEs (P0F01 terms immutable, P0F02 agent not team staff,
-- P0F03 started agreement deleted); never 23514 without a constraint.
CREATE OR REPLACE FUNCTION crm_agreement_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.effective_from <= (now() AT TIME ZONE 'Asia/Dubai')::date THEN
            RAISE EXCEPTION 'Agreements that have started cannot be removed'
                USING ERRCODE = 'P0F03';
        END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.id, NEW.workspace_id, NEW.agent_id, NEW.agent_share_bp,
        NEW.effective_from, NEW.created_by, NEW.created_at) IS DISTINCT FROM (OLD.id,
        OLD.workspace_id, OLD.agent_id, OLD.agent_share_bp, OLD.effective_from,
        OLD.created_by, OLD.created_at) THEN
        RAISE EXCEPTION 'Only an agreement end date may change' USING ERRCODE = 'P0F01';
    END IF;
    IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM crm_users WHERE id=NEW.agent_id
        AND role='staff' AND workspace_id=NEW.workspace_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Agreement agent is not staff of this workspace'
            USING ERRCODE = 'P0F02';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER crm_agreements_guard
    BEFORE INSERT OR UPDATE OR DELETE ON crm_commission_agreements
    FOR EACH ROW EXECUTE FUNCTION crm_agreement_guard();

-- §13 M-F3: whether a new agreement starting on `starts` would cover an earned deal of
-- this agent. No deals exist yet, so it is false; 0012 replaces the body with the query
-- over current snapshots (earned_on >= starts for the agent's commission lines).
CREATE OR REPLACE FUNCTION crm_agreement_applies_to_earned(ws TEXT, agent UUID, starts DATE)
RETURNS boolean AS $$ SELECT false $$ LANGUAGE sql STABLE;

-- Append-only financial history (business content). `changes` holds only
-- {field:[before,after]} for money, rates, dates, statuses and agents; free text is
-- recorded as "changed". crm_activity keeps action names only.
CREATE TABLE IF NOT EXISTS crm_finance_events (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    entity TEXT NOT NULL CHECK (entity IN ('settings','agreement','deal','payment','expense')),
    entity_id UUID NOT NULL, -- no FK (like crm_assignments, M4)
    action TEXT NOT NULL CHECK (action IN ('created','updated','submitted','resubmitted',
        'approved','rejected','voided','earned','revised','unearned','split_changed',
        'assigned','closed','deleted','reopened')),
    actor_id UUID NOT NULL REFERENCES crm_users(id),
    changes JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(changes)='object'),
    reason TEXT CHECK (reason IS NULL OR length(btrim(reason)) BETWEEN 1 AND 500),
    source TEXT NOT NULL DEFAULT COALESCE(NULLIF(current_setting('kws.activity_source', true),
        ''), 'app') CHECK (source IN ('app','sample')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_finance_events_entity
    ON crm_finance_events(workspace_id, entity, entity_id, created_at);
CREATE OR REPLACE TRIGGER crm_finance_events_immutable
    BEFORE UPDATE OR DELETE ON crm_finance_events
    FOR EACH ROW EXECUTE FUNCTION prevent_crm_activity_change();
