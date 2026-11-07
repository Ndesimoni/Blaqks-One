-- Owner module: support (services/crm-api/src/support, docs/service-boundaries.md). BO1c help
-- requests (docs/blaqks-one-console.md §3 item 3 and §11): any company member asks Blaqks One
-- for help; only the requester and the Blaqks One team with Help requests read a request,
-- never the requester's company Admin. The company, people and assignee are plain IDs
-- without cross-domain foreign keys (service-boundaries rule 4). Never edit after release.
CREATE SCHEMA support;

CREATE TABLE support.crm_support_requests (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL CHECK (char_length(workspace_id) BETWEEN 1 AND 128),
    requester_id uuid NOT NULL,
    category text NOT NULL
        CHECK (category IN ('account', 'billing', 'problem', 'how_to', 'idea', 'other')),
    subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 160),
    -- open: waiting for Blaqks One; waiting: Blaqks One answered, waiting for the member.
    state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'waiting', 'solved')),
    -- The Blaqks One person looking after the request (the Owner or a platform member).
    assignee_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    first_answer_at timestamptz,
    solved_at timestamptz,
    -- When the requester last opened the thread; later Blaqks One replies are unread.
    requester_read_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE INDEX crm_support_requests_requester
    ON support.crm_support_requests (requester_id, updated_at DESC);
CREATE INDEX crm_support_requests_state ON support.crm_support_requests (state, updated_at DESC);

-- The thread: the member's and Blaqks One's messages, append-only.
CREATE TABLE support.crm_support_messages (
    id uuid PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES support.crm_support_requests (id),
    author_id uuid NOT NULL,
    side text NOT NULL CHECK (side IN ('member', 'platform')),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_support_messages_request ON support.crm_support_messages (request_id, created_at);

CREATE FUNCTION support.crm_support_messages_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Help request messages are append-only'; END; $$;
CREATE TRIGGER crm_support_messages_frozen BEFORE UPDATE OR DELETE
    ON support.crm_support_messages FOR EACH ROW
    EXECUTE FUNCTION support.crm_support_messages_frozen();
