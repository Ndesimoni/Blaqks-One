-- Owner module: marketplace (docs/broker-marketplace.md §2, §13–§15, packet MK1b).
-- Joining the marketplace: versioned terms bound to their text, one acceptance per member and
-- version, and the member's profile. Terms and acceptances are evidence: inserted and read,
-- never changed or deleted. Profiles are edited and removed, so they carry a version.
CREATE TABLE marketplace.crm_market_terms (
    version text PRIMARY KEY CHECK (char_length(version) BETWEEN 1 AND 40),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
    consent text NOT NULL CHECK (char_length(consent) BETWEEN 1 AND 1000),
    commitments jsonb NOT NULL CHECK (jsonb_typeof(commitments) = 'array'
        AND jsonb_array_length(commitments) = 4),
    digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
    draft boolean NOT NULL,
    published_at timestamptz NOT NULL DEFAULT now() UNIQUE,
    UNIQUE (version, digest)
);
CREATE INDEX crm_market_terms_current ON marketplace.crm_market_terms (published_at DESC);

CREATE TABLE marketplace.crm_market_acceptances (
    id uuid PRIMARY KEY,
    member_id uuid NOT NULL,
    workspace_id text NOT NULL,
    terms_version text NOT NULL,
    terms_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (member_id, terms_version),
    FOREIGN KEY (terms_version, terms_digest)
        REFERENCES marketplace.crm_market_terms (version, digest)
);
CREATE INDEX crm_market_acceptances_company ON marketplace.crm_market_acceptances
    (workspace_id, member_id);

CREATE TABLE marketplace.crm_market_profiles (
    member_id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    emirates text[] NOT NULL CHECK (cardinality(emirates) BETWEEN 1 AND 7),
    communities jsonb NOT NULL CHECK (jsonb_typeof(communities) = 'array'
        AND jsonb_array_length(communities) <= 12),
    property_types text[] NOT NULL CHECK (cardinality(property_types) BETWEEN 1 AND 4),
    experience_years smallint NOT NULL CHECK (experience_years BETWEEN 0 AND 60),
    licence_number text CHECK (licence_number ~ '^[A-Za-z0-9]{1,20}$'),
    licence_authority text CHECK (licence_authority IN ('RERA', 'ADREC', 'other')),
    photo_id uuid,
    joined_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    -- A licence number and its authority come together, or neither is given.
    CHECK ((licence_number IS NULL) = (licence_authority IS NULL))
);
CREATE INDEX crm_market_profiles_company ON marketplace.crm_market_profiles (workspace_id);

-- The first terms version: a draft written for UAE lawyer review (owner, 2026-10-24).
INSERT INTO marketplace.crm_market_terms
    (version, body, consent, commitments, digest, draft, published_at)
VALUES (
    '2026-10-24.1',
    $body$Broker marketplace terms. Draft for UAE lawyer review, 24 October 2026.

Blaqks One members may post what their clients are looking for and answer other members privately. Only requests for real clients a member is working with may be posted. A commission split is agreed in Blaqks One before client details are shared, and agreed commissions are paid on time. Talking on WhatsApp is allowed, but Blaqks One can help only with deals recorded as agreements here. Blaqks One may suspend marketplace access after a dispute a member loses. Company names and licence numbers are declared by the broker and are not verified by Blaqks One. A member may leave the marketplace at any time; accepted terms stay on record.$body$,
    $consent$My name, photo, company, areas, experience and licence are shown to members of every company on Blaqks One.$consent$,
    '["I only post requests for real clients I''m working with.","I agree the commission split in Blaqks One before sharing client details.","I pay agreed commissions on time.","I understand Blaqks One can suspend my access after a dispute I lose."]',
    '14547ac2b0156f2d09df6cd263f0dabcaf57fbeb5967ebf58541b351e67a12ff',
    true,
    now()
);

CREATE FUNCTION marketplace.crm_market_terms_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Marketplace evidence is insert-only' USING ERRCODE = 'P0M01';
END;
$$;

CREATE TRIGGER crm_market_terms_frozen BEFORE UPDATE OR DELETE
    ON marketplace.crm_market_terms
    FOR EACH ROW EXECUTE FUNCTION marketplace.crm_market_terms_frozen();
CREATE TRIGGER crm_market_acceptances_frozen BEFORE UPDATE OR DELETE
    ON marketplace.crm_market_acceptances
    FOR EACH ROW EXECUTE FUNCTION marketplace.crm_market_terms_frozen();
CREATE TRIGGER crm_market_terms_no_truncate BEFORE TRUNCATE
    ON marketplace.crm_market_terms
    FOR EACH STATEMENT EXECUTE FUNCTION marketplace.crm_market_terms_frozen();
CREATE TRIGGER crm_market_acceptances_no_truncate BEFORE TRUNCATE
    ON marketplace.crm_market_acceptances
    FOR EACH STATEMENT EXECUTE FUNCTION marketplace.crm_market_terms_frozen();
