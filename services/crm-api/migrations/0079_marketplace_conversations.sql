-- Owner: marketplace. Private broker conversations and generic lifecycle notices.
ALTER TABLE marketplace.crm_market_events DROP CONSTRAINT crm_market_events_action_check;
ALTER TABLE marketplace.crm_market_events ADD CONSTRAINT crm_market_events_action_check
    CHECK (action IN ('applied','approved','declined','revoked','switched_on','switched_off',
        'joined','left','terms_accepted','profile_updated','photo_changed','request_posted',
        'request_edited','request_renewed','request_closed','answer_sent','answer_rejected',
        'request_selected','request_reopened','conversation_started','message_posted'));
CREATE TABLE marketplace.crm_market_conversations (
    id uuid PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES marketplace.crm_market_requests(id),
    broker_id uuid NOT NULL,
    broker_workspace text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(request_id, broker_id)
);
CREATE TABLE marketplace.crm_market_messages (
    id uuid PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES marketplace.crm_market_conversations(id),
    author_id uuid NOT NULL,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_market_messages_thread ON marketplace.crm_market_messages
    (conversation_id, created_at, id);
CREATE TABLE marketplace.crm_market_notices (
    id uuid PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES marketplace.crm_market_requests(id),
    member_id uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN ('selected_other', 'reopened')),
    request_version bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(request_id, member_id, kind, request_version)
);
CREATE INDEX crm_market_notices_member ON marketplace.crm_market_notices(member_id,created_at);
