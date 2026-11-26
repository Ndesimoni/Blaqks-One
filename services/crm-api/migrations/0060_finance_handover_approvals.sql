-- Owner module: finance (docs/agreements-design.md §17, packet H2). The holder may require
-- approval by a chosen approver: the receiver accepts first (`awaiting_approval`, with
-- `accepted_by` and `accepted_at`), then the approver or the Admin approves and only then
-- does the deal move. A deal may also be handed to the company's own Admin, fully only.
-- "Open" means `pending` or `awaiting_approval`; one open request per deal.

ALTER TABLE crm_deal_handovers
    ADD COLUMN requires_approval boolean NOT NULL DEFAULT false,
    ADD COLUMN approver_id uuid REFERENCES crm_users(id),
    ADD COLUMN accepted_by uuid REFERENCES crm_users(id),
    ADD COLUMN accepted_at timestamptz,
    DROP CONSTRAINT crm_deal_handovers_status_check,
    ADD CONSTRAINT crm_deal_handovers_status_check CHECK (status IN ('pending',
        'awaiting_approval', 'accepted', 'declined', 'approved', 'cancelled')),
    DROP CONSTRAINT crm_deal_handovers_check1,
    ADD CONSTRAINT crm_deal_handovers_decided_check
        CHECK ((status IN ('pending', 'awaiting_approval')) = (decided_by IS NULL)),
    ADD CONSTRAINT crm_deal_handovers_approver_check
        CHECK (requires_approval = (approver_id IS NOT NULL)
            AND (NOT requires_approval OR agreement_id IS NOT NULL)
            AND approver_id <> from_id AND approver_id <> to_id),
    ADD CONSTRAINT crm_deal_handovers_acceptance_check
        CHECK ((accepted_by IS NULL) = (accepted_at IS NULL)
            AND (accepted_by IS NULL OR (requires_approval AND accepted_by = to_id
                AND status IN ('awaiting_approval', 'approved', 'cancelled')))
            AND (status <> 'awaiting_approval' OR accepted_by IS NOT NULL));

DROP INDEX crm_deal_handover_pending;
CREATE UNIQUE INDEX crm_deal_handover_open
    ON crm_deal_handovers(deal_id) WHERE status IN ('pending', 'awaiting_approval');
DROP INDEX crm_deal_handover_members;
CREATE INDEX crm_deal_handover_members
    ON crm_deal_handovers(workspace_id, to_id, from_id)
    WHERE status IN ('pending', 'awaiting_approval');

-- The 0058 guard with H2's steps. A request starts pending; the receiver is active staff,
-- or the company's Admin for a full hand-over without approval; a chosen approver is an
-- active member of the company (the Approve right is checked in Rust). Pending requests
-- are decided, or wait for approval when required; a waiting request is approved or
-- cancelled, never approved by the receiver. The approval choice and the receiver's
-- acceptance are frozen once written.
CREATE OR REPLACE FUNCTION crm_deal_handover_guard() RETURNS trigger AS $$
DECLARE
    receiver text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT p.role INTO receiver FROM crm_user_profiles p
            WHERE p.id = NEW.to_id AND p.workspace_id = NEW.workspace_id
                AND p.active AND p.owner_active;
        IF receiver IS NULL OR receiver NOT IN ('staff', 'admin') OR (receiver = 'admin'
            AND (NEW.referral_share_bp IS NOT NULL OR NEW.requires_approval)) THEN
            RAISE EXCEPTION 'Receiving agent is not active staff' USING ERRCODE = 'P0F04';
        END IF;
        IF NEW.status <> 'pending' OR NEW.accepted_by IS NOT NULL OR (NEW.requires_approval
            AND NOT EXISTS (SELECT 1 FROM crm_user_profiles p WHERE p.id = NEW.approver_id
                AND p.workspace_id = NEW.workspace_id AND p.role IN ('staff', 'admin')
                AND p.active AND p.owner_active)) THEN
            RAISE EXCEPTION 'Receiving agent is not active staff' USING ERRCODE = 'P0F04';
        END IF;
        RETURN NEW;
    END IF;
    IF (NEW.id, NEW.workspace_id, NEW.deal_id, NEW.from_id, NEW.to_id, NEW.requested_by,
        NEW.created_at, NEW.agreement_id, NEW.requires_approval, NEW.approver_id)
        IS DISTINCT FROM (OLD.id, OLD.workspace_id, OLD.deal_id, OLD.from_id, OLD.to_id,
        OLD.requested_by, OLD.created_at, OLD.agreement_id, OLD.requires_approval,
        OLD.approver_id)
        OR NOT ((OLD.status = 'pending' AND (NEW.status IN ('declined', 'cancelled', 'approved')
                OR (NEW.status = 'accepted' AND NOT OLD.requires_approval)
                OR (NEW.status = 'awaiting_approval' AND OLD.requires_approval)))
            OR (OLD.status = 'awaiting_approval' AND NEW.status IN ('approved', 'cancelled')))
        OR (NEW.status = 'approved' AND NEW.decided_by = NEW.to_id)
        OR (NEW.referral_share_bp IS DISTINCT FROM OLD.referral_share_bp
            AND NOT (OLD.status = 'pending' AND NEW.status = 'approved'))
        OR ((NEW.accepted_by, NEW.accepted_at) IS DISTINCT FROM (OLD.accepted_by, OLD.accepted_at)
            AND NOT (OLD.status = 'pending' AND NEW.status = 'awaiting_approval')) THEN
        RAISE EXCEPTION 'Hand-over requests are decided once' USING ERRCODE = 'P0F07';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
