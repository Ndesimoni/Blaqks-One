CREATE TABLE crm_users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super-admin', 'admin')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_super_admin ON crm_users ((role)) WHERE role = 'super-admin';

CREATE TABLE crm_workspaces (
    id TEXT PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES crm_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crm_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES crm_users(id),
    csrf_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crm_session_expiry ON crm_sessions(expires_at);

CREATE TABLE crm_login_limits (
    key_hash TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL CHECK (attempts > 0),
    window_started TIMESTAMPTZ NOT NULL DEFAULT now()
);
