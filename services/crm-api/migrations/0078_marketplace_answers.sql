-- Owners: marketplace and agreements. Answers reference shares through owner APIs.
ALTER TABLE marketplace.crm_market_requests ADD COLUMN paused_at timestamptz;
ALTER TABLE marketplace.crm_market_requests ADD COLUMN selected_answer_id uuid;
ALTER TABLE agreements.crm_listing_shares ADD COLUMN origin text NOT NULL DEFAULT 'direct'
    CHECK (origin IN ('direct','marketplace'));
CREATE TABLE marketplace.crm_market_answers (
    id uuid PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES marketplace.crm_market_requests(id),
    workspace_id text NOT NULL,
    member_id uuid NOT NULL,
    source_record_id uuid NOT NULL,
    share_id uuid NOT NULL UNIQUE,
    slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
    state text NOT NULL DEFAULT 'waiting'
        CHECK (state IN ('waiting','chosen','not_chosen','not_a_match','ended')),
    checklist jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz,
    UNIQUE(request_id,workspace_id,source_record_id)
);
CREATE UNIQUE INDEX crm_market_answers_active_slot
    ON marketplace.crm_market_answers(request_id,slot) WHERE state IN ('waiting','chosen');
CREATE UNIQUE INDEX crm_market_answers_active_member
    ON marketplace.crm_market_answers(request_id,member_id) WHERE state IN ('waiting','chosen');
CREATE INDEX crm_market_answers_member ON marketplace.crm_market_answers(member_id,created_at);
