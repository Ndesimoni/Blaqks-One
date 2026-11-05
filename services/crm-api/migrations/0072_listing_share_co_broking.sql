-- Owner module: agreements (docs/record-sharing.md R2, "Turning it into co-broking"). Either
-- named person of an accepted, open listing share proposes a co-broking agreement to the
-- other. The agreement keeps the share's ID for good; its property comes from the share's
-- snapshot and every revision carries the same `introduction`, so each revision's digest is
-- bound to the introduction. A share leads to one co-broking deal at a time: a draft or an
-- offer is refused while another agreement from it is accepted, completed or an unexpired
-- offer. Drafts are private, one per person, and never block the other person.

ALTER TABLE agreements.crm_agreements ADD COLUMN listing_share_id uuid
    REFERENCES agreements.crm_listing_shares (id);
CREATE INDEX crm_agreements_listing_share ON agreements.crm_agreements (listing_share_id)
    WHERE listing_share_id IS NOT NULL;
CREATE UNIQUE INDEX crm_agreements_listing_share_draft ON agreements.crm_agreements
    (listing_share_id, created_by) WHERE listing_share_id IS NOT NULL AND state = 'draft';

ALTER TABLE agreements.crm_listing_share_events
    DROP CONSTRAINT crm_listing_share_events_action_check;
ALTER TABLE agreements.crm_listing_share_events ADD CONSTRAINT crm_listing_share_events_action_check
    CHECK (action IN ('sent', 'opened', 'accepted', 'declined', 'withdrawn', 'stopped',
        'extended', 'expired', 'ended', 'converted'));

-- Whether an agreement from share `p_share` other than `p_except` stands: accepted,
-- completed, or an offer whose current revision has not expired.
CREATE FUNCTION agreements.crm_listing_share_taken(p_share uuid, p_except uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM agreements.crm_agreements a
        JOIN agreements.crm_agreement_revisions r ON r.id = a.current_revision_id
        WHERE a.listing_share_id = p_share AND a.id IS DISTINCT FROM p_except
            AND (a.state IN ('accepted', 'completed') OR (a.state = 'sent'
                AND (r.terms->>'expiresAt')::timestamptz > clock_timestamp())));
$$;

-- A new agreement names an accepted, open share between its two companies; the share is
-- fixed afterwards. Sending locks the share, so two offers cannot both stand.
CREATE FUNCTION agreements.crm_agreement_share_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.listing_share_id IS DISTINCT FROM OLD.listing_share_id THEN
            RAISE EXCEPTION 'agreement identity is fixed' USING ERRCODE = 'P0G04';
        END IF;
        IF NEW.listing_share_id IS NOT NULL AND OLD.state = 'draft' AND NEW.state = 'sent' THEN
            PERFORM 1 FROM agreements.crm_listing_shares WHERE id = NEW.listing_share_id
                FOR UPDATE;
            IF agreements.crm_listing_share_taken(NEW.listing_share_id, NEW.id) THEN
                RAISE EXCEPTION 'the listing already has a co-broking agreement'
                    USING ERRCODE = 'P0G11';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.listing_share_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.kind <> 'co_broking' OR NEW.origin <> 'direct' OR NEW.state <> 'draft'
        OR NOT EXISTS (SELECT 1 FROM agreements.crm_listing_shares s
            WHERE s.id = NEW.listing_share_id AND s.status = 'accepted'
                AND s.view_ends_at > clock_timestamp()
                AND ((s.workspace_id = NEW.workspace_id
                        AND s.recipient_workspace_id = NEW.recipient_workspace_id)
                    OR (s.workspace_id = NEW.recipient_workspace_id
                        AND s.recipient_workspace_id = NEW.workspace_id))) THEN
        RAISE EXCEPTION 'co-broking needs an open listing share' USING ERRCODE = 'P0G10';
    END IF;
    IF agreements.crm_listing_share_taken(NEW.listing_share_id, NULL) THEN
        RAISE EXCEPTION 'the listing already has a co-broking agreement' USING ERRCODE = 'P0G11';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_agreements_share_guard BEFORE INSERT OR UPDATE ON agreements.crm_agreements
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_share_guard();

-- Its participants are the share's two named people, each in their own company.
CREATE FUNCTION agreements.crm_agreement_share_parties() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM agreements.crm_agreements a
            WHERE a.id = NEW.agreement_id AND a.listing_share_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM agreements.crm_agreements a
            JOIN agreements.crm_listing_shares s ON s.id = a.listing_share_id
            WHERE a.id = NEW.agreement_id
                AND ((NEW.workspace_id = s.workspace_id AND NEW.member_id = s.from_id)
                    OR (NEW.workspace_id = s.recipient_workspace_id
                        AND NEW.member_id = s.to_id))) THEN
        RAISE EXCEPTION 'co-broking from a share is between its two people'
            USING ERRCODE = 'P0G10';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_agreement_participants_share_guard
    BEFORE INSERT ON agreements.crm_agreement_participants
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_share_parties();

-- Only an agreement from a share carries an introduction. Its first revision names the
-- share's snapshot; every later revision keeps the first one's introduction and property.
CREATE FUNCTION agreements.crm_agreement_introduction_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    share uuid;
    first jsonb;
BEGIN
    SELECT a.listing_share_id INTO share FROM agreements.crm_agreements a
        WHERE a.id = NEW.agreement_id;
    IF share IS NULL THEN
        IF NEW.terms ? 'introduction' THEN
            RAISE EXCEPTION 'only co-broking from a share has an introduction'
                USING ERRCODE = 'P0G03';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.number = 1 THEN
        IF NOT EXISTS (SELECT 1 FROM agreements.crm_listing_shares s
            JOIN agreements.crm_listing_snapshots n ON n.id = s.snapshot_id
            WHERE s.id = share AND n.reference = NEW.terms->'introduction'->>'reference'
                AND n.digest = NEW.terms->'introduction'->>'snapshotDigest') THEN
            RAISE EXCEPTION 'the introduction must name the share' USING ERRCODE = 'P0G03';
        END IF;
        RETURN NEW;
    END IF;
    SELECT r.terms INTO first FROM agreements.crm_agreement_revisions r
        WHERE r.agreement_id = NEW.agreement_id AND r.number = 1;
    IF NEW.terms->'introduction' IS DISTINCT FROM first->'introduction'
        OR NEW.terms->'subject'->'property' IS DISTINCT FROM first->'subject'->'property' THEN
        RAISE EXCEPTION 'the introduction and property are fixed' USING ERRCODE = 'P0G03';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_agreement_revisions_introduction_guard
    BEFORE INSERT ON agreements.crm_agreement_revisions
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_agreement_introduction_guard();
