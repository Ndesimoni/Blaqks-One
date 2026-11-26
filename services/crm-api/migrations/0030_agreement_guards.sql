-- Owner module: agreements (services/crm-api/src/agreements, docs/agreements-design.md).
-- Packet A2: evidence guards. Revisions, events, actions and participants are
-- insert-only; the agreement row moves forward one version at a time, only through
-- the lifecycle in design §4, and its current revision must belong to it.

CREATE FUNCTION agreements.crm_agreement_revision_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'agreement revisions are immutable' USING ERRCODE = 'P0G01';
END;
$$;

CREATE TRIGGER crm_agreement_revision_frozen_guard
    BEFORE UPDATE OR DELETE ON agreements.crm_agreement_revisions
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_revision_frozen();

CREATE FUNCTION agreements.crm_agreement_record_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'agreement evidence is immutable' USING ERRCODE = 'P0G02';
END;
$$;

CREATE TRIGGER crm_agreement_events_frozen_guard
    BEFORE UPDATE OR DELETE ON agreements.crm_agreement_events
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_record_frozen();

CREATE TRIGGER crm_agreement_actions_frozen_guard
    BEFORE UPDATE OR DELETE ON agreements.crm_agreement_actions
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_record_frozen();

CREATE TRIGGER crm_agreement_participants_frozen_guard
    BEFORE UPDATE OR DELETE ON agreements.crm_agreement_participants
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_record_frozen();

CREATE FUNCTION agreements.crm_agreement_revision_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.current_revision_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM agreements.crm_agreement_revisions r
        WHERE r.id = NEW.current_revision_id AND r.agreement_id = NEW.id
    ) THEN
        RAISE EXCEPTION 'current revision must belong to the agreement'
            USING ERRCODE = 'P0G03';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_agreement_revision_owner_guard
    BEFORE INSERT OR UPDATE ON agreements.crm_agreements
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_revision_owner();

CREATE FUNCTION agreements.crm_agreement_version_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    first_revision boolean := OLD.current_revision_id IS NULL
        AND NEW.current_revision_id IS NOT NULL AND NEW.version = OLD.version
        AND NEW.state = OLD.state;
BEGIN
    IF NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id
        OR NEW.recipient_workspace_id <> OLD.recipient_workspace_id
        OR NEW.kind <> OLD.kind OR NEW.created_by <> OLD.created_by THEN
        RAISE EXCEPTION 'agreement identity is fixed' USING ERRCODE = 'P0G04';
    END IF;
    IF NEW.version <> OLD.version + 1 AND NOT first_revision THEN
        RAISE EXCEPTION 'agreement changes advance one version' USING ERRCODE = 'P0G05';
    END IF;
    IF NOT first_revision AND NOT (
        (OLD.state = 'draft' AND NEW.state IN ('draft', 'sent'))
        OR (OLD.state = 'sent' AND NEW.state IN ('sent', 'accepted', 'declined', 'revoked'))
        OR (OLD.state = 'accepted' AND NEW.state IN ('completed', 'cancelled'))
    ) THEN
        RAISE EXCEPTION 'this agreement cannot move to that state' USING ERRCODE = 'P0G06';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_agreement_version_guard_trigger
    BEFORE UPDATE ON agreements.crm_agreements
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_version_guard();
