-- Owner module: marketplace (docs/broker-marketplace.md §3, §17; packet MK2).
-- A client request is what a client is looking for, never who they are: the frozen preferences
-- and the budget band leave the company, the source client stays on the poster's side. The
-- exact budget is stored for matching in MK3, the band is what the board shows.

CREATE TABLE marketplace.crm_market_requests (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    member_id uuid NOT NULL,
    purpose text NOT NULL CHECK (purpose IN ('buy', 'rent')),
    emirate text NOT NULL CHECK (emirate IN ('dubai', 'abu-dhabi', 'sharjah', 'ajman',
        'umm-al-quwain', 'ras-al-khaimah', 'fujairah')),
    communities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
        jsonb_typeof(communities) = 'array' AND jsonb_array_length(communities) <= 12
        AND octet_length(communities::text) <= 4096),
    open_to_other_areas boolean NOT NULL DEFAULT false,
    property_type text NOT NULL CHECK (char_length(property_type) BETWEEN 1 AND 60),
    bedrooms smallint CHECK (bedrooms BETWEEN 0 AND 20),
    budget_min_aed bigint CHECK (budget_min_aed >= 0),
    budget_max_aed bigint NOT NULL CHECK (budget_max_aed > 0),
    budget_band text NOT NULL CHECK (budget_band IN ('buy_1m', 'buy_2m', 'buy_3m', 'buy_5m',
        'buy_10m', 'buy_10m_plus', 'rent_50k', 'rent_100k', 'rent_150k', 'rent_250k',
        'rent_500k', 'rent_500k_plus')),
    ready text NOT NULL CHECK (ready IN ('ready', 'off_plan', 'any')),
    furnishing text NOT NULL CHECK (
        furnishing IN ('furnished', 'unfurnished', 'part_furnished', 'any')),
    cheques smallint CHECK (cheques IN (1, 2, 3, 4, 6, 12)),
    building_age text NOT NULL CHECK (
        building_age IN ('new', 'under_5', '5_to_10', 'over_10', 'any')),
    move_in text CHECK (move_in ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    client_consent_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    closed_at timestamptz,
    close_reason text CHECK (close_reason IN ('done', 'left', 'client_changed', 'expired')),
    round smallint NOT NULL DEFAULT 1 CHECK (round >= 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (budget_min_aed IS NULL OR budget_min_aed <= budget_max_aed),
    -- A cheque count belongs to a rental; a purchase has none.
    CHECK (cheques IS NULL OR purpose = 'rent'),
    -- A closed request always says why, and an open one never does.
    CHECK ((closed_at IS NULL) = (close_reason IS NULL))
);
CREATE INDEX crm_market_requests_member ON marketplace.crm_market_requests
    (workspace_id, member_id);
CREATE INDEX crm_market_requests_board ON marketplace.crm_market_requests
    (created_at DESC, id DESC) WHERE closed_at IS NULL;

-- The poster's side only: which client a request came from. No cross-company response reads
-- it, and records deletion is outright, so there is no foreign key into crm_records (D6).
CREATE TABLE marketplace.crm_market_request_sources (
    request_id uuid PRIMARY KEY
        REFERENCES marketplace.crm_market_requests (id),
    workspace_id text NOT NULL,
    source_record_id uuid NOT NULL,
    open boolean NOT NULL
);
-- One open request per client; `open` follows `closed_at` in the same transaction.
CREATE UNIQUE INDEX crm_market_request_sources_one_open
    ON marketplace.crm_market_request_sources (workspace_id, source_record_id) WHERE open;
CREATE INDEX crm_market_request_sources_client ON marketplace.crm_market_request_sources
    (workspace_id, source_record_id);

ALTER TABLE marketplace.crm_market_events
    DROP CONSTRAINT crm_market_events_action_check;
ALTER TABLE marketplace.crm_market_events ADD CONSTRAINT crm_market_events_action_check
    CHECK (action IN ('applied', 'approved', 'declined', 'revoked', 'switched_on',
        'switched_off', 'joined', 'left', 'terms_accepted', 'profile_updated',
        'photo_changed', 'request_posted', 'request_edited', 'request_renewed',
        'request_closed'));
