-- Deals, earned snapshots and commission lines (docs/finance-design.md §2.2, §13).
-- Guards follow in 0013 and hand-over requests in 0014. Additive; never edit after release.
CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    legacy_id TEXT NOT NULL CHECK (length(legacy_id) BETWEEN 1 AND 128), -- immutable (0013)
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    assignee_id UUID REFERENCES crm_users(id), -- holder; NULL = the Admin queue
    client_ref TEXT NOT NULL,
    client_collection TEXT NOT NULL DEFAULT 'Clients' CHECK (client_collection = 'Clients'),
    property_ref TEXT,
    property_collection TEXT NOT NULL DEFAULT 'Properties'
        CHECK (property_collection = 'Properties'),
    deal_type TEXT NOT NULL CHECK (deal_type IN ('Sale', 'Rental', 'Holiday home')),
    stage TEXT NOT NULL CHECK (stage IN ('New', 'Qualified', 'Viewing', 'Offer', 'Negotiation',
        'Documentation', 'Completed', 'Lost', 'Cancelled', 'On hold')),
    -- §13 L-F3 realistic caps: AED 10bn.
    agreed_value_fils BIGINT NOT NULL DEFAULT 0
        CHECK (agreed_value_fils BETWEEN 0 AND 1000000000000),
    fee_basis TEXT NOT NULL CHECK (fee_basis IN ('percentage', 'fixed')),
    fee_rate_bp INTEGER CHECK (fee_rate_bp BETWEEN 0 AND 10000),
    fixed_fee_fils BIGINT CHECK (fixed_fee_fils BETWEEN 0 AND 1000000000000),
    partner_share_bp INTEGER NOT NULL DEFAULT 0 CHECK (partner_share_bp BETWEEN 0 AND 10000),
    partner_name TEXT CHECK (length(partner_name) BETWEEN 1 AND 200),
    second_agent_id UUID REFERENCES crm_users(id),
    second_agent_share_bp INTEGER CHECK (second_agent_share_bp BETWEEN 0 AND 10000),
    -- 'split': Admin-set, sourced per the team setting; 'referral': kept on a hand-over and
    -- always sourced from the receiving (primary) agent's share (§13 H-F1).
    second_agent_kind TEXT CHECK (second_agent_kind IN ('split', 'referral')),
    override_agent_share_bp INTEGER CHECK (override_agent_share_bp BETWEEN 0 AND 10000),
    override_reason TEXT CHECK (length(btrim(override_reason)) BETWEEN 1 AND 500),
    earned_on DATE,
    details JSONB NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(details) = 'object' AND octet_length(details::text) <= 16384),
    created_by UUID NOT NULL REFERENCES crm_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_deals_fee CHECK ((fee_basis = 'percentage' AND fee_rate_bp IS NOT NULL)
        OR (fee_basis = 'fixed' AND fixed_fee_fils IS NOT NULL)),
    CONSTRAINT crm_deals_second CHECK ((second_agent_id IS NULL) = (second_agent_share_bp IS NULL)
        AND (second_agent_id IS NULL) = (second_agent_kind IS NULL)),
    CONSTRAINT crm_deals_override
        CHECK ((override_agent_share_bp IS NULL) = (override_reason IS NULL)),
    UNIQUE (workspace_id, legacy_id),
    UNIQUE (id, workspace_id),
    CONSTRAINT crm_deals_client_link FOREIGN KEY (workspace_id, client_collection, client_ref)
        REFERENCES crm_records(workspace_id, collection, legacy_id),
    CONSTRAINT crm_deals_property_link FOREIGN KEY (workspace_id, property_collection, property_ref)
        REFERENCES crm_records(workspace_id, collection, legacy_id)
);
CREATE INDEX IF NOT EXISTS crm_deals_holder ON crm_deals(workspace_id, assignee_id);
CREATE INDEX IF NOT EXISTS crm_deals_clients ON crm_deals(workspace_id, client_ref);
CREATE INDEX IF NOT EXISTS crm_deals_properties ON crm_deals(workspace_id, property_ref)
    WHERE property_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_deals_second_agent ON crm_deals(second_agent_id)
    WHERE second_agent_id IS NOT NULL;

-- Append-only earned figures. Only superseded_at/superseded_reason may be set, once (0013).
CREATE TABLE IF NOT EXISTS crm_deal_snapshots (
    id UUID PRIMARY KEY,
    deal_id UUID NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    revision INTEGER NOT NULL CHECK (revision > 0),
    earned_on DATE NOT NULL,
    inputs JSONB NOT NULL CHECK (jsonb_typeof(inputs) = 'object'), -- full calculation input
    split_source TEXT NOT NULL
        CHECK (split_source IN ('agreement', 'team_default', 'override', 'owner')),
    agreement_id UUID REFERENCES crm_commission_agreements(id),
    primary_agent_id UUID REFERENCES crm_users(id), -- NULL when owner-held or queued
    vat_registered BOOLEAN NOT NULL,
    vat_rate_bp INTEGER NOT NULL CHECK (vat_rate_bp BETWEEN 0 AND 10000),
    gross_fils BIGINT NOT NULL CHECK (gross_fils >= 0),
    partner_fils BIGINT NOT NULL CHECK (partner_fils >= 0),
    net_fils BIGINT NOT NULL CHECK (net_fils >= 0),
    company_fils BIGINT NOT NULL CHECK (company_fils >= 0),
    vat_fils BIGINT NOT NULL CHECK (vat_fils >= 0),
    reason TEXT CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
    actor_id UUID NOT NULL REFERENCES crm_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_at TIMESTAMPTZ,
    superseded_reason TEXT CHECK (length(btrim(superseded_reason)) BETWEEN 1 AND 500),
    CHECK (gross_fils = partner_fils + net_fils),
    CHECK ((superseded_at IS NULL) = (superseded_reason IS NULL)),
    UNIQUE (deal_id, revision),
    FOREIGN KEY (deal_id, workspace_id) REFERENCES crm_deals(id, workspace_id) -- RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_deal_current_snapshot
    ON crm_deal_snapshots(deal_id) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_deal_snapshots_agent
    ON crm_deal_snapshots(workspace_id, primary_agent_id) WHERE superseded_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_deal_commission_lines (
    snapshot_id UUID NOT NULL REFERENCES crm_deal_snapshots(id),
    role TEXT NOT NULL CHECK (role IN ('primary', 'second')),
    agent_id UUID NOT NULL REFERENCES crm_users(id),
    share_bp INTEGER NOT NULL CHECK (share_bp BETWEEN 0 AND 10000),
    amount_fils BIGINT NOT NULL CHECK (amount_fils >= 0),
    PRIMARY KEY (snapshot_id, role)
);
CREATE INDEX IF NOT EXISTS crm_deal_lines_agent ON crm_deal_commission_lines(agent_id);

-- Deal assignment history uses crm_assignments ('Deals'; 'handover' for accepted requests),
-- and crm_activity records deal actions by name only (§2.2).
ALTER TABLE crm_assignments DROP CONSTRAINT IF EXISTS crm_assignments_collection_check;
ALTER TABLE crm_assignments ADD CONSTRAINT crm_assignments_collection_check
    CHECK (collection IN ('Clients', 'Properties', 'Contacts', 'Follow-ups', 'Deals'));
ALTER TABLE crm_assignments DROP CONSTRAINT IF EXISTS crm_assignments_reason_check;
ALTER TABLE crm_assignments ADD CONSTRAINT crm_assignments_reason_check CHECK (reason IN (
    'created', 'backfill', 'reassigned', 'bulk', 'departure', 'access_removed', 'import',
    'handover'));
ALTER TABLE crm_activity DROP CONSTRAINT IF EXISTS crm_activity_collection_check;
ALTER TABLE crm_activity ADD CONSTRAINT crm_activity_collection_check CHECK (collection IN (
    'Clients', 'Contacts', 'Properties', 'Follow-ups', 'Viewings', 'Shortlist',
    'Interaction log', 'Client care', 'Deals', 'Payments', 'Expenses'));
ALTER TABLE crm_activity DROP CONSTRAINT IF EXISTS crm_activity_action_check;
ALTER TABLE crm_activity ADD CONSTRAINT crm_activity_action_check CHECK (action IN (
    'created', 'updated', 'deleted', 'assigned', 'earned', 'revised', 'unearned', 'approved',
    'rejected', 'voided'));

-- Release-notes report (read-only, not executed): team-scope staff who lose Client or
-- Property delete and rename because finance references now need "See team finance"
-- (§13 L-F2, owner Q9).
--   SELECT id, name, workspace_id FROM crm_users
--   WHERE role='staff' AND deleted_at IS NULL AND record_scope='team'
--     AND (actions @> '{"relationships":{"deleteMain":true}}'
--       OR actions @> '{"properties":{"deleteMain":true}}')
--     AND NOT (permissions @> '{"finance":true}'
--       AND actions @> '{"finance":{"teamView":true}}');
