-- Owner module: agreements (docs/record-sharing.md R2 and docs/sharing-guest-design-review.md).
-- Packet R2a: a listing shared with one named agent at another company. The sender's listing
-- is frozen into an insert-only snapshot; the share is view only, ends on a chosen day and is
-- kept as proof of introduction. No foreign keys into crm_records (decision D6): the
-- sender's record ID stays on sender-side columns and never reaches the other company.

CREATE TABLE agreements.crm_listing_snapshots (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    source_record_id uuid NOT NULL,
    reference text NOT NULL UNIQUE CHECK (reference ~ '^LS-[A-Z0-9]{8}$'),
    facts jsonb NOT NULL CHECK (jsonb_typeof(facts) = 'object'
        AND octet_length(facts::text) <= 32768),
    media jsonb NOT NULL CHECK (jsonb_typeof(media) = 'array' AND jsonb_array_length(media) <= 50),
    exact_location boolean NOT NULL,
    location_digest text CHECK (location_digest ~ '^[a-f0-9]{64}$'),
    location_salt text CHECK (location_salt ~ '^[a-f0-9]{32}$'),
    digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
    scheme smallint NOT NULL CHECK (scheme = 1),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, source_record_id, digest),
    UNIQUE (id, workspace_id, source_record_id),
    CHECK ((location_digest IS NULL) = exact_location AND (location_salt IS NULL) = exact_location)
);

CREATE TABLE agreements.crm_listing_shares (
    id uuid PRIMARY KEY,
    snapshot_id uuid NOT NULL,
    workspace_id text NOT NULL,
    source_record_id uuid NOT NULL,
    from_id uuid NOT NULL,
    recipient_workspace_id text NOT NULL,
    to_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn',
        'stopped', 'ended', 'expired')),
    end_reason text CHECK (end_reason IN ('holder_changed', 'listing_closed', 'listing_removed',
        'member_left', 'company_closed', 'end_date')),
    note text CHECK (char_length(note) BETWEEN 1 AND 500),
    decline_known boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    offer_ends_at timestamptz NOT NULL,
    view_ends_at timestamptz NOT NULL,
    opened_at timestamptz,
    decided_at timestamptz,
    closed_at timestamptz,
    closed_by uuid,
    accepted_digest text CHECK (accepted_digest ~ '^[a-f0-9]{64}$'),
    FOREIGN KEY (snapshot_id, workspace_id, source_record_id)
        REFERENCES agreements.crm_listing_snapshots (id, workspace_id, source_record_id),
    CHECK (workspace_id <> recipient_workspace_id),
    CHECK (from_id <> to_id),
    CHECK (offer_ends_at = created_at + interval '336 hours'),
    CHECK (view_ends_at > created_at),
    CHECK ((end_reason IS NOT NULL) = (status = 'ended')),
    CHECK ((closed_at IS NULL) = (status IN ('pending', 'accepted'))),
    CHECK (closed_by IS NULL OR closed_at IS NOT NULL),
    CHECK (status NOT IN ('accepted', 'stopped') OR accepted_digest IS NOT NULL),
    CHECK (status NOT IN ('pending', 'declined', 'withdrawn', 'expired') OR accepted_digest IS NULL),
    CHECK (NOT decline_known OR status = 'declined'),
    CHECK ((decided_at IS NOT NULL) = (accepted_digest IS NOT NULL OR status = 'declined'))
);

CREATE UNIQUE INDEX crm_listing_shares_open ON agreements.crm_listing_shares
    (workspace_id, source_record_id, to_id) WHERE status IN ('pending', 'accepted');
CREATE INDEX crm_listing_shares_record ON agreements.crm_listing_shares
    (workspace_id, source_record_id);
CREATE INDEX crm_listing_shares_from ON agreements.crm_listing_shares (workspace_id, from_id, created_at);
CREATE INDEX crm_listing_shares_to ON agreements.crm_listing_shares
    (recipient_workspace_id, to_id, status);

CREATE TABLE agreements.crm_listing_share_events (
    id uuid PRIMARY KEY,
    share_id uuid NOT NULL REFERENCES agreements.crm_listing_shares (id),
    action text NOT NULL CHECK (action IN ('sent', 'opened', 'accepted', 'declined', 'withdrawn',
        'stopped', 'extended', 'expired', 'ended')),
    actor_id uuid,
    side text CHECK (side IN ('sender', 'recipient')),
    reason text CHECK (char_length(reason) BETWEEN 1 AND 40),
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK ((actor_id IS NULL) = (side IS NULL)),
    CHECK ((action = 'extended') = (ends_at IS NOT NULL))
);

CREATE UNIQUE INDEX crm_listing_share_events_once ON agreements.crm_listing_share_events
    (share_id, action) WHERE action IN ('sent', 'opened', 'accepted');
CREATE INDEX crm_listing_share_events_feed ON agreements.crm_listing_share_events
    (share_id, created_at);

-- Snapshots and events are evidence: never changed, and deleted only by the future
-- five-year retention job (which will bring its own reviewed path).
CREATE FUNCTION agreements.crm_listing_evidence_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Listing share evidence is insert-only' USING ERRCODE = 'P0R02';
END;
$$;

CREATE TRIGGER crm_listing_snapshots_frozen BEFORE UPDATE OR DELETE
    ON agreements.crm_listing_snapshots
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_listing_evidence_frozen();
CREATE TRIGGER crm_listing_share_events_frozen BEFORE UPDATE OR DELETE
    ON agreements.crm_listing_share_events
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_listing_evidence_frozen();
CREATE TRIGGER crm_listing_snapshots_no_truncate BEFORE TRUNCATE
    ON agreements.crm_listing_snapshots
    FOR EACH STATEMENT EXECUTE FUNCTION agreements.crm_listing_evidence_frozen();
CREATE TRIGGER crm_listing_share_events_no_truncate BEFORE TRUNCATE
    ON agreements.crm_listing_share_events
    FOR EACH STATEMENT EXECUTE FUNCTION agreements.crm_listing_evidence_frozen();
