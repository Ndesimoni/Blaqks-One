-- Both proposing and promoting terms must preserve all live paid evidence.
CREATE FUNCTION agreements.crm_agreement_amendment_money_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    candidate uuid;
    old_terms jsonb;
    new_terms jsonb;
    old_payer text;
    new_payer text;
    due bigint;
    live_paid numeric;
BEGIN
    IF OLD.state<>'accepted' THEN RETURN NEW; END IF;
    IF NEW.current_revision_id IS DISTINCT FROM OLD.current_revision_id THEN
        candidate:=NEW.current_revision_id;
    ELSIF NEW.proposed_revision_id IS DISTINCT FROM OLD.proposed_revision_id THEN
        candidate:=NEW.proposed_revision_id;
    END IF;
    IF candidate IS NULL THEN RETURN NEW; END IF;
    SELECT COALESCE(sum(p.amount_fils),0) INTO live_paid
        FROM agreements.crm_agreement_payments p WHERE p.agreement_id=NEW.id AND p.action='paid'
        AND NOT EXISTS(SELECT 1 FROM agreements.crm_agreement_payments x
            WHERE x.reference_id=p.id AND x.action='withdrawn');
    IF live_paid=0 THEN RETURN NEW; END IF;
    SELECT terms INTO old_terms FROM agreements.crm_agreement_revisions WHERE id=OLD.current_revision_id;
    SELECT terms INTO new_terms FROM agreements.crm_agreement_revisions WHERE id=candidate;
    SELECT d.payer INTO old_payer FROM agreements.crm_agreement_payment_due(NEW.kind,old_terms) d;
    SELECT d.payer,d.due INTO new_payer,due FROM agreements.crm_agreement_payment_due(NEW.kind,new_terms) d;
    IF new_payer IS DISTINCT FROM old_payer OR due IS NULL OR due<live_paid THEN
        RAISE EXCEPTION 'amendment must preserve payer and cover live payments' USING ERRCODE='P0G09';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER crm_agreement_amendment_money_guard_trigger
    BEFORE UPDATE ON agreements.crm_agreements
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_amendment_money_guard();
