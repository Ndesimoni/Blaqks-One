-- Owner module: agreements (services/crm-api/src/agreements, docs/agreements-design.md §17).
-- Packet H2: a hand-over that needs approval keeps the receiving agent's acceptance and
-- the chosen approver's approval on the same revision. The approver's verification is its
-- own value, distinct from an Admin decision.

ALTER TABLE agreements.crm_agreement_actions
    DROP CONSTRAINT crm_agreement_actions_verification_check,
    ADD CONSTRAINT crm_agreement_actions_verification_check
        CHECK (verification IN ('member', 'contact_verified', 'admin_decision',
            'approver_decision')),
    DROP CONSTRAINT crm_agreement_actions_approval_check,
    ADD CONSTRAINT crm_agreement_actions_approval_check
        CHECK ((action = 'approved') = (verification IN ('admin_decision', 'approver_decision'))
            AND (action <> 'approved' OR party = 'recipient'));

-- One acceptance and one approval per revision.
DROP INDEX agreements.crm_agreement_actions_one_acceptance;
CREATE UNIQUE INDEX crm_agreement_actions_one_acceptance
    ON agreements.crm_agreement_actions (revision_id) WHERE action = 'accepted';
CREATE UNIQUE INDEX crm_agreement_actions_one_approval
    ON agreements.crm_agreement_actions (revision_id) WHERE action = 'approved';

-- The 0057 guard, with H2's evidence rules: an approver's decision follows the receiving
-- member's acceptance of the same revision and digest and is made by neither participant;
-- the receiving member never approves; no Admin terms follow an acceptance.
CREATE OR REPLACE FUNCTION agreements.crm_agreement_handover_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    handover boolean;
    kind text;
    sender uuid;
    recipient uuid;
BEGIN
    SELECT a.origin = 'deal_handover' AND a.workspace_id = a.recipient_workspace_id, a.kind
        INTO handover, kind
        FROM agreements.crm_agreements a WHERE a.id = NEW.agreement_id;
    SELECT max(p.member_id::text) FILTER (WHERE p.party = 'sender')::uuid,
        max(p.member_id::text) FILTER (WHERE p.party = 'recipient')::uuid
        INTO sender, recipient
        FROM agreements.crm_agreement_participants p WHERE p.agreement_id = NEW.agreement_id;
    IF TG_TABLE_NAME = 'crm_agreement_actions' THEN
        IF NEW.action = 'approved' AND NOT handover THEN
            RAISE EXCEPTION 'only an in-company hand-over can be approved'
                USING ERRCODE = 'P0G07';
        END IF;
        IF NEW.action = 'approved' AND NEW.actor_id = recipient THEN
            RAISE EXCEPTION 'the receiving member does not approve' USING ERRCODE = 'P0G07';
        END IF;
        IF NEW.verification = 'approver_decision' AND (NEW.actor_id = sender
            OR NOT EXISTS (SELECT 1 FROM agreements.crm_agreement_actions x
                WHERE x.revision_id = NEW.revision_id AND x.action = 'accepted'
                    AND x.party = 'recipient' AND x.actor_id = recipient
                    AND x.accepted_digest = NEW.accepted_digest)) THEN
            RAISE EXCEPTION 'an approval follows the receiver''s acceptance'
                USING ERRCODE = 'P0G07';
        END IF;
    ELSIF NEW.author_party = 'admin' AND (NOT handover OR NEW.parent_id IS NULL
        OR kind = 'co_broking') THEN
        RAISE EXCEPTION 'only an in-company hand-over has Admin terms' USING ERRCODE = 'P0G07';
    ELSIF NEW.author_party = 'admin' AND EXISTS (SELECT 1
        FROM agreements.crm_agreement_actions x
        WHERE x.agreement_id = NEW.agreement_id AND x.action = 'accepted') THEN
        RAISE EXCEPTION 'Admin terms come before an acceptance' USING ERRCODE = 'P0G07';
    ELSIF handover AND NEW.author_party = 'recipient' THEN
        RAISE EXCEPTION 'a hand-over receiver does not write terms' USING ERRCODE = 'P0G07';
    END IF;
    RETURN NEW;
END;
$$;
