-- Owner module: sites. Website public identity and content are separate from private CRM.
CREATE SCHEMA sites;
CREATE TABLE sites.crm_website_sites (
    id uuid PRIMARY KEY,
    workspace text,
    kind text NOT NULL CHECK (kind IN ('platform','company')),
    host text NOT NULL UNIQUE,
    name text NOT NULL,
    theme text NOT NULL CHECK (theme IN ('1','2','3','4')),
    active boolean NOT NULL DEFAULT true,
    entitled boolean NOT NULL DEFAULT false,
    licence_verified boolean NOT NULL DEFAULT false,
    company jsonb NOT NULL DEFAULT '{}',
    content jsonb NOT NULL DEFAULT '{}',
    version bigint NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind='platform')=(workspace IS NULL))
);
CREATE UNIQUE INDEX crm_website_sites_company ON sites.crm_website_sites(workspace)
    WHERE workspace IS NOT NULL;
CREATE UNIQUE INDEX crm_website_sites_platform ON sites.crm_website_sites(kind)
    WHERE kind='platform';
CREATE TABLE sites.crm_website_profiles (
    id uuid PRIMARY KEY,
    workspace text NOT NULL,
    member uuid NOT NULL,
    body jsonb NOT NULL,
    consent boolean NOT NULL DEFAULT false,
    can_publish boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    version bigint NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace,member)
);
CREATE TABLE sites.crm_website_site_events (
    id uuid PRIMARY KEY,
    site uuid,
    workspace text,
    actor uuid NOT NULL,
    action text NOT NULL,
    version bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sites.crm_website_content_versions (
    id uuid PRIMARY KEY,
    site uuid,
    profile uuid,
    actor uuid NOT NULL,
    version bigint NOT NULL,
    body jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((site IS NULL) <> (profile IS NULL))
);
CREATE FUNCTION sites.crm_website_content_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Public content versions are immutable'; END $$;
CREATE TRIGGER crm_website_content_immutable BEFORE UPDATE OR DELETE ON sites.crm_website_content_versions
    FOR EACH ROW EXECUTE FUNCTION sites.crm_website_content_immutable();
CREATE TRIGGER crm_website_site_events_immutable BEFORE UPDATE OR DELETE ON sites.crm_website_site_events
    FOR EACH ROW EXECUTE FUNCTION sites.crm_website_content_immutable();
