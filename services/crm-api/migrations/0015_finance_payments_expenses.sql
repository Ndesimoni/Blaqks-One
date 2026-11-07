-- Payments and expenses (docs/finance-design.md §2.2, §4, §13): pending -> approved | rejected,
-- rejected -> pending, approved -> void (Admin path). Only approved rows count. Never edit after
-- release. SQLSTATEs (finance/errors.rs): P0F09 locked, P0F10 identity or deal fixed, P0F11
-- separation of duties, P0F12 future date, P0F13 invalid transition, P0F14 above the net.
CREATE TABLE IF NOT EXISTS crm_payments (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    legacy_id TEXT NOT NULL CHECK (length(legacy_id) BETWEEN 1 AND 128),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    deal_ref TEXT NOT NULL, -- immutable after create (M-F4); see the guard below
    receipt_date DATE NOT NULL,
    amount_fils BIGINT NOT NULL CHECK (amount_fils BETWEEN 1 AND 1000000000000), -- ex VAT
    vat_fils BIGINT NOT NULL CHECK (vat_fils >= 0), -- server computed
    reference TEXT CHECK (length(reference) BETWEEN 1 AND 200),
    notes TEXT CHECK (length(notes) BETWEEN 1 AND 4000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'void')),
    submitted_by UUID NOT NULL REFERENCES crm_users(id),
    last_edited_by UUID NOT NULL REFERENCES crm_users(id),
    decided_by UUID REFERENCES crm_users(id),
    decided_at TIMESTAMPTZ,
    decision_reason TEXT CHECK (length(btrim(decision_reason)) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_payments_decision CHECK ((status = 'pending') = (decided_by IS NULL)
        AND (decided_by IS NULL) = (decided_at IS NULL)
        AND (status IN ('rejected', 'void')) = (decision_reason IS NOT NULL)),
    UNIQUE (workspace_id, legacy_id),
    CONSTRAINT crm_payments_deal_link FOREIGN KEY (workspace_id, deal_ref)
        REFERENCES crm_deals(workspace_id, legacy_id)
);
CREATE INDEX IF NOT EXISTS crm_payments_deals ON crm_payments(workspace_id, deal_ref);
CREATE INDEX IF NOT EXISTS crm_payments_pending ON crm_payments(workspace_id)
    WHERE status = 'pending';

-- Expenses belong to whoever incurred them (owner Q6) and never reduce commissions in v1.
-- property_ref is listed in finance/references.rs (Property deletes need team finance).
CREATE TABLE IF NOT EXISTS crm_expenses (
    id UUID PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    legacy_id TEXT NOT NULL CHECK (length(legacy_id) BETWEEN 1 AND 128),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    incurred_by UUID NOT NULL REFERENCES crm_users(id), -- owner of the expense (visibility)
    date_paid DATE NOT NULL,
    category TEXT CHECK (length(category) BETWEEN 1 AND 100),
    supplier TEXT CHECK (length(supplier) BETWEEN 1 AND 200),
    campaign_reference TEXT CHECK (length(campaign_reference) BETWEEN 1 AND 200),
    property_ref TEXT,
    property_collection TEXT NOT NULL DEFAULT 'Properties'
        CHECK (property_collection = 'Properties'),
    amount_fils BIGINT NOT NULL CHECK (amount_fils BETWEEN 1 AND 1000000000000), -- as paid
    -- L-F5: https only, never fetched and never copied into events or activity.
    receipt_url TEXT CHECK (length(receipt_url) <= 2048 AND receipt_url ~ '^https://[^\s]+$'),
    notes TEXT CHECK (length(notes) BETWEEN 1 AND 4000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'void')),
    submitted_by UUID NOT NULL REFERENCES crm_users(id),
    last_edited_by UUID NOT NULL REFERENCES crm_users(id),
    decided_by UUID REFERENCES crm_users(id),
    decided_at TIMESTAMPTZ,
    decision_reason TEXT CHECK (length(btrim(decision_reason)) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_expenses_decision CHECK ((status = 'pending') = (decided_by IS NULL)
        AND (decided_by IS NULL) = (decided_at IS NULL)
        AND (status IN ('rejected', 'void')) = (decision_reason IS NOT NULL)),
    UNIQUE (workspace_id, legacy_id),
    CONSTRAINT crm_expenses_property_link
        FOREIGN KEY (workspace_id, property_collection, property_ref)
        REFERENCES crm_records(workspace_id, collection, legacy_id)
);
CREATE INDEX IF NOT EXISTS crm_expenses_members ON crm_expenses(workspace_id, incurred_by);
CREATE INDEX IF NOT EXISTS crm_expenses_properties ON crm_expenses(workspace_id, property_ref)
    WHERE property_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_expenses_pending ON crm_expenses(workspace_id)
    WHERE status = 'pending';

CREATE OR REPLACE FUNCTION crm_finance_entry_guard() RETURNS trigger AS $$
DECLARE
    admin_path BOOLEAN := COALESCE(current_setting('kws.finance_admin', true), '') = 'on';
    fresh JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    stale JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    day DATE := COALESCE(fresh->>'receipt_date', fresh->>'date_paid')::date;
    net BIGINT;
    others BIGINT;
BEGIN
    IF TG_OP = 'DELETE' THEN -- no deletes (B6 sample clearing adds a guarded exception)
        RAISE EXCEPTION 'Payments and expenses cannot be deleted' USING ERRCODE = 'P0F09';
    ELSIF TG_OP = 'UPDATE' THEN
        IF (NEW.id, NEW.workspace_id, NEW.legacy_id, NEW.submitted_by, NEW.created_at,
            fresh->'deal_ref') IS DISTINCT FROM (OLD.id, OLD.workspace_id, OLD.legacy_id,
            OLD.submitted_by, OLD.created_at, stale->'deal_ref') THEN
            RAISE EXCEPTION 'Entry identity and deal cannot change' USING ERRCODE = 'P0F10';
        END IF;
        -- M-F7: approved rows change only on the Admin path; void is terminal.
        IF OLD.status = 'void' OR (OLD.status = 'approved' AND NOT admin_path) THEN
            RAISE EXCEPTION 'Approved finance records are locked' USING ERRCODE = 'P0F09';
        END IF;
        IF NOT ((OLD.status = 'pending' AND NEW.status IN ('pending', 'approved', 'rejected'))
            OR (OLD.status = 'rejected' AND NEW.status = 'pending')
            OR (OLD.status = 'approved' AND NEW.status IN ('approved', 'void'))) THEN
            RAISE EXCEPTION 'Invalid finance status change' USING ERRCODE = 'P0F13';
        END IF;
    ELSIF NEW.status <> 'pending' THEN -- one guard for both tables; kind columns via jsonb
        RAISE EXCEPTION 'Finance records start pending' USING ERRCODE = 'P0F13';
    END IF;
    -- M-F6: staff never approve rows they submitted, last edited or incurred.
    IF NEW.status = 'approved' AND (stale->>'status') IS DISTINCT FROM 'approved'
        AND NEW.decided_by IN (NEW.submitted_by, NEW.last_edited_by, (fresh->>'incurred_by')::uuid)
        AND NOT EXISTS (SELECT 1 FROM crm_user_profiles u WHERE u.id = NEW.decided_by
            AND u.role = 'admin' AND u.workspace_id = NEW.workspace_id) THEN
        RAISE EXCEPTION 'Another approver must decide' USING ERRCODE = 'P0F11';
    END IF;
    -- L-F3: receipt and payment dates are not in the future (Asia/Dubai).
    IF day > (now() AT TIME ZONE 'Asia/Dubai')::date
        AND day IS DISTINCT FROM COALESCE(stale->>'receipt_date', stale->>'date_paid')::date THEN
        RAISE EXCEPTION 'Finance dates cannot be in the future' USING ERRCODE = 'P0F12';
    END IF;
    -- L-F1: the expense owner is an active member of this workspace when written.
    IF TG_TABLE_NAME = 'crm_expenses' AND fresh->>'incurred_by' IS DISTINCT FROM
        stale->>'incurred_by' AND NOT EXISTS (SELECT 1 FROM crm_user_profiles p
            WHERE p.id = (fresh->>'incurred_by')::uuid AND p.workspace_id = NEW.workspace_id
            AND p.role IN ('staff', 'admin') AND p.active AND p.owner_active) THEN
        RAISE EXCEPTION 'Expense owner is not an active member' USING ERRCODE = 'P0F04';
    END IF;
    -- M-F4 (defence in depth): approved payments stay within the current snapshot's net.
    IF TG_TABLE_NAME = 'crm_payments' AND NEW.status = 'approved' THEN
        SELECT s.net_fils, (SELECT COALESCE(sum(p.amount_fils), 0) FROM crm_payments p
            WHERE p.workspace_id = d.workspace_id AND p.deal_ref = d.legacy_id
            AND p.status = 'approved' AND p.id <> NEW.id) INTO net, others FROM crm_deals d
            JOIN crm_deal_snapshots s ON s.deal_id = d.id AND s.superseded_at IS NULL
            WHERE d.workspace_id = NEW.workspace_id AND d.legacy_id = fresh->>'deal_ref';
        IF net IS NULL OR others + NEW.amount_fils > net THEN
            RAISE EXCEPTION 'Approved payments exceed the deal net' USING ERRCODE = 'P0F14';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER crm_payments_guard BEFORE INSERT OR UPDATE OR DELETE ON crm_payments
    FOR EACH ROW EXECUTE FUNCTION crm_finance_entry_guard();
CREATE OR REPLACE TRIGGER crm_expenses_guard BEFORE INSERT OR UPDATE OR DELETE ON crm_expenses
    FOR EACH ROW EXECUTE FUNCTION crm_finance_entry_guard();

-- §13 M-F4: replaces the 0013 placeholder with the sum of the deal's approved payments.
CREATE OR REPLACE FUNCTION crm_deal_approved_fils(deal UUID) RETURNS BIGINT AS $$
    SELECT COALESCE(sum(p.amount_fils), 0)::bigint FROM crm_payments p
    JOIN crm_deals d ON d.workspace_id = p.workspace_id AND d.legacy_id = p.deal_ref
    WHERE d.id = deal AND p.status = 'approved'
$$ LANGUAGE sql STABLE;
