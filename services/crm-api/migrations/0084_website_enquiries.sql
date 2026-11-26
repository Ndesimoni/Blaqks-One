-- enquiries owns this schema. Cross-domain references are IDs, checked via owner commands.
CREATE SCHEMA enquiries;
CREATE TABLE enquiries.crm_website_enquiries (
    id uuid PRIMARY KEY,
    source_site uuid NOT NULL,
    source_host text NOT NULL,
    key_hash text NOT NULL,
    payload_hash text NOT NULL,
    workspace_id text NOT NULL,
    publication_id uuid,
    publication_revision uuid,
    source_site_version bigint NOT NULL,
    public_profile_id uuid,
    assignee_id uuid,
    lead_id uuid NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(source_site,key_hash)
);
CREATE INDEX crm_website_enquiries_workspace ON enquiries.crm_website_enquiries
    (workspace_id,created_at DESC,id DESC);
CREATE TABLE enquiries.crm_website_enquiry_events (
    id uuid PRIMARY KEY,
    enquiry_id uuid NOT NULL REFERENCES enquiries.crm_website_enquiries(id),
    actor_id uuid,
    action text NOT NULL CHECK(action IN ('received')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION enquiries.crm_website_enquiry_events_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Website enquiry events are immutable'; END; $$;
CREATE TRIGGER crm_website_enquiry_events_immutable BEFORE UPDATE OR DELETE
ON enquiries.crm_website_enquiry_events FOR EACH ROW
EXECUTE FUNCTION enquiries.crm_website_enquiry_events_immutable();
