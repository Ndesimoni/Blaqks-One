-- Owner module: marketplace (docs/broker-marketplace.md §14.3, MK1 code review M3). Every
-- join, and every acceptance of a newer terms version, records the publication consent the
-- member gave, so joining again after leaving (a withdrawal) leaves fresh evidence. The
-- acceptance stays one per member and version; consents are one per giving. Insert-only.
CREATE TABLE marketplace.crm_market_consents (
    id uuid PRIMARY KEY,
    member_id uuid NOT NULL,
    workspace_id text NOT NULL,
    terms_version text NOT NULL,
    terms_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (terms_version, terms_digest)
        REFERENCES marketplace.crm_market_terms (version, digest)
);
CREATE INDEX crm_market_consents_member ON marketplace.crm_market_consents
    (member_id, created_at DESC);

CREATE TRIGGER crm_market_consents_frozen BEFORE UPDATE OR DELETE
    ON marketplace.crm_market_consents
    FOR EACH ROW EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
CREATE TRIGGER crm_market_consents_no_truncate BEFORE TRUNCATE
    ON marketplace.crm_market_consents
    FOR EACH STATEMENT EXECUTE FUNCTION marketplace.crm_market_evidence_frozen();
