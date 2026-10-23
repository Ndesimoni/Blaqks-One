-- Insert-only evidence: a paid row may receive exactly one confirmation or withdrawal.
CREATE TABLE agreements.crm_agreement_payments (
    id uuid PRIMARY KEY,
    agreement_id uuid NOT NULL REFERENCES agreements.crm_agreements(id),
    revision_id uuid NOT NULL REFERENCES agreements.crm_agreement_revisions(id),
    action text NOT NULL CHECK(action IN ('paid','confirmed','withdrawn')),
    reference_id uuid REFERENCES agreements.crm_agreement_payments(id),
    amount_fils bigint NOT NULL CHECK(amount_fils BETWEEN 1 AND 10000000000000),
    paid_on date NOT NULL,
    party text NOT NULL CHECK(party IN ('sender','recipient')),
    actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK((action='paid')=(reference_id IS NULL))
);
CREATE UNIQUE INDEX crm_agreement_payment_one_response
    ON agreements.crm_agreement_payments(reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX crm_agreement_payments_agreement
    ON agreements.crm_agreement_payments(agreement_id,created_at);
CREATE TRIGGER crm_agreement_payments_frozen_guard
    BEFORE UPDATE OR DELETE ON agreements.crm_agreement_payments
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_record_frozen();

CREATE FUNCTION agreements.crm_agreement_payment_due(kind text, terms jsonb)
RETURNS TABLE(payer text, due bigint) LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN kind='handover_referral' THEN 'recipient'
                WHEN kind='co_broking' THEN terms->'money'->>'collectingParty' END,
        floor(((terms->'money'->>'amountFils')::numeric *
            CASE WHEN kind='handover_referral' OR terms->'money'->>'collectingParty'='recipient'
                THEN (terms->'money'->>'senderShareBp')::numeric
                ELSE (terms->'money'->>'recipientShareBp')::numeric END + 5000)/10000)::bigint
$$;

CREATE FUNCTION agreements.crm_agreement_payment_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    a agreements.crm_agreements;
    r agreements.crm_agreement_revisions;
    original agreements.crm_agreement_payments;
    payer text;
    due bigint;
    live_paid numeric;
BEGIN
    SELECT * INTO a FROM agreements.crm_agreements WHERE id=NEW.agreement_id FOR UPDATE;
    SELECT * INTO r FROM agreements.crm_agreement_revisions WHERE id=a.current_revision_id;
    SELECT d.payer,d.due INTO payer,due FROM agreements.crm_agreement_payment_due(a.kind,r.terms) d;
    IF a.origin<>'direct' OR a.workspace_id=a.recipient_workspace_id
        OR a.state NOT IN ('accepted','completed') OR a.kind='handover_full'
        OR payer IS NULL OR payer NOT IN ('sender','recipient')
        OR NEW.revision_id<>a.current_revision_id
        OR NEW.paid_on>(clock_timestamp() AT TIME ZONE 'Asia/Dubai')::date
        OR NOT EXISTS(SELECT 1 FROM agreements.crm_agreement_participants p
            WHERE p.agreement_id=a.id AND p.party=NEW.party AND p.member_id=NEW.actor_id) THEN
        RAISE EXCEPTION 'payment not allowed' USING ERRCODE='P0G09';
    END IF;
    IF (NEW.action='confirmed')=(NEW.party=payer) THEN
        RAISE EXCEPTION 'wrong payment party' USING ERRCODE='P0G09';
    END IF;
    IF NEW.reference_id IS NOT NULL THEN
        SELECT * INTO original FROM agreements.crm_agreement_payments WHERE id=NEW.reference_id;
        IF original.id IS NULL OR original.action<>'paid' OR original.agreement_id<>a.id
            OR NEW.amount_fils<>original.amount_fils OR NEW.paid_on<>original.paid_on THEN
            RAISE EXCEPTION 'payment response must name exact paid entry' USING ERRCODE='P0G09';
        END IF;
    ELSE
        SELECT COALESCE(sum(p.amount_fils),0) INTO live_paid
            FROM agreements.crm_agreement_payments p WHERE p.agreement_id=a.id AND p.action='paid'
            AND NOT EXISTS(SELECT 1 FROM agreements.crm_agreement_payments x
                WHERE x.reference_id=p.id AND x.action='withdrawn');
        IF live_paid+NEW.amount_fils>due THEN
            RAISE EXCEPTION 'payments exceed amount due' USING ERRCODE='P0G09';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER crm_agreement_payment_guard_trigger
    BEFORE INSERT ON agreements.crm_agreement_payments
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_payment_guard();
