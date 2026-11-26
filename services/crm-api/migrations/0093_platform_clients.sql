-- Owner module: platform_clients (services/crm-api/src/platform_clients,
-- docs/service-boundaries.md). BO1e Blaqks One's own clients (docs/blaqks-one-console.md §9
-- and §11): brokerages and agents interested in Blaqks One, worked on by the Owner and the
-- team members with the `clients` area. Never a company's data. Team members, the linked
-- company and authors are plain IDs without cross-domain foreign keys (service-boundaries
-- rule 4). Never edit after release.
CREATE SCHEMA platform_clients;

CREATE TABLE platform_clients.crm_platform_clients (
    id uuid PRIMARY KEY,
    company_name text CHECK (char_length(company_name) BETWEEN 1 AND 160),
    contact_name text CHECK (char_length(contact_name) BETWEEN 1 AND 120),
    phone text CHECK (phone ~ '^\+[0-9]{7,15}$'),
    -- Stored lowercased by the module; the sign-up link compares lower() on both sides.
    email text CHECK (char_length(email) BETWEEN 3 AND 254 AND position('@' IN email) > 1),
    source text NOT NULL
        CHECK (source IN ('website_form', 'help_request', 'referral', 'call', 'other')),
    stage text NOT NULL DEFAULT 'new'
        CHECK (stage IN ('new', 'contacted', 'demo_booked', 'signed_up', 'customer', 'lost')),
    notes text CHECK (char_length(notes) BETWEEN 1 AND 4000),
    next_follow_up date,
    -- The Blaqks One person working on the client (the Owner or a platform member).
    owner_id uuid,
    -- The company the client became through the verified public sign-up.
    linked_workspace_id text CHECK (char_length(linked_workspace_id) BETWEEN 1 AND 128),
    created_at timestamptz NOT NULL DEFAULT now(),
    -- NULL for the public website intake.
    created_by uuid,
    updated_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    archived_at timestamptz,
    CONSTRAINT crm_platform_clients_named
        CHECK (company_name IS NOT NULL OR contact_name IS NOT NULL),
    CONSTRAINT crm_platform_clients_reachable CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX crm_platform_clients_recent ON platform_clients.crm_platform_clients
    (updated_at DESC, id DESC) WHERE archived_at IS NULL;
CREATE INDEX crm_platform_clients_owner ON platform_clients.crm_platform_clients (owner_id)
    WHERE archived_at IS NULL;
CREATE INDEX crm_platform_clients_signup ON platform_clients.crm_platform_clients
    (lower(email)) WHERE archived_at IS NULL AND linked_workspace_id IS NULL;

-- What happened with a client, newest last: created, notes, calls and messages the person
-- made themselves (nothing is sent from here), stage and owner changes and the sign-up link.
CREATE TABLE platform_clients.crm_platform_client_timeline (
    id uuid PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES platform_clients.crm_platform_clients (id),
    kind text NOT NULL CHECK (kind IN
        ('created', 'note', 'call', 'whatsapp', 'email', 'sms', 'stage', 'linked', 'assigned')),
    body text CHECK (char_length(body) BETWEEN 1 AND 4000),
    -- NULL for the public website intake and the sign-up link.
    author_id uuid,
    at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX crm_platform_client_timeline_client
    ON platform_clients.crm_platform_client_timeline (client_id, at DESC, id DESC);

-- The timeline is a history: entries are never changed or removed (clients are archived).
CREATE FUNCTION platform_clients.crm_platform_client_timeline_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Client timeline entries are immutable'; END; $$;
CREATE TRIGGER crm_platform_client_timeline_frozen BEFORE UPDATE OR DELETE
    ON platform_clients.crm_platform_client_timeline FOR EACH ROW
    EXECUTE FUNCTION platform_clients.crm_platform_client_timeline_frozen();
