-- Owner module: agreements (docs/record-sharing.md R2, review amendment 2). The steps a
-- listing share may take, and the functions that end shares. Every function does bounded
-- database work only and raises on failure, so the caller's change rolls back with it.

-- Identity and evidence are frozen; pending → accepted, declined, withdrawn, expired or
-- ended; accepted → stopped or ended; an open share may record `opened` once, and an
-- accepted one may move its end forward (at most 90 days from the change). New shares
-- start pending between live members of two different live companies (a backstop for the
-- Rust checks). Shares are never deleted.
CREATE FUNCTION agreements.crm_listing_share_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending' OR NEW.closed_at IS NOT NULL OR NEW.opened_at IS NOT NULL
            OR NOT EXISTS (SELECT 1 FROM crm_user_profiles p WHERE p.id = NEW.from_id
                AND p.workspace_id = NEW.workspace_id AND p.active AND p.owner_active
                AND p.role <> 'super-admin')
            OR NOT EXISTS (SELECT 1 FROM crm_user_profiles p WHERE p.id = NEW.to_id
                AND p.workspace_id = NEW.recipient_workspace_id AND p.active AND p.owner_active
                AND p.role <> 'super-admin') THEN
            RAISE EXCEPTION 'A listing share starts pending between two companies'
                USING ERRCODE = 'P0R02';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Listing shares are kept as evidence' USING ERRCODE = 'P0R02';
    END IF;
    IF (NEW.id, NEW.snapshot_id, NEW.workspace_id, NEW.source_record_id, NEW.from_id,
        NEW.recipient_workspace_id, NEW.to_id, NEW.note, NEW.created_at, NEW.offer_ends_at)
        IS DISTINCT FROM (OLD.id, OLD.snapshot_id, OLD.workspace_id, OLD.source_record_id,
        OLD.from_id, OLD.recipient_workspace_id, OLD.to_id, OLD.note, OLD.created_at,
        OLD.offer_ends_at)
        OR (OLD.accepted_digest IS NOT NULL AND NEW.accepted_digest IS DISTINCT FROM
            OLD.accepted_digest)
        OR (OLD.decided_at IS NOT NULL AND NEW.decided_at IS DISTINCT FROM OLD.decided_at)
        OR (OLD.opened_at IS NOT NULL AND NEW.opened_at IS DISTINCT FROM OLD.opened_at)
        OR (OLD.closed_at IS NOT NULL)
        OR NOT ((OLD.status = 'pending' AND NEW.status IN ('pending', 'accepted', 'declined',
                'withdrawn', 'expired', 'ended'))
            OR (OLD.status = 'accepted' AND NEW.status IN ('accepted', 'stopped', 'ended')))
        OR (NEW.view_ends_at <> OLD.view_ends_at AND NOT (OLD.status = 'accepted'
            AND NEW.status = 'accepted' AND NEW.view_ends_at > OLD.view_ends_at
            AND NEW.view_ends_at <= now() + interval '91 days')) THEN
        RAISE EXCEPTION 'Listing shares are decided once' USING ERRCODE = 'P0R02';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_listing_shares_guard
    BEFORE INSERT OR UPDATE OR DELETE ON agreements.crm_listing_shares
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_listing_share_guard();
CREATE TRIGGER crm_listing_shares_no_truncate BEFORE TRUNCATE ON agreements.crm_listing_shares
    FOR EACH STATEMENT EXECUTE FUNCTION agreements.crm_listing_evidence_frozen();

-- Open shares among `p_ids` whose time has passed are closed as of that time: an
-- unanswered offer expires when its 14 days end, and any share ends (`end_date`) on its
-- last day, whichever comes first. The event carries that time, so the evidence shows the
-- true end. Rows are locked here; callers that already hold them lose nothing.
CREATE FUNCTION agreements.crm_listing_shares_lapse(p_ids uuid[]) RETURNS void
LANGUAGE sql AS $$
    WITH due AS (
        SELECT id,
            CASE WHEN status = 'pending' AND offer_ends_at <= view_ends_at THEN 'expired'
                ELSE 'ended' END AS next,
            CASE WHEN status = 'pending' THEN least(offer_ends_at, view_ends_at)
                ELSE view_ends_at END AS at
        FROM agreements.crm_listing_shares
        WHERE id = ANY(p_ids) AND status IN ('pending', 'accepted')
        ORDER BY id FOR UPDATE
    ), lapsed AS (
        UPDATE agreements.crm_listing_shares s SET status = d.next,
            end_reason = CASE WHEN d.next = 'ended' THEN 'end_date' END,
            closed_at = d.at, closed_by = NULL
        FROM due d WHERE s.id = d.id AND d.at <= clock_timestamp()
        RETURNING s.id, d.next, d.at
    )
    INSERT INTO agreements.crm_listing_share_events (id, share_id, action, reason, created_at)
    SELECT gen_random_uuid(), id, next, CASE WHEN next = 'ended' THEN 'end_date' END, at
    FROM lapsed;
$$;

-- Ends the open shares among `p_ids` for `p_reason`, after closing those already past their
-- time with their true end.
CREATE FUNCTION agreements.crm_listing_shares_end(p_ids uuid[], p_reason text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF cardinality(p_ids) = 0 THEN
        RETURN;
    END IF;
    PERFORM agreements.crm_listing_shares_lapse(p_ids);
    WITH ended AS (
        UPDATE agreements.crm_listing_shares SET status = 'ended', end_reason = p_reason,
            closed_at = now(), closed_by = NULL
        WHERE id = ANY(p_ids) AND status IN ('pending', 'accepted')
        RETURNING id
    )
    INSERT INTO agreements.crm_listing_share_events (id, share_id, action, reason)
    SELECT gen_random_uuid(), id, 'ended', p_reason FROM ended;
END;
$$;

-- What records triggers call (decision D12) when a listing changes holder, closes or is
-- deleted: its open outside shares end in the same transaction. Lead referrals join in R2b.
CREATE FUNCTION agreements.crm_outside_source_closed(p_workspace text, p_record uuid,
    p_reason text) RETURNS void
LANGUAGE sql AS $$
    SELECT agreements.crm_listing_shares_end(ARRAY(
        SELECT id FROM agreements.crm_listing_shares
        WHERE workspace_id = p_workspace AND source_record_id = p_record
            AND status IN ('pending', 'accepted') ORDER BY id), p_reason);
$$;
