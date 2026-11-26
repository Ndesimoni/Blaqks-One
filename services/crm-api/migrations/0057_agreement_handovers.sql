-- Owner module: agreements (services/crm-api/src/agreements, docs/agreements-design.md §14).
-- Packet A3a: in-company deal hand-overs become agreements. Their origin locks them to
-- the finance module's calls; an Admin approval is recorded as itself, never as the
-- receiving agent's acceptance; new revisions digest their author too (scheme 2).

ALTER TABLE agreements.crm_agreements
    ADD COLUMN origin text NOT NULL DEFAULT 'direct'
        CHECK (origin IN ('direct', 'deal_handover'));

ALTER TABLE agreements.crm_agreement_revisions
    ADD COLUMN digest_scheme smallint NOT NULL DEFAULT 1 CHECK (digest_scheme IN (1, 2)),
    DROP CONSTRAINT crm_agreement_revisions_author_party_check,
    ADD CONSTRAINT crm_agreement_revisions_author_party_check
        CHECK (author_party IN ('sender', 'recipient', 'admin'));

ALTER TABLE agreements.crm_agreement_actions
    DROP CONSTRAINT crm_agreement_actions_action_check,
    ADD CONSTRAINT crm_agreement_actions_action_check
        CHECK (action IN ('accepted', 'declined', 'approved')),
    DROP CONSTRAINT crm_agreement_actions_verification_check,
    ADD CONSTRAINT crm_agreement_actions_verification_check
        CHECK (verification IN ('member', 'contact_verified', 'admin_decision')),
    DROP CONSTRAINT crm_agreement_actions_check,
    ADD CONSTRAINT crm_agreement_actions_digest_check
        CHECK ((action IN ('accepted', 'approved')) = (accepted_digest IS NOT NULL)),
    ADD CONSTRAINT crm_agreement_actions_approval_check
        CHECK ((action = 'approved') = (verification = 'admin_decision')
            AND (action <> 'approved' OR party = 'recipient'));

-- One acceptance or approval per revision.
CREATE UNIQUE INDEX crm_agreement_actions_one_acceptance
    ON agreements.crm_agreement_actions (revision_id) WHERE action IN ('accepted', 'approved');

-- Admin approvals and Admin revisions exist only on in-company hand-over agreements, and
-- the receiving agent of a hand-over never writes terms. The Admin role is checked in Rust.
CREATE FUNCTION agreements.crm_agreement_handover_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    handover boolean;
    kind text;
BEGIN
    SELECT a.origin = 'deal_handover' AND a.workspace_id = a.recipient_workspace_id, a.kind
        INTO handover, kind
        FROM agreements.crm_agreements a WHERE a.id = NEW.agreement_id;
    IF TG_TABLE_NAME = 'crm_agreement_actions' THEN
        IF NEW.action = 'approved' AND NOT handover THEN
            RAISE EXCEPTION 'only an in-company hand-over can be approved'
                USING ERRCODE = 'P0G07';
        END IF;
    ELSIF NEW.author_party = 'admin' AND (NOT handover OR NEW.parent_id IS NULL
        OR kind = 'co_broking') THEN
        RAISE EXCEPTION 'only an in-company hand-over has Admin terms' USING ERRCODE = 'P0G07';
    ELSIF handover AND NEW.author_party = 'recipient' THEN
        RAISE EXCEPTION 'a hand-over receiver does not write terms' USING ERRCODE = 'P0G07';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_agreement_actions_handover_guard
    BEFORE INSERT ON agreements.crm_agreement_actions
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_handover_guard();

CREATE TRIGGER crm_agreement_revisions_handover_guard
    BEFORE INSERT ON agreements.crm_agreement_revisions
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_handover_guard();

-- The 0030 guard, with the origin frozen as part of the agreement's identity.
CREATE OR REPLACE FUNCTION agreements.crm_agreement_version_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    first_revision boolean := OLD.current_revision_id IS NULL
        AND NEW.current_revision_id IS NOT NULL AND NEW.version = OLD.version
        AND NEW.state = OLD.state;
BEGIN
    IF NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id
        OR NEW.recipient_workspace_id <> OLD.recipient_workspace_id
        OR NEW.kind <> OLD.kind OR NEW.created_by <> OLD.created_by
        OR NEW.origin <> OLD.origin THEN
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
