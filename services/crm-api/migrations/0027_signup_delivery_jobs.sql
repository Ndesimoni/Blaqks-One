-- Owner module: signup (docs/service-boundaries.md); durable delivery packet R1.
-- Jobs stay in the sign-up outbox because sign-up owns the message data. A generic jobs
-- table is unnecessary until another domain needs the same lease mechanics.
ALTER TABLE crm_signup_outbox
    ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
    ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN lease_owner UUID,
    ADD COLUMN lease_expires_at TIMESTAMPTZ,
    ADD COLUMN superseded_at TIMESTAMPTZ,
    ADD COLUMN terminal_at TIMESTAMPTZ,
    ADD COLUMN last_error TEXT CHECK (last_error IS NULL OR char_length(last_error) <= 200);

ALTER TABLE crm_signup_outbox ADD CONSTRAINT crm_signup_outbox_lease_shape
    CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL));

CREATE INDEX crm_signup_outbox_pending
    ON crm_signup_outbox(next_attempt_at, created_at)
    WHERE delivered_at IS NULL AND terminal_at IS NULL AND superseded_at IS NULL;
