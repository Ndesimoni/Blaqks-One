-- Owner module: marketplace (docs/broker-marketplace.md §13–§15, packet MK1).
-- The broker marketplace begins with a company's eligibility, its application, the
-- platform's decision and the company switch. Applications, decisions, switch history and
-- events are evidence: they are inserted and read, never changed or deleted. The company's
-- current state is its latest decision, or `pending` when an application is newer.

CREATE SCHEMA marketplace;

CREATE TABLE marketplace.crm_market_applications (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    applied_by uuid NOT NULL,
    counts jsonb NOT NULL CHECK (jsonb_typeof(counts) = 'object'
        AND octet_length(counts::text) <= 4096),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_market_applications_company ON marketplace.crm_market_applications
    (workspace_id, created_at DESC);

CREATE TABLE marketplace.crm_market_decisions (
    id uuid PRIMARY KEY,
    application_id uuid REFERENCES marketplace.crm_market_applications (id),
    workspace_id text NOT NULL,
    decision text NOT NULL CHECK (decision IN ('approved', 'declined', 'revoked')),
    reason text CHECK (char_length(reason) BETWEEN 1 AND 500),
    decided_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- A decline or a revocation always says why; an approval may be silent.
    CHECK (decision = 'approved' OR reason IS NOT NULL),
    -- Revocation ends a company's access, so it needs no single application.
    CHECK (decision <> 'revoked' OR application_id IS NULL)
);
CREATE UNIQUE INDEX crm_market_decisions_once ON marketplace.crm_market_decisions
    (application_id) WHERE decision IN ('approved', 'declined');
CREATE INDEX crm_market_decisions_company ON marketplace.crm_market_decisions
    (workspace_id, created_at DESC);

-- On by default: no row means the company has not switched the marketplace off.
CREATE TABLE marketplace.crm_market_companies (
    workspace_id text PRIMARY KEY,
    enabled boolean NOT NULL,
    version bigint NOT NULL CHECK (version > 0),
    changed_by uuid NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE marketplace.crm_market_company_events (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    enabled boolean NOT NULL,
    changed_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_market_company_events_company ON marketplace.crm_market_company_events
    (workspace_id, created_at DESC);

-- Names the member and the action only; never a field value, address or message body.
CREATE TABLE marketplace.crm_market_events (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    actor_id uuid NOT NULL,
    member_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('applied', 'approved', 'declined', 'revoked',
        'switched_on', 'switched_off', 'joined', 'left', 'terms_accepted',
        'profile_updated', 'photo_changed')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_market_events_company ON marketplace.crm_market_events
    (workspace_id, created_at DESC);

CREATE FUNCTION marketplace.crm_market_evidence_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Marketplace evidence is insert-only' USING ERRCODE = 'P0M01';
END;
$$;

CREATE TRIGGER crm_market_applications_frozen BEFORE UPDATE OR DELETE
    ON marketplace.crm_market_applications
    FOR EACH ROW EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
CREATE TRIGGER crm_market_decisions_frozen BEFORE UPDATE OR DELETE
    ON marketplace.crm_market_decisions
    FOR EACH ROW EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
CREATE TRIGGER crm_market_company_events_frozen BEFORE UPDATE OR DELETE
    ON marketplace.crm_market_company_events
    FOR EACH ROW EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
CREATE TRIGGER crm_market_events_frozen BEFORE UPDATE OR DELETE
    ON marketplace.crm_market_events
    FOR EACH ROW EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
CREATE TRIGGER crm_market_applications_no_truncate BEFORE TRUNCATE
    ON marketplace.crm_market_applications
    FOR EACH STATEMENT EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
CREATE TRIGGER crm_market_decisions_no_truncate BEFORE TRUNCATE
    ON marketplace.crm_market_decisions
    FOR EACH STATEMENT EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
CREATE TRIGGER crm_market_company_events_no_truncate BEFORE TRUNCATE
    ON marketplace.crm_market_company_events
    FOR EACH STATEMENT EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
CREATE TRIGGER crm_market_events_no_truncate BEFORE TRUNCATE
    ON marketplace.crm_market_events
    FOR EACH STATEMENT EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
