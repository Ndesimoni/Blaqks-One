-- Operator sample data (`seed-sample` / `clear-sample`, local development only).
-- These rows mark which records and accounts the seed created, keyed by the immutable
-- row UUID. `clear-sample` removes only marked records: records people created are
-- never touched, whatever their IDs or contents, and sample records people changed in
-- the app are removed only with `--include-edited`. Payloads carry no marker, so
-- clients cannot add, copy or remove one. Idempotent; never edit after release.
CREATE TABLE IF NOT EXISTS crm_sample_records (
    record_id UUID PRIMARY KEY REFERENCES crm_records(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_sample_records_workspace
    ON crm_sample_records(workspace_id);

-- Sample staff accounts. Accounts are never deleted (archive-only), so these rows stay;
-- `clear-sample` suspends the accounts and a later `seed-sample` reactivates them.
CREATE TABLE IF NOT EXISTS crm_sample_accounts (
    user_id UUID PRIMARY KEY REFERENCES crm_users(id),
    workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_sample_accounts_workspace
    ON crm_sample_accounts(workspace_id);

-- Where each append-only history row came from: 'app' (the API) or 'sample' (the
-- sample-data command, which still names the workspace owner as actor). Existing rows
-- get the constant 'app' without a rewrite; new rows read the transaction-local
-- `kws.activity_source` setting, which only the sample command sets. Reason and action
-- values are unchanged, so existing readers keep working.
DO $$
DECLARE
    history TEXT;
BEGIN
    FOREACH history IN ARRAY ARRAY['crm_activity', 'crm_team_activity', 'crm_assignments']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS source TEXT NOT NULL '
            'DEFAULT ''app''', history);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN source SET DEFAULT '
            'COALESCE(NULLIF(current_setting(''kws.activity_source'', true), ''''), ''app'')',
            history);
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = history || '_source_check')
        THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (source IN '
                '(''app'', ''sample''))', history, history || '_source_check');
        END IF;
    END LOOP;
END $$;
