-- Owner: agreements. Exact-detail release records bind an accepted revision to its share.
CREATE TABLE agreements.crm_market_releases (
    agreement_id uuid PRIMARY KEY REFERENCES agreements.crm_agreements(id),
    share_id uuid NOT NULL REFERENCES agreements.crm_listing_shares(id),
    revision_id uuid NOT NULL REFERENCES agreements.crm_agreement_revisions(id),
    accepted_digest text NOT NULL,
    requester_id uuid NOT NULL,
    broker_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX crm_market_releases_share ON agreements.crm_market_releases(share_id);
CREATE INDEX crm_market_releases_requester ON agreements.crm_market_releases(requester_id);
CREATE INDEX crm_market_releases_broker ON agreements.crm_market_releases(broker_id);
CREATE FUNCTION agreements.crm_market_release_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM agreements.crm_agreements a
        JOIN agreements.crm_listing_shares s ON s.id=a.listing_share_id
        JOIN agreements.crm_agreement_revisions r ON r.id=a.current_revision_id
        JOIN agreements.crm_agreement_actions x ON x.agreement_id=a.id AND x.revision_id=r.id
        WHERE a.id=NEW.agreement_id AND a.state='accepted' AND a.kind='co_broking'
            AND s.id=NEW.share_id AND s.origin='marketplace'
            AND r.id=NEW.revision_id AND r.digest=NEW.accepted_digest
            AND x.action='accepted' AND x.accepted_digest=r.digest
            AND NEW.requester_id=s.to_id AND NEW.broker_id=s.from_id) THEN
        RAISE EXCEPTION 'release needs exact accepted marketplace revision' USING ERRCODE='P0G03';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER crm_market_release_guard BEFORE INSERT ON agreements.crm_market_releases
    FOR EACH ROW EXECUTE FUNCTION agreements.crm_market_release_guard();
CREATE FUNCTION agreements.crm_market_releases_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'marketplace release evidence is insert-only' USING ERRCODE='P0G01';
END;
$$;
CREATE TRIGGER crm_market_releases_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
    ON agreements.crm_market_releases FOR EACH STATEMENT
    EXECUTE FUNCTION agreements.crm_market_releases_immutable();
