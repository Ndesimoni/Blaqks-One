-- Owner module: publications. Immutable public snapshots never reference private tables.
CREATE SCHEMA publications;
CREATE TABLE publications.crm_website_listings (
    id uuid PRIMARY KEY,
    workspace text NOT NULL,
    record uuid NOT NULL,
    profile uuid NOT NULL,
    member uuid NOT NULL,
    physical_key text NOT NULL,
    permit_reference text NOT NULL,
    destination text NOT NULL CHECK (destination IN ('general_and_company','company_only')),
    active boolean NOT NULL DEFAULT true,
    version bigint NOT NULL,
    source_version bigint NOT NULL,
    snapshot jsonb NOT NULL,
    photos uuid[] NOT NULL,
    floor_plans uuid[] NOT NULL,
    revision uuid NOT NULL,
    published_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace,record,member)
);
CREATE INDEX crm_website_listings_capacity ON publications.crm_website_listings(physical_key)
    WHERE active;
CREATE TABLE publications.crm_website_listing_revisions (
    id uuid PRIMARY KEY,
    publication uuid NOT NULL REFERENCES publications.crm_website_listings(id),
    workspace text NOT NULL,
    actor uuid NOT NULL,
    version bigint NOT NULL,
    source_version bigint NOT NULL,
    snapshot jsonb NOT NULL,
    photos uuid[] NOT NULL,
    floor_plans uuid[] NOT NULL,
    action text NOT NULL CHECK (action IN ('publish','withdraw')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(publication,version)
);
CREATE FUNCTION publications.crm_website_revisions_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Public versions are immutable'; END $$;
CREATE TRIGGER crm_website_revisions_immutable BEFORE UPDATE OR DELETE
    ON publications.crm_website_listing_revisions FOR EACH ROW
    EXECUTE FUNCTION publications.crm_website_revisions_immutable();
