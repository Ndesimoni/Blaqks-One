-- Owner module: inbox (services/crm-api/src/inbox, docs/whatsapp-design.md §3, §5, §18).
-- Packet W1b: WhatsApp sending. A WhatsApp thread belongs to one member's number row
-- (W-M3) and keeps when the client last wrote (the 24-hour window; set by intake in W2a).
-- A template message keeps its Twilio template and the variables the member typed, only
-- here, so Send again can repeat it. Consents are keyed by the canonical number, not a
-- record, so STOP from any thread stops every send to that number in the company. No
-- foreign key into integrations tables (boundary rule 9): the number row is a stored ID.

ALTER TABLE inbox.crm_inbox_conversations
    ADD COLUMN whatsapp_number_id uuid,
    ADD COLUMN last_inbound_at timestamptz,
    ADD CONSTRAINT crm_inbox_conversations_whatsapp_number
        CHECK (whatsapp_number_id IS NULL OR channel = 'whatsapp');

ALTER TABLE inbox.crm_inbox_messages
    ADD COLUMN template_sid text CHECK (template_sid IS NULL OR template_sid ~ '^HX[0-9a-f]{32}$'),
    ADD COLUMN template_variables text[] CHECK (
        template_variables IS NULL OR cardinality(template_variables) <= 10
    ),
    ADD CONSTRAINT crm_inbox_messages_template
        CHECK ((template_sid IS NULL) = (template_variables IS NULL));

-- Insert-only; the latest row per (workspace, channel, number) is the client's consent.
CREATE TABLE inbox.crm_inbox_consents (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    channel text NOT NULL CHECK (channel = 'whatsapp'),
    contact_key text NOT NULL CHECK (contact_key ~ '^\+[1-9][0-9]{7,14}$'),
    state text NOT NULL CHECK (state IN ('opt_in', 'opt_out')),
    source text NOT NULL CHECK (source IN (
        'client_first', 'phone', 'in_person', 'form', 'client_stop', 'client_start',
        'admin_restored', 'recorded_stop'
    )),
    reason text CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500),
    source_message_sid text CHECK (source_message_sid IS NULL OR source_message_sid ~ '^[SM]M[0-9a-f]{32}$'),
    recorded_by uuid,
    -- Where it was recorded, so the Admin can trace who stopped whom (W1b review L2): the
    -- record of a record's consent, or the conversation (stored IDs, no foreign keys).
    via_collection text CHECK (via_collection IS NULL OR via_collection IN ('Clients', 'Contacts')),
    via_record_id uuid,
    via_conversation_id uuid,
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK ((state = 'opt_out') = (source IN ('client_stop', 'recorded_stop'))),
    CHECK ((source = 'admin_restored') = (reason IS NOT NULL)),
    CHECK ((recorded_by IS NULL) = (source IN ('client_first', 'client_stop', 'client_start'))),
    CHECK ((via_collection IS NULL) = (via_record_id IS NULL)),
    CHECK ((via_record_id IS NULL) <> (via_conversation_id IS NULL))
);

CREATE INDEX crm_inbox_consents_latest
    ON inbox.crm_inbox_consents (workspace_id, channel, contact_key, recorded_at DESC, id DESC);

CREATE FUNCTION inbox.crm_inbox_consents_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Inbox consents are insert-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_inbox_consents_immutable
    BEFORE UPDATE OR DELETE ON inbox.crm_inbox_consents
    FOR EACH ROW EXECUTE FUNCTION inbox.crm_inbox_consents_immutable();

CREATE TRIGGER crm_inbox_consents_no_truncate
    BEFORE TRUNCATE ON inbox.crm_inbox_consents
    FOR EACH STATEMENT EXECUTE FUNCTION inbox.crm_inbox_consents_immutable();
