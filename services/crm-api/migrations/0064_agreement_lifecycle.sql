-- Agreements owns proposals, cancellation requests and per-company archives.
ALTER TABLE agreements.crm_agreements
    ADD COLUMN proposed_revision_id uuid REFERENCES agreements.crm_agreement_revisions(id),
    ADD COLUMN cancel_sender_revision_id uuid REFERENCES agreements.crm_agreement_revisions(id),
    ADD COLUMN cancel_recipient_revision_id uuid REFERENCES agreements.crm_agreement_revisions(id),
    ADD COLUMN sender_archived_at timestamptz,
    ADD COLUMN recipient_archived_at timestamptz;

CREATE OR REPLACE FUNCTION agreements.crm_agreement_version_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    first_revision boolean := OLD.current_revision_id IS NULL
        AND NEW.current_revision_id IS NOT NULL AND NEW.version = OLD.version
        AND NEW.state = OLD.state;
    promotion boolean := OLD.state = 'accepted' AND NEW.state = 'accepted'
        AND NEW.current_revision_id IS DISTINCT FROM OLD.current_revision_id;
BEGIN
    IF NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id
        OR NEW.recipient_workspace_id <> OLD.recipient_workspace_id
        OR NEW.kind <> OLD.kind OR NEW.created_by <> OLD.created_by
        OR NEW.origin <> OLD.origin OR NEW.created_at <> OLD.created_at THEN
        RAISE EXCEPTION 'agreement identity is fixed' USING ERRCODE = 'P0G04';
    END IF;
    IF NEW.version <> OLD.version + 1 AND NOT first_revision THEN
        RAISE EXCEPTION 'agreement changes advance one version' USING ERRCODE = 'P0G05';
    END IF;
    IF NOT first_revision AND NOT (
        (OLD.state = 'draft' AND NEW.state IN ('draft', 'sent'))
        OR (OLD.state = 'sent' AND NEW.state IN ('sent','accepted','declined','revoked'))
        OR (OLD.state = 'accepted' AND NEW.state IN ('accepted','completed','cancelled'))
        OR (OLD.state = 'completed' AND NEW.state = 'completed'
            AND NEW.current_revision_id = OLD.current_revision_id)
    ) THEN
        RAISE EXCEPTION 'invalid agreement state transition' USING ERRCODE = 'P0G06';
    END IF;
    IF OLD.state IN ('accepted','completed') AND NOT promotion
        AND NEW.current_revision_id IS DISTINCT FROM OLD.current_revision_id THEN
        RAISE EXCEPTION 'accepted terms are frozen' USING ERRCODE = 'P0G08';
    END IF;
    IF promotion AND (NEW.current_revision_id IS DISTINCT FROM OLD.proposed_revision_id
        OR NEW.proposed_revision_id IS NOT NULL OR NOT EXISTS (
            SELECT 1 FROM agreements.crm_agreement_revisions r
            JOIN agreements.crm_agreement_actions x ON x.revision_id=r.id
            JOIN agreements.crm_agreement_participants p ON p.agreement_id=r.agreement_id
                AND p.party=x.party AND p.member_id=x.actor_id
            WHERE r.id=NEW.current_revision_id AND r.agreement_id=NEW.id
                AND x.action='accepted' AND x.party<>r.author_party
                AND x.accepted_digest=r.digest
                AND (r.terms->>'expiresAt')::timestamptz>clock_timestamp())) THEN
        RAISE EXCEPTION 'promotion requires exact opposite-party acceptance' USING ERRCODE = 'P0G08';
    END IF;
    IF NEW.proposed_revision_id IS NOT NULL AND (NEW.state<>'accepted'
        OR NEW.origin<>'direct' OR NEW.workspace_id=NEW.recipient_workspace_id
        OR NOT EXISTS (SELECT 1 FROM agreements.crm_agreement_revisions r
            WHERE r.id=NEW.proposed_revision_id AND r.agreement_id=NEW.id
                AND r.id<>NEW.current_revision_id AND r.parent_id=NEW.current_revision_id
                AND r.author_party IN ('sender','recipient'))) THEN
        RAISE EXCEPTION 'invalid amendment proposal' USING ERRCODE = 'P0G08';
    END IF;
    IF NEW.proposed_revision_id IS DISTINCT FROM OLD.proposed_revision_id
        AND NEW.proposed_revision_id IS NOT NULL AND OLD.proposed_revision_id IS NOT NULL
        AND EXISTS(SELECT 1 FROM agreements.crm_agreement_revisions r
            WHERE r.id=OLD.proposed_revision_id
            AND (r.terms->>'expiresAt')::timestamptz>clock_timestamp()) THEN
        RAISE EXCEPTION 'an amendment is already open' USING ERRCODE = 'P0G08';
    END IF;
    IF (NEW.proposed_revision_id IS DISTINCT FROM OLD.proposed_revision_id
            AND NEW.proposed_revision_id IS NOT NULL OR promotion OR NEW.state='completed')
        AND (NEW.cancel_sender_revision_id IS NOT NULL OR NEW.cancel_recipient_revision_id IS NOT NULL) THEN
        RAISE EXCEPTION 'amendments and completion clear cancellation requests' USING ERRCODE = 'P0G08';
    END IF;
    IF (NEW.cancel_sender_revision_id IS NOT NULL
            AND NEW.cancel_sender_revision_id IS DISTINCT FROM NEW.current_revision_id)
        OR (NEW.cancel_recipient_revision_id IS NOT NULL
            AND NEW.cancel_recipient_revision_id IS DISTINCT FROM NEW.current_revision_id) THEN
        RAISE EXCEPTION 'cancellation names current terms' USING ERRCODE = 'P0G08';
    END IF;
    IF NEW.state='cancelled' AND (NEW.cancel_sender_revision_id IS NULL
        OR NEW.cancel_recipient_revision_id IS NULL) THEN
        RAISE EXCEPTION 'cancellation requires both parties' USING ERRCODE = 'P0G08';
    END IF;
    IF (NEW.sender_archived_at IS DISTINCT FROM OLD.sender_archived_at
        OR NEW.recipient_archived_at IS DISTINCT FROM OLD.recipient_archived_at)
        AND (NEW.origin<>'direct' OR NEW.state NOT IN ('draft','sent')) THEN
        RAISE EXCEPTION 'only direct drafts and sent offers can be archived' USING ERRCODE = 'P0G08';
    END IF;
    RETURN NEW;
END;
$$;
