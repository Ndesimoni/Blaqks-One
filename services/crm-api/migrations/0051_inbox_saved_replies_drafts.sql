-- Owner module: inbox (docs/saved-replies-drafts.md, packet N2). Saved replies are the
-- company's (owner_user_id NULL, kept by the Admin) or one member's own. A draft is one
-- unsent reply per member and conversation, seen only by its writer. Sending a reply
-- empties its writer's draft (body NULL) and moves `revision` on, so an autosave that was
-- already on its way can never bring the sent text back (security review H1).

CREATE TABLE inbox.crm_inbox_saved_replies (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    owner_user_id uuid,
    title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- One title per list, ignoring case: the company's, and each member's.
CREATE UNIQUE INDEX crm_inbox_saved_replies_title ON inbox.crm_inbox_saved_replies (
    workspace_id,
    coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(title)
);

CREATE TABLE inbox.crm_inbox_drafts (
    conversation_id uuid NOT NULL REFERENCES inbox.crm_inbox_conversations (id) ON DELETE CASCADE,
    member_id uuid NOT NULL,
    workspace_id text NOT NULL,
    body text CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 20000),
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, member_id)
);
