-- Owner module: integrations (docs/messaging-design.md §3 and §7, packet X2).
-- A receipt exists only for a provider event whose signature was verified (SEC-3), so
-- unauthenticated callers cannot write rows. The verified body is kept only in the sealed
-- staging row until the worker processes it; receipts hold no payload, header, address
-- or body column.

CREATE TABLE integrations.crm_webhook_receipts (
    id uuid PRIMARY KEY,
    provider text NOT NULL CHECK (
        provider IN ('twilio', 'google', 'microsoft', 'meta', 'tiktok', 'stub')
    ),
    event_id text NOT NULL CHECK (char_length(event_id) BETWEEN 1 AND 200),
    workspace_id text NOT NULL,
    connection_id uuid NOT NULL REFERENCES integrations.crm_channel_connections (id),
    outcome text NOT NULL DEFAULT 'received' CHECK (
        outcome IN ('received', 'rejected', 'processed', 'failed')
    ),
    failure_code text CHECK (failure_code IS NULL OR failure_code ~ '^[a-z_]{1,40}$'),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
    lease_owner uuid,
    lease_expires_at timestamptz,
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
);

-- A replayed event is accepted but stored and processed once.
CREATE UNIQUE INDEX crm_webhook_receipts_event
    ON integrations.crm_webhook_receipts (provider, event_id);

CREATE INDEX crm_webhook_receipts_pending
    ON integrations.crm_webhook_receipts (received_at)
    WHERE outcome = 'received';

CREATE INDEX crm_webhook_receipts_purge
    ON integrations.crm_webhook_receipts (received_at);

-- The verified body, sealed with AES-256-GCM bound to the receipt. Deleted as soon as the
-- event is processed, and with its receipt by the 30-day purge.
CREATE TABLE integrations.crm_webhook_staging (
    receipt_id uuid PRIMARY KEY
        REFERENCES integrations.crm_webhook_receipts (id) ON DELETE CASCADE,
    payload_sealed bytea NOT NULL,
    key_version integer NOT NULL CHECK (key_version > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
