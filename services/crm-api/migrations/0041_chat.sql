-- Owner module: chat (services/crm-api/src/chat, docs/team-chat.md). Packet C1: team chat
-- inside one company. Channels are open to every live member of the company and only the
-- Admin creates them (owner decision 2026-10-21); #general exists for every company. Direct
-- conversations are private to their two members — the Admin cannot read them (owner
-- decision 2026-10-21) and the Super Admin reads no company chat. Message bodies live only
-- here, never in activity. No foreign keys into CRM tables (boundary rule 9).

CREATE SCHEMA IF NOT EXISTS chat;

CREATE TABLE chat.crm_chat_rooms (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('channel', 'direct')),
    -- Channels: lower-case letters, digits and hyphens.
    name text CHECK (name IS NULL OR name ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
    -- Direct: the two member IDs in sorted order, joined by ':'.
    direct_key text CHECK (direct_key IS NULL OR char_length(direct_key) = 73),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_message_at timestamptz,
    CHECK ((kind = 'channel') = (name IS NOT NULL)),
    CHECK ((kind = 'direct') = (direct_key IS NOT NULL))
);

CREATE UNIQUE INDEX crm_chat_rooms_channel ON chat.crm_chat_rooms (workspace_id, name)
    WHERE kind = 'channel';
CREATE UNIQUE INDEX crm_chat_rooms_direct ON chat.crm_chat_rooms (workspace_id, direct_key)
    WHERE kind = 'direct';

-- The two members of a direct conversation; channels have no participant rows.
CREATE TABLE chat.crm_chat_participants (
    room_id uuid NOT NULL REFERENCES chat.crm_chat_rooms (id) ON DELETE CASCADE,
    member_id uuid NOT NULL,
    PRIMARY KEY (room_id, member_id)
);

CREATE INDEX crm_chat_participants_member ON chat.crm_chat_participants (member_id);

CREATE TABLE chat.crm_chat_messages (
    id uuid PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES chat.crm_chat_rooms (id) ON DELETE CASCADE,
    workspace_id text NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    edited_at timestamptz,
    deleted_at timestamptz,
    -- A deleted message keeps its place but loses its text.
    CHECK (
        (deleted_at IS NULL AND char_length(body) BETWEEN 1 AND 4000)
        OR (deleted_at IS NOT NULL AND body = '')
    )
);

CREATE INDEX crm_chat_messages_room ON chat.crm_chat_messages (room_id, created_at DESC, id);

CREATE TABLE chat.crm_chat_reads (
    room_id uuid NOT NULL REFERENCES chat.crm_chat_rooms (id) ON DELETE CASCADE,
    member_id uuid NOT NULL,
    read_at timestamptz NOT NULL,
    PRIMARY KEY (room_id, member_id)
);

-- Per-member send budget (security review C1 L1): recent messages by author.
CREATE INDEX crm_chat_messages_author ON chat.crm_chat_messages (author_id, created_at);
