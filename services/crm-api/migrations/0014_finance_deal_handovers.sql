-- Deal hand-over requests (docs/finance-design.md §13 H-F1). A holder's hand-over waits
-- for the receiving agent (or an Admin approval). The kept referral share, when any,
-- becomes a 'referral' second-agent line on acceptance. Never edit after release.
CREATE TABLE IF NOT EXISTS crm_deal_handovers (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    deal_id UUID NOT NULL,
    from_id UUID NOT NULL REFERENCES crm_users(id),
    to_id UUID NOT NULL REFERENCES crm_users(id),
    referral_share_bp INTEGER CHECK (referral_share_bp BETWEEN 1 AND 10000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'approved', 'cancelled')),
    requested_by UUID NOT NULL REFERENCES crm_users(id),
    decided_by UUID REFERENCES crm_users(id),
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_id <> to_id),
    CHECK ((status = 'pending') = (decided_by IS NULL)),
    CHECK ((decided_by IS NULL) = (decided_at IS NULL)),
    FOREIGN KEY (deal_id, workspace_id) REFERENCES crm_deals(id, workspace_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_deal_handover_pending
    ON crm_deal_handovers(deal_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS crm_deal_handover_members
    ON crm_deal_handovers(workspace_id, to_id, from_id) WHERE status = 'pending';

-- Hand-over requests: decided once; only an Admin approval may adjust the referral share.
CREATE OR REPLACE FUNCTION crm_deal_handover_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM crm_user_profiles p
        WHERE p.id = NEW.to_id AND p.role = 'staff' AND p.workspace_id = NEW.workspace_id
            AND p.active AND p.owner_active) THEN
        RAISE EXCEPTION 'Receiving agent is not active staff' USING ERRCODE = 'P0F04';
    END IF;
    IF TG_OP = 'UPDATE' AND (OLD.status <> 'pending' OR (NEW.id, NEW.workspace_id,
        NEW.deal_id, NEW.from_id, NEW.to_id, NEW.requested_by, NEW.created_at)
        IS DISTINCT FROM (OLD.id, OLD.workspace_id, OLD.deal_id, OLD.from_id, OLD.to_id,
        OLD.requested_by, OLD.created_at) OR (NEW.referral_share_bp IS DISTINCT FROM
        OLD.referral_share_bp AND NEW.status <> 'approved')) THEN
        RAISE EXCEPTION 'Hand-over requests are decided once' USING ERRCODE = 'P0F07';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER crm_deal_handovers_guard BEFORE INSERT OR UPDATE ON crm_deal_handovers
    FOR EACH ROW EXECUTE FUNCTION crm_deal_handover_guard();
