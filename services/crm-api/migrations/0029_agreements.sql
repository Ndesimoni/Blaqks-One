-- Owner module: agreements (services/crm-api/src/agreements, docs/agreements-design.md).
-- Packet A2: immutable agreement core in its own schema. Frozen snapshots replace
-- foreign keys into CRM tables (service-boundaries decision D6). Never edit after
-- release; later packets add tables in new migrations. Same-company agreements are
-- refused in Rust for now and stay possible here for the A3 in-company handover.

CREATE SCHEMA IF NOT EXISTS agreements;

CREATE TABLE agreements.crm_agreements (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    recipient_workspace_id text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('handover_full', 'handover_referral', 'co_broking')),
    state text NOT NULL CHECK (
        state IN ('draft', 'sent', 'accepted', 'declined', 'revoked', 'completed', 'cancelled')
    ),
    version bigint NOT NULL CHECK (version > 0),
    current_revision_id uuid,
    expires_at timestamptz,
    archived_at timestamptz,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (state <> 'sent' OR expires_at IS NOT NULL)
);

CREATE INDEX crm_agreements_sender ON agreements.crm_agreements (workspace_id, updated_at DESC);
CREATE INDEX crm_agreements_recipient ON agreements.crm_agreements (recipient_workspace_id, updated_at DESC);

-- Who the two named parties are. Verification is evidence of an action, so it is
-- stored on each acceptance or decline, not here.
CREATE TABLE agreements.crm_agreement_participants (
    agreement_id uuid NOT NULL REFERENCES agreements.crm_agreements (id),
    party text NOT NULL CHECK (party IN ('sender', 'recipient')),
    workspace_id text NOT NULL,
    member_id uuid NOT NULL,
    PRIMARY KEY (agreement_id, party)
);

CREATE TABLE agreements.crm_agreement_revisions (
    id uuid PRIMARY KEY,
    agreement_id uuid NOT NULL REFERENCES agreements.crm_agreements (id),
    number integer NOT NULL CHECK (number > 0),
    parent_id uuid REFERENCES agreements.crm_agreement_revisions (id),
    author_party text NOT NULL CHECK (author_party IN ('sender', 'recipient')),
    terms jsonb NOT NULL CHECK (jsonb_typeof(terms) = 'object'),
    subject_digest text NOT NULL CHECK (subject_digest ~ '^[a-f0-9]{64}$'),
    digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (agreement_id, number),
    CHECK (octet_length(terms::text) <= 32768)
);

CREATE INDEX crm_agreement_revisions_latest ON agreements.crm_agreement_revisions (agreement_id, number DESC);

CREATE TABLE agreements.crm_agreement_events (
    id uuid PRIMARY KEY,
    agreement_id uuid NOT NULL REFERENCES agreements.crm_agreements (id),
    revision_id uuid REFERENCES agreements.crm_agreement_revisions (id),
    action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 40),
    actor_id uuid,
    party text CHECK (party IN ('sender', 'recipient')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_agreement_events_feed ON agreements.crm_agreement_events (agreement_id, created_at);

CREATE TABLE agreements.crm_agreement_actions (
    id uuid PRIMARY KEY,
    agreement_id uuid NOT NULL REFERENCES agreements.crm_agreements (id),
    revision_id uuid NOT NULL REFERENCES agreements.crm_agreement_revisions (id),
    action text NOT NULL CHECK (action IN ('accepted', 'declined')),
    actor_id uuid NOT NULL,
    party text NOT NULL CHECK (party IN ('sender', 'recipient')),
    verification text NOT NULL CHECK (verification IN ('member', 'contact_verified')),
    accepted_digest text CHECK (accepted_digest ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (revision_id, party, action),
    CHECK ((action = 'accepted') = (accepted_digest IS NOT NULL))
);
