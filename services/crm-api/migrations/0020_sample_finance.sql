-- Sample finance (docs/finance-design.md §8 and §18, B6; local development only). Marks the
-- finance rows `seed-sample` created, and lets `clear-sample` delete exactly those rows
-- while every other delete keeps its 0011-0015 refusal and SQLSTATE. Additive; never edit
-- after release.
CREATE TABLE IF NOT EXISTS crm_sample_finance (
    entity TEXT NOT NULL CHECK (entity IN ('settings', 'agreement', 'deal', 'handover',
        'payment', 'expense')),
    entity_id UUID NOT NULL, -- no FK: the rows live in several finance tables
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entity, entity_id)
);
CREATE INDEX IF NOT EXISTS crm_sample_finance_workspace
    ON crm_sample_finance(workspace_id, entity);

-- True only inside the sample command's transaction (`kws.activity_source` = 'sample',
-- set by `sample::mark_source` alone) for a row marked as sample finance.
CREATE OR REPLACE FUNCTION crm_sample_finance_removable(kind TEXT, target UUID)
RETURNS boolean AS $$
    SELECT COALESCE(current_setting('kws.activity_source', true), '') = 'sample'
        AND EXISTS (SELECT 1 FROM crm_sample_finance m
            WHERE m.entity = kind AND m.entity_id = target)
$$ LANGUAGE sql STABLE;

-- One BEFORE DELETE guard for the finance tables. Outside a sample clear it applies the
-- original rules: payments and expenses are never deleted (P0F09), earned deals stay
-- (P0F05), snapshots and lines are append-only (P0F07) and started agreements stay
-- (P0F03). Unearned deals and future agreements may still be deleted in the app.
CREATE OR REPLACE FUNCTION crm_finance_delete_guard() RETURNS trigger AS $$
DECLARE
    stale JSONB := to_jsonb(OLD);
    deal UUID;
BEGIN
    CASE TG_TABLE_NAME
    WHEN 'crm_payments', 'crm_expenses' THEN
        IF NOT crm_sample_finance_removable(CASE TG_TABLE_NAME WHEN 'crm_payments'
            THEN 'payment' ELSE 'expense' END, (stale->>'id')::uuid) THEN
            RAISE EXCEPTION 'Payments and expenses cannot be deleted' USING ERRCODE = 'P0F09';
        END IF;
    WHEN 'crm_deals' THEN
        IF stale->>'earned_on' IS NOT NULL
            AND NOT crm_sample_finance_removable('deal', (stale->>'id')::uuid) THEN
            RAISE EXCEPTION 'Earned deals cannot be deleted' USING ERRCODE = 'P0F05';
        END IF;
    WHEN 'crm_deal_snapshots' THEN
        IF NOT crm_sample_finance_removable('deal', (stale->>'deal_id')::uuid) THEN
            RAISE EXCEPTION 'Earned snapshots are append-only' USING ERRCODE = 'P0F07';
        END IF;
    WHEN 'crm_deal_commission_lines' THEN
        SELECT s.deal_id INTO deal FROM crm_deal_snapshots s
            WHERE s.id = (stale->>'snapshot_id')::uuid;
        IF deal IS NULL OR NOT crm_sample_finance_removable('deal', deal) THEN
            RAISE EXCEPTION 'Commission lines are append-only' USING ERRCODE = 'P0F07';
        END IF;
    WHEN 'crm_commission_agreements' THEN
        IF (stale->>'effective_from')::date <= (now() AT TIME ZONE 'Asia/Dubai')::date
            AND NOT crm_sample_finance_removable('agreement', (stale->>'id')::uuid) THEN
            RAISE EXCEPTION 'Agreements that have started cannot be removed'
                USING ERRCODE = 'P0F03';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unexpected finance delete guard table %', TG_TABLE_NAME;
    END CASE;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- The original guards keep their INSERT and UPDATE rules; DELETE moves to the guard above.
-- Their unreachable DELETE branches are left in place (functions are never edited here).
CREATE OR REPLACE TRIGGER crm_payments_guard BEFORE INSERT OR UPDATE ON crm_payments
    FOR EACH ROW EXECUTE FUNCTION crm_finance_entry_guard();
CREATE OR REPLACE TRIGGER crm_expenses_guard BEFORE INSERT OR UPDATE ON crm_expenses
    FOR EACH ROW EXECUTE FUNCTION crm_finance_entry_guard();
CREATE OR REPLACE TRIGGER crm_deals_guard BEFORE INSERT OR UPDATE ON crm_deals
    FOR EACH ROW EXECUTE FUNCTION crm_deal_guard();
CREATE OR REPLACE TRIGGER crm_deal_snapshots_guard BEFORE UPDATE ON crm_deal_snapshots
    FOR EACH ROW EXECUTE FUNCTION crm_deal_snapshot_guard();
CREATE OR REPLACE TRIGGER crm_deal_lines_guard BEFORE INSERT OR UPDATE
    ON crm_deal_commission_lines FOR EACH ROW EXECUTE FUNCTION crm_deal_line_guard();
CREATE OR REPLACE TRIGGER crm_agreements_guard BEFORE INSERT OR UPDATE
    ON crm_commission_agreements FOR EACH ROW EXECUTE FUNCTION crm_agreement_guard();

CREATE OR REPLACE TRIGGER crm_payments_delete_guard BEFORE DELETE ON crm_payments
    FOR EACH ROW EXECUTE FUNCTION crm_finance_delete_guard();
CREATE OR REPLACE TRIGGER crm_expenses_delete_guard BEFORE DELETE ON crm_expenses
    FOR EACH ROW EXECUTE FUNCTION crm_finance_delete_guard();
CREATE OR REPLACE TRIGGER crm_deals_delete_guard BEFORE DELETE ON crm_deals
    FOR EACH ROW EXECUTE FUNCTION crm_finance_delete_guard();
CREATE OR REPLACE TRIGGER crm_deal_snapshots_delete_guard BEFORE DELETE ON crm_deal_snapshots
    FOR EACH ROW EXECUTE FUNCTION crm_finance_delete_guard();
CREATE OR REPLACE TRIGGER crm_deal_lines_delete_guard BEFORE DELETE
    ON crm_deal_commission_lines FOR EACH ROW EXECUTE FUNCTION crm_finance_delete_guard();
CREATE OR REPLACE TRIGGER crm_agreements_delete_guard BEFORE DELETE
    ON crm_commission_agreements FOR EACH ROW EXECUTE FUNCTION crm_finance_delete_guard();
