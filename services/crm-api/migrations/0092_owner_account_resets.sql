-- Owner module: auth (services/crm-api/src/auth, docs/service-boundaries.md).
-- BO1b (docs/blaqks-one-console.md §8): the Blaqks One Owner signs a team member out or
-- resets their password without seeing it. Both are account events with the Owner as the
-- actor and the member as the account; never the password, link or token. Never edit
-- after release.
ALTER TABLE crm_account_events DROP CONSTRAINT crm_account_events_action_check;
ALTER TABLE crm_account_events ADD CONSTRAINT crm_account_events_action_check CHECK (action IN (
    'profile_updated', 'password_changed', 'sessions_revoked', 'session_revoked', 'signed_up',
    'password_reset'));
