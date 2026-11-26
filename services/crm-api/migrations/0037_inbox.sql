-- Owner module: inbox (services/crm-api/src/inbox, docs/messaging-design.md §3, §4 and §6,
-- packet X3). Conversations hold IDs and a display address; message text exists only in
-- crm_inbox_messages and internal notes only in crm_inbox_notes. No foreign keys into CRM
-- or integrations tables (boundary rule 9): linked records and connections are stored IDs.

CREATE SCHEMA IF NOT EXISTS inbox;

CREATE TABLE inbox.crm_inbox_conversations (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'facebook', 'instagram', 'tiktok')),
    connection_id uuid NOT NULL,
    external_thread_id text NOT NULL CHECK (char_length(external_thread_id) BETWEEN 1 AND 200),
    contact_key text NOT NULL CHECK (char_length(contact_key) BETWEEN 1 AND 320),
    contact_display text NOT NULL CHECK (char_length(contact_display) BETWEEN 1 AND 320),
    contact_name text CHECK (contact_name IS NULL OR char_length(contact_name) <= 120),
    match_state text NOT NULL CHECK (match_state IN ('unknown', 'linked', 'choice')),
    linked_collection text CHECK (linked_collection IS NULL OR linked_collection IN ('Clients', 'Contacts')),
    linked_record_id uuid,
    assignee_id uuid,
    state text NOT NULL CHECK (state IN ('new', 'open', 'waiting', 'resolved', 'spam')),
    suggested_lead boolean NOT NULL DEFAULT false,
    first_source text CHECK (first_source IS NULL OR first_source IN ('ad', 'listing', 'form', 'portal')),
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((linked_collection IS NULL) = (linked_record_id IS NULL)),
    CHECK ((match_state = 'linked') = (linked_record_id IS NOT NULL))
);

CREATE UNIQUE INDEX crm_inbox_conversations_thread
    ON inbox.crm_inbox_conversations (connection_id, external_thread_id);
CREATE INDEX crm_inbox_conversations_feed
    ON inbox.crm_inbox_conversations (workspace_id, last_activity_at DESC, id DESC);
CREATE INDEX crm_inbox_conversations_assignee
    ON inbox.crm_inbox_conversations (workspace_id, assignee_id);

CREATE TABLE inbox.crm_inbox_messages (
    id uuid PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES inbox.crm_inbox_conversations (id) ON DELETE CASCADE,
    workspace_id text NOT NULL,
    direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    provider_message_id text CHECK (provider_message_id IS NULL OR char_length(provider_message_id) BETWEEN 1 AND 200),
    status text NOT NULL CHECK (
        status IN ('received', 'draft', 'queued', 'sent', 'delivered', 'read', 'failed', 'unknown')
    ),
    author_user_id uuid,
    body text NOT NULL CHECK (char_length(body) <= 20000),
    has_media boolean NOT NULL DEFAULT false,
    failure_reason text CHECK (failure_reason IS NULL OR failure_reason ~ '^[a-z_]{1,40}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((direction = 'outbound') = (author_user_id IS NOT NULL))
);

CREATE UNIQUE INDEX crm_inbox_messages_provider
    ON inbox.crm_inbox_messages (conversation_id, provider_message_id)
    WHERE provider_message_id IS NOT NULL;
CREATE INDEX crm_inbox_messages_thread
    ON inbox.crm_inbox_messages (conversation_id, created_at, id);

CREATE TABLE inbox.crm_inbox_notes (
    id uuid PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES inbox.crm_inbox_conversations (id) ON DELETE CASCADE,
    workspace_id text NOT NULL,
    author_user_id uuid NOT NULL,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_inbox_notes_thread ON inbox.crm_inbox_notes (conversation_id, created_at);

CREATE TABLE inbox.crm_inbox_reads (
    conversation_id uuid NOT NULL REFERENCES inbox.crm_inbox_conversations (id) ON DELETE CASCADE,
    member_id uuid NOT NULL,
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, member_id)
);

CREATE TABLE inbox.crm_inbox_blocks (
    workspace_id text NOT NULL,
    channel text NOT NULL,
    contact_key text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, channel, contact_key)
);

-- One row per company once an Admin edits the rules; absent means the defaults.
CREATE TABLE inbox.crm_inbox_rules (
    workspace_id text PRIMARY KEY,
    lead_mode text NOT NULL CHECK (lead_mode IN ('suggest', 'create')),
    auto_sources text[] NOT NULL,
    words_en text[] NOT NULL,
    words_ar text[] NOT NULL,
    version bigint NOT NULL CHECK (version > 0),
    updated_by uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inbox.crm_inbox_events (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    conversation_id uuid NOT NULL,
    actor_id uuid,
    action text NOT NULL CHECK (action IN (
        'created', 'matched', 'assigned', 'state_changed', 'lead_created', 'lead_suggested',
        'linked', 'blocked', 'unblocked', 'send_failed'
    )),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_inbox_events_feed ON inbox.crm_inbox_events (workspace_id, created_at DESC);

CREATE FUNCTION inbox.crm_inbox_events_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Inbox events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_inbox_events_immutable
    BEFORE UPDATE OR DELETE ON inbox.crm_inbox_events
    FOR EACH ROW EXECUTE FUNCTION inbox.crm_inbox_events_immutable();
