-- Marks this PostgreSQL database as the local Docker development (or disposable test)
-- database, the only kind `seed-sample` / `clear-sample` will write to. It is not a
-- migration: the Docker compose init script applies it to new local volumes and
-- `npm run db:mark-dev` applies it inside the local compose container. Idempotent.
-- Never apply it to a hosted or shared database.
CREATE TABLE IF NOT EXISTS crm_environment (
    name TEXT PRIMARY KEY CHECK (name = 'local-development'),
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO crm_environment (name) VALUES ('local-development') ON CONFLICT DO NOTHING;
