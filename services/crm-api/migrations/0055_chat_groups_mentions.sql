-- Owner module: chat (services/crm-api/src/chat, docs/team-chat.md). Packet C3: private
-- group conversations and mentions.
--
-- A group is a room of kind 'group' whose participants (its creator and 2–20 colleagues of
-- the same company) alone may read and post: the Admin cannot open a group they are not
-- in, and the Super Admin reads no company chat. Participants are rows in
-- crm_chat_participants, as for direct conversations. A group may have a free-text title;
-- channels keep their lower-case `name`.
--
-- Mentions store the mentioned member IDs with the message (never parsed from the text).
-- A mention counts for its member until they read the room. No foreign keys into CRM
-- tables (boundary rule 9), and no message text leaves this schema.

ALTER TABLE chat.crm_chat_rooms DROP CONSTRAINT crm_chat_rooms_kind_check;
ALTER TABLE chat.crm_chat_rooms ADD CONSTRAINT crm_chat_rooms_kind
    CHECK (kind IN ('channel', 'direct', 'group'));

ALTER TABLE chat.crm_chat_rooms ADD COLUMN title text;
ALTER TABLE chat.crm_chat_rooms ADD CONSTRAINT crm_chat_rooms_title CHECK (
    title IS NULL OR (kind = 'group' AND char_length(title) BETWEEN 1 AND 60)
);

CREATE TABLE chat.crm_chat_mentions (
    message_id uuid NOT NULL REFERENCES chat.crm_chat_messages (id) ON DELETE CASCADE,
    room_id uuid NOT NULL REFERENCES chat.crm_chat_rooms (id) ON DELETE CASCADE,
    member_id uuid NOT NULL,
    PRIMARY KEY (message_id, member_id)
);

-- Unread mentions per member and room, for the room list and the sidebar badge.
CREATE INDEX crm_chat_mentions_member ON chat.crm_chat_mentions (member_id, room_id);
