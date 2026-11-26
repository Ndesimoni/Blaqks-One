-- Deal guards (docs/finance-design.md §2.2, §13 M-F3, M-F4, M-F7, L-F1, L-F2). Distinct
-- SQLSTATEs, mapped in finance/errors.rs: P0F04 member not eligible, P0F05 earned terms
-- locked, P0F06 deal identity fixed, P0F07 history append-only, P0F08 split total.
CREATE OR REPLACE FUNCTION crm_deal_guard() RETURNS trigger AS $$
DECLARE
    admin_path BOOLEAN := COALESCE(current_setting('kws.finance_admin', true), '') = 'on';
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.earned_on IS NOT NULL THEN
            RAISE EXCEPTION 'Earned deals cannot be deleted' USING ERRCODE = 'P0F05';
        END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF (NEW.id, NEW.workspace_id, NEW.legacy_id, NEW.created_by, NEW.created_at)
            IS DISTINCT FROM (OLD.id, OLD.workspace_id, OLD.legacy_id, OLD.created_by,
            OLD.created_at) THEN
            RAISE EXCEPTION 'Deal identity cannot change' USING ERRCODE = 'P0F06';
        END IF;
        -- Once earned, money and split terms (and the earned date) change only on the
        -- Admin path, which sets the transaction-local bypass.
        IF OLD.earned_on IS NOT NULL AND NOT admin_path AND (NEW.deal_type,
            NEW.agreed_value_fils, NEW.fee_basis, NEW.fee_rate_bp, NEW.fixed_fee_fils,
            NEW.partner_share_bp, NEW.second_agent_id, NEW.second_agent_share_bp,
            NEW.second_agent_kind, NEW.override_agent_share_bp, NEW.override_reason,
            NEW.earned_on) IS DISTINCT FROM (OLD.deal_type, OLD.agreed_value_fils,
            OLD.fee_basis, OLD.fee_rate_bp, OLD.fixed_fee_fils, OLD.partner_share_bp,
            OLD.second_agent_id, OLD.second_agent_share_bp, OLD.second_agent_kind,
            OLD.override_agent_share_bp, OLD.override_reason, OLD.earned_on) THEN
            RAISE EXCEPTION 'Earned deal terms are locked' USING ERRCODE = 'P0F05';
        END IF;
    END IF;
    -- L-F1: a newly named second agent is an active staff member of this workspace.
    IF NEW.second_agent_id IS NOT NULL AND (TG_OP = 'INSERT'
        OR NEW.second_agent_id IS DISTINCT FROM OLD.second_agent_id) AND NOT EXISTS (
        SELECT 1 FROM crm_user_profiles p WHERE p.id = NEW.second_agent_id
            AND p.role = 'staff' AND p.workspace_id = NEW.workspace_id
            AND p.active AND p.owner_active) THEN
        RAISE EXCEPTION 'Second agent is not active staff of this workspace'
            USING ERRCODE = 'P0F04';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER crm_deals_guard BEFORE INSERT OR UPDATE OR DELETE ON crm_deals
    FOR EACH ROW EXECUTE FUNCTION crm_deal_guard();
CREATE OR REPLACE TRIGGER crm_deals_assignee BEFORE INSERT OR UPDATE OF assignee_id ON crm_deals
    FOR EACH ROW EXECUTE FUNCTION crm_check_assignee();

-- Snapshots: no DELETE; UPDATE only sets superseded_at/superseded_reason from NULL, once.
CREATE OR REPLACE FUNCTION crm_deal_snapshot_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' OR OLD.superseded_at IS NOT NULL OR NEW.superseded_at IS NULL
        OR (NEW.id, NEW.deal_id, NEW.workspace_id, NEW.revision, NEW.earned_on, NEW.inputs,
        NEW.split_source, NEW.agreement_id, NEW.primary_agent_id, NEW.vat_registered,
        NEW.vat_rate_bp, NEW.gross_fils, NEW.partner_fils, NEW.net_fils, NEW.company_fils,
        NEW.vat_fils, NEW.reason, NEW.actor_id, NEW.created_at) IS DISTINCT FROM (OLD.id,
        OLD.deal_id, OLD.workspace_id, OLD.revision, OLD.earned_on, OLD.inputs,
        OLD.split_source, OLD.agreement_id, OLD.primary_agent_id, OLD.vat_registered,
        OLD.vat_rate_bp, OLD.gross_fils, OLD.partner_fils, OLD.net_fils, OLD.company_fils,
        OLD.vat_fils, OLD.reason, OLD.actor_id, OLD.created_at) THEN
        RAISE EXCEPTION 'Earned snapshots are append-only' USING ERRCODE = 'P0F07';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER crm_deal_snapshots_guard BEFORE UPDATE OR DELETE
    ON crm_deal_snapshots FOR EACH ROW EXECUTE FUNCTION crm_deal_snapshot_guard();

-- Lines: insert-only, into the current snapshot, for staff of the snapshot's workspace who
-- are active when written (L-F1) unless a revision carries the same agent and role over.
CREATE OR REPLACE FUNCTION crm_deal_line_guard() RETURNS trigger AS $$
DECLARE
    snapshot crm_deal_snapshots%ROWTYPE;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Commission lines are append-only' USING ERRCODE = 'P0F07';
    END IF;
    SELECT * INTO snapshot FROM crm_deal_snapshots WHERE id = NEW.snapshot_id;
    IF snapshot.superseded_at IS NOT NULL THEN
        RAISE EXCEPTION 'Commission lines are append-only' USING ERRCODE = 'P0F07';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM crm_users u WHERE u.id = NEW.agent_id AND u.role = 'staff'
        AND u.workspace_id = snapshot.workspace_id) OR (NOT EXISTS (
            SELECT 1 FROM crm_user_profiles p WHERE p.id = NEW.agent_id AND p.active
                AND p.owner_active AND p.workspace_id = snapshot.workspace_id)
        AND NOT EXISTS (SELECT 1 FROM crm_deal_snapshots s
            JOIN crm_deal_commission_lines l ON l.snapshot_id = s.id
            WHERE s.deal_id = snapshot.deal_id AND s.revision < snapshot.revision
                AND l.role = NEW.role AND l.agent_id = NEW.agent_id)) THEN
        RAISE EXCEPTION 'Commission agent is not eligible' USING ERRCODE = 'P0F04';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER crm_deal_lines_guard BEFORE INSERT OR UPDATE OR DELETE
    ON crm_deal_commission_lines FOR EACH ROW EXECUTE FUNCTION crm_deal_line_guard();

-- At commit: net = company + Σ lines for every snapshot written (deferred).
CREATE OR REPLACE FUNCTION crm_deal_split_total() RETURNS trigger AS $$
DECLARE
    target UUID;
BEGIN
    IF TG_TABLE_NAME = 'crm_deal_snapshots' THEN
        target := NEW.id;
    ELSE
        target := NEW.snapshot_id;
    END IF;
    IF EXISTS (SELECT 1 FROM crm_deal_snapshots s WHERE s.id = target AND s.net_fils <>
        s.company_fils + COALESCE((SELECT sum(l.amount_fils) FROM crm_deal_commission_lines l
            WHERE l.snapshot_id = s.id), 0)) THEN
        RAISE EXCEPTION 'Commission split does not add up' USING ERRCODE = 'P0F08';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS crm_deal_snapshots_total ON crm_deal_snapshots;
CREATE CONSTRAINT TRIGGER crm_deal_snapshots_total AFTER INSERT ON crm_deal_snapshots
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION crm_deal_split_total();
DROP TRIGGER IF EXISTS crm_deal_lines_total ON crm_deal_commission_lines;
CREATE CONSTRAINT TRIGGER crm_deal_lines_total AFTER INSERT ON crm_deal_commission_lines
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION crm_deal_split_total();

-- §13 M-F3: replaces the 0011 placeholder. A new agreement may not start on or before the
-- earned date of any current snapshot naming the agent as primary.
CREATE OR REPLACE FUNCTION crm_agreement_applies_to_earned(ws TEXT, agent UUID, starts DATE)
RETURNS boolean AS $$
    SELECT EXISTS (SELECT 1 FROM crm_deal_snapshots s WHERE s.workspace_id = ws
        AND s.superseded_at IS NULL AND s.primary_agent_id = agent AND s.earned_on >= starts)
$$ LANGUAGE sql STABLE;

-- §13 M-F4 hook: approved receipts of a deal. Payments arrive in a later migration, which
-- replaces this body with the sum of approved payments; until then nothing is approved.
CREATE OR REPLACE FUNCTION crm_deal_approved_fils(deal UUID) RETURNS BIGINT AS $$
    SELECT 0::bigint
$$ LANGUAGE sql STABLE;
