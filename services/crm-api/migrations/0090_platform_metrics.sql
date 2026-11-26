-- platform_metrics owns this schema (BO1d, docs/blaqks-one-console.md §3 item 4 and §3a).
-- The platform event log and the daily active users. Neither table stores names, record
-- IDs, text, addresses, emails, phone numbers or message content; workspace and user IDs
-- are plain values without cross-domain foreign keys (service-boundaries rule 4).
CREATE SCHEMA platform_metrics;

-- One row per meaningful action, written by the owning module inside its own transaction.
-- Usage events carry the company and the actor's role, never an amount. Money events carry
-- an amount in fils and never the company, so platform sums are possible but no company's
-- turnover can be rebuilt from this table.
CREATE TABLE platform_metrics.crm_platform_events (
    id bigserial PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    event text NOT NULL CHECK (event ~ '^[a-z][a-z0-9_]{0,59}$'),
    workspace_id text CHECK (char_length(workspace_id) BETWEEN 1 AND 128),
    actor_role text CHECK (actor_role ~ '^[a-z][a-z-]{0,29}$'),
    source text NOT NULL
        CHECK (source IN ('crm', 'company_site', 'general_site', 'marketplace', 'api')),
    amount_fils bigint CHECK (amount_fils >= 0),
    CONSTRAINT crm_platform_events_money_anonymous
        CHECK (amount_fils IS NULL OR (workspace_id IS NULL AND actor_role IS NULL))
);
CREATE INDEX crm_platform_events_event
    ON platform_metrics.crm_platform_events (event, occurred_at);
CREATE INDEX crm_platform_events_company
    ON platform_metrics.crm_platform_events (workspace_id, occurred_at)
    WHERE workspace_id IS NOT NULL;

-- The log is kept (at least five years, design §3a): rows are never changed or removed.
CREATE FUNCTION platform_metrics.crm_platform_events_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Platform events are immutable'; END; $$;
CREATE TRIGGER crm_platform_events_frozen BEFORE UPDATE OR DELETE
    ON platform_metrics.crm_platform_events FOR EACH ROW
    EXECUTE FUNCTION platform_metrics.crm_platform_events_frozen();

-- One row per person per Asia/Dubai calendar day on which they used a signed-in session.
-- History starts when this migration ships.
CREATE TABLE platform_metrics.crm_user_active_days (
    user_id uuid NOT NULL,
    workspace_id text NOT NULL,
    day date NOT NULL,
    PRIMARY KEY (user_id, day)
);
CREATE INDEX crm_user_active_days_day
    ON platform_metrics.crm_user_active_days (day, workspace_id);
