-- Owner module: signup (docs/service-boundaries.md); local-development packet S4.
-- Pending requests store only browser-handle and verification-code digests. The
-- local-development outbox temporarily carries the code for delivery and testing.
CREATE TABLE crm_signup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_hash TEXT NOT NULL UNIQUE CHECK (char_length(ticket_hash) = 64),
    email TEXT NOT NULL CHECK (
        email = lower(email) AND char_length(email) BETWEEN 3 AND 254),
    existing_account BOOLEAN NOT NULL,
    notice_kind TEXT CHECK (notice_kind IN (
        'existing_account', 'invitation_pending', 'email_unavailable')),
    account_type TEXT NOT NULL CHECK (account_type IN ('brokerage', 'individual')),
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 8 AND 16),
    password_hash TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('en', 'ar')),
    terms_version TEXT NOT NULL CHECK (char_length(terms_version) BETWEEN 1 AND 100),
    privacy_version TEXT NOT NULL CHECK (char_length(privacy_version) BETWEEN 1 AND 100),
    consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    code_hash TEXT NOT NULL CHECK (char_length(code_hash) = 64),
    code_expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes',
    code_attempts INTEGER NOT NULL DEFAULT 0 CHECK (code_attempts BETWEEN 0 AND 5),
    total_attempts INTEGER NOT NULL DEFAULT 0 CHECK (total_attempts BETWEEN 0 AND 10),
    sends INTEGER NOT NULL DEFAULT 1 CHECK (sends BETWEEN 1 AND 5),
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 minutes',
    CONSTRAINT crm_signup_notice_shape CHECK (
        (existing_account AND notice_kind IS NOT NULL)
        OR (NOT existing_account AND notice_kind IS NULL)),
    CONSTRAINT crm_signup_expiry_order CHECK (
        code_expires_at <= expires_at AND created_at < expires_at)
);

CREATE INDEX crm_signup_requests_email ON crm_signup_requests(email);
CREATE INDEX crm_signup_requests_expiry ON crm_signup_requests(expires_at);

CREATE TABLE crm_signup_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES crm_signup_requests(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN (
        'code', 'existing_account', 'invitation_pending', 'email_unavailable')),
    code TEXT CHECK (code ~ '^[0-9]{6}$'),
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel = 'email'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ,
    CONSTRAINT crm_signup_outbox_code_shape CHECK (
        (kind = 'code' AND code IS NOT NULL) OR (kind <> 'code' AND code IS NULL))
);

CREATE INDEX crm_signup_outbox_request ON crm_signup_outbox(request_id, created_at);
CREATE INDEX crm_signup_outbox_expiry ON crm_signup_outbox(created_at);
