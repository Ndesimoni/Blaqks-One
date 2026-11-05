-- Owner module: sample (services/crm-api/src/sample, development only, coupling C12).
-- Blaqks One sample data (`seed-platform-sample`): the clients, help requests and team chat
-- rows the command added, so `clear-platform-sample` touches exactly those. Plain IDs without
-- foreign keys into the owning schemas. Never edit after release.
CREATE TABLE crm_sample_platform (
    entity text NOT NULL CHECK (entity IN ('client', 'help_request', 'chat_message', 'chat_room')),
    id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- Set by `clear-platform-sample`; a later seed adds a fresh set.
    cleared_at timestamptz,
    PRIMARY KEY (entity, id)
);
