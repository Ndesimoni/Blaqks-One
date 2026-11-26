-- Owner module: chat. Private-group membership additions (C3 follow-up).
-- The event table exists only to rate-limit access-expanding mutations. It is never
-- exposed through Team activity because doing so would reveal private group metadata.

CREATE TABLE chat.crm_chat_group_adds (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_chat_group_adds_actor
    ON chat.crm_chat_group_adds (workspace_id, actor_id, created_at);
