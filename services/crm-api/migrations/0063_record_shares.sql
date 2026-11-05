-- Owner module: records (docs/record-sharing.md R1 and its security review amendments
-- 6, 8 and 9). The holder of a client, property or contact, or the Admin, shares it with a
-- colleague; accepting gives a view-only keep (`colleague`) tied to the share. A share ends
-- when the record changes holder, and its keep goes with it in the same statement.

ALTER TABLE crm_records ADD CONSTRAINT crm_records_share_target UNIQUE (id, workspace_id, collection);

CREATE TABLE crm_record_shares (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    record_id uuid NOT NULL,
    collection text NOT NULL CHECK (collection IN ('Clients', 'Properties', 'Contacts')),
    from_id uuid NOT NULL REFERENCES crm_users(id),
    to_id uuid NOT NULL REFERENCES crm_users(id),
    status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn',
        'stopped', 'ended', 'expired')),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    decided_at timestamptz,
    closed_at timestamptz,
    closed_by uuid REFERENCES crm_users(id),
    FOREIGN KEY (record_id, workspace_id, collection)
        REFERENCES crm_records (id, workspace_id, collection) ON DELETE CASCADE,
    UNIQUE (id, record_id, to_id, from_id),
    CHECK (from_id <> to_id),
    CHECK (expires_at = created_at + interval '336 hours'),
    CHECK ((closed_at IS NULL) = (status IN ('pending', 'accepted'))),
    CHECK (closed_by IS NULL OR closed_at IS NOT NULL)
);

CREATE UNIQUE INDEX crm_record_shares_open ON crm_record_shares (record_id, to_id)
    WHERE status IN ('pending', 'accepted');
CREATE INDEX crm_record_shares_to ON crm_record_shares (workspace_id, to_id, status);
CREATE INDEX crm_record_shares_from ON crm_record_shares (workspace_id, from_id);

-- A colleague keep belongs to its share; hand-over keeps keep their deal facts.
ALTER TABLE crm_record_keeps
    DROP CONSTRAINT crm_record_keeps_reason_check,
    ADD CONSTRAINT crm_record_keeps_reason_check
        CHECK (reason IN ('handed_over', 'shared', 'colleague')),
    ALTER COLUMN deal_ref DROP NOT NULL,
    ALTER COLUMN kind DROP NOT NULL,
    ADD COLUMN share_id uuid UNIQUE,
    ADD CONSTRAINT crm_record_keeps_share_fkey FOREIGN KEY (share_id, record_id, member_id,
        other_id) REFERENCES crm_record_shares (id, record_id, to_id, from_id)
        ON DELETE CASCADE,
    ADD CONSTRAINT crm_record_keeps_colleague_check
        CHECK ((reason = 'colleague') = (share_id IS NOT NULL)
            AND (reason <> 'colleague'
                OR (deal_ref IS NULL AND kind IS NULL AND referral_share_bp IS NULL))
            AND (reason = 'colleague' OR (deal_ref IS NOT NULL AND kind IS NOT NULL)));

-- Shares are decided once: identity is frozen; pending → accepted, declined, withdrawn,
-- expired or ended; accepted → stopped or ended. Leaving `accepted` deletes its keep. New
-- shares are pending, between members of the workspace (a backstop for the Rust checks).
-- Rows go only with their record (the cascade).
CREATE FUNCTION crm_record_share_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending' OR NEW.closed_at IS NOT NULL OR NEW.decided_at IS NOT NULL
            OR (SELECT count(*) FROM crm_user_profiles p WHERE p.workspace_id = NEW.workspace_id
                AND p.id IN (NEW.from_id, NEW.to_id) AND p.active AND p.owner_active) <> 2 THEN
            RAISE EXCEPTION 'A share starts pending between members' USING ERRCODE = 'P0R01';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        -- A foreign-key cascade invokes this trigger below PostgreSQL's parent-delete
        -- trigger. A direct delete enters at depth one and remains forbidden.
        IF pg_trigger_depth() = 1
            OR EXISTS (SELECT 1 FROM crm_records r WHERE r.id = OLD.record_id) THEN
            RAISE EXCEPTION 'Shares are kept as history' USING ERRCODE = 'P0R01';
        END IF;
        RETURN OLD;
    END IF;
    IF (NEW.id, NEW.workspace_id, NEW.record_id, NEW.collection, NEW.from_id, NEW.to_id,
        NEW.created_at, NEW.expires_at) IS DISTINCT FROM (OLD.id, OLD.workspace_id,
        OLD.record_id, OLD.collection, OLD.from_id, OLD.to_id, OLD.created_at, OLD.expires_at)
        OR NOT ((OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined', 'withdrawn',
                'expired', 'ended'))
            OR (OLD.status = 'accepted' AND NEW.status IN ('stopped', 'ended'))) THEN
        RAISE EXCEPTION 'Shares are decided once' USING ERRCODE = 'P0R01';
    END IF;
    IF OLD.status = 'accepted' THEN
        DELETE FROM crm_record_keeps WHERE share_id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_record_shares_guard
    BEFORE INSERT OR UPDATE OR DELETE ON crm_record_shares
    FOR EACH ROW EXECUTE FUNCTION crm_record_share_guard();

-- Owner decision 6: every open share of a record ends when the record changes holder,
-- including to the queue; the hand-over keeps of H3 are untouched.
CREATE FUNCTION crm_record_shares_on_holder() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE crm_record_shares SET status = 'ended', closed_at = now(), closed_by = NULL
        WHERE record_id = NEW.id AND status IN ('pending', 'accepted');
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_records_shares_on_holder
    AFTER UPDATE OF assignee_id ON crm_records
    FOR EACH ROW
    WHEN (NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
    EXECUTE FUNCTION crm_record_shares_on_holder();
