-- Owner module: finance (docs/agreements-design.md §14 A3a). A hand-over offered through
-- the app carries the ID of the agreement that records it (no foreign key across modules).
-- The ID is written with the request and frozen with the rest of its identity; older and
-- sample hand-overs have none.

ALTER TABLE crm_deal_handovers ADD COLUMN agreement_id uuid;

CREATE UNIQUE INDEX crm_deal_handover_agreement
    ON crm_deal_handovers (agreement_id) WHERE agreement_id IS NOT NULL;

-- The 0014 guard, with the agreement ID frozen as part of the request's identity.
CREATE OR REPLACE FUNCTION crm_deal_handover_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM crm_user_profiles p
        WHERE p.id = NEW.to_id AND p.role = 'staff' AND p.workspace_id = NEW.workspace_id
            AND p.active AND p.owner_active) THEN
        RAISE EXCEPTION 'Receiving agent is not active staff' USING ERRCODE = 'P0F04';
    END IF;
    IF TG_OP = 'UPDATE' AND (OLD.status <> 'pending' OR (NEW.id, NEW.workspace_id,
        NEW.deal_id, NEW.from_id, NEW.to_id, NEW.requested_by, NEW.created_at,
        NEW.agreement_id) IS DISTINCT FROM (OLD.id, OLD.workspace_id, OLD.deal_id,
        OLD.from_id, OLD.to_id, OLD.requested_by, OLD.created_at, OLD.agreement_id)
        OR (NEW.referral_share_bp IS DISTINCT FROM OLD.referral_share_bp
            AND NEW.status <> 'approved')) THEN
        RAISE EXCEPTION 'Hand-over requests are decided once' USING ERRCODE = 'P0F07';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
