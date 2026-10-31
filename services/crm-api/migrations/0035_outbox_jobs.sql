-- Owner module: outbox (services/crm-api/src/outbox, docs/messaging-design.md §3 and §5,
-- packet X2). Generic delivery jobs with leases. Rows name a domain and an object ID only:
-- no body, address, token or rendered text column exists (decision D8).

CREATE SCHEMA IF NOT EXISTS outbox;

CREATE TABLE outbox.crm_outbox_jobs (
    id uuid PRIMARY KEY,
    workspace_id text NOT NULL,
    domain text NOT NULL CHECK (domain IN ('inbox')),
    object_id uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN ('send')),
    state text NOT NULL CHECK (state IN ('pending', 'leased', 'done', 'failed', 'unknown')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
    available_at timestamptz NOT NULL DEFAULT now(),
    lease_owner uuid,
    lease_expires_at timestamptz,
    last_failure_code text CHECK (
        last_failure_code IS NULL OR last_failure_code ~ '^[a-z_]{1,40}$'
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL)),
    CHECK ((state = 'leased') = (lease_owner IS NOT NULL)),
    CHECK ((state IN ('done', 'failed', 'unknown')) = (finished_at IS NOT NULL))
);

-- Exactly one live job per outbound object.
CREATE UNIQUE INDEX crm_outbox_jobs_live
    ON outbox.crm_outbox_jobs (domain, object_id)
    WHERE state IN ('pending', 'leased');

CREATE INDEX crm_outbox_jobs_due
    ON outbox.crm_outbox_jobs (available_at, created_at)
    WHERE state = 'pending';

CREATE INDEX crm_outbox_jobs_leases
    ON outbox.crm_outbox_jobs (lease_expires_at)
    WHERE state = 'leased';

CREATE INDEX crm_outbox_jobs_purge
    ON outbox.crm_outbox_jobs (finished_at)
    WHERE finished_at IS NOT NULL;

-- One row per provider call. It commits before the call (SEC-2), so a crash or an
-- overrunning call leaves an unfinished attempt that turns the job `unknown` instead of
-- letting another worker send it again.
CREATE TABLE outbox.crm_outbox_attempts (
    id uuid PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES outbox.crm_outbox_jobs (id) ON DELETE CASCADE,
    attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 20),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    outcome text CHECK (outcome IS NULL OR outcome IN ('sent', 'retry', 'failed', 'unknown')),
    CHECK ((finished_at IS NULL) = (outcome IS NULL)),
    UNIQUE (job_id, attempt)
);

CREATE INDEX crm_outbox_attempts_open
    ON outbox.crm_outbox_attempts (job_id)
    WHERE finished_at IS NULL;
