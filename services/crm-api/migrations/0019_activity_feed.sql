-- Owner modules: records (crm_activity) and team (crm_team_activity); read by the
-- activity feed module (services/crm-api/src/activity, docs/team-activity-design.md).
-- Indexes only: no schema or content changes, and the append-only triggers are unchanged.
-- The feed pages by (created_at DESC, id DESC) within one workspace and optionally one
-- actor. On a hosted database, create these indexes CONCURRENTLY outside a transaction
-- before applying this migration. Never edit after release.
CREATE INDEX IF NOT EXISTS crm_activity_feed
    ON crm_activity(workspace_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS crm_activity_actor_feed
    ON crm_activity(workspace_id, actor_id, created_at DESC, id DESC);
-- Replaced by crm_activity_feed, which covers the same leading columns.
DROP INDEX IF EXISTS crm_activity_workspace;
CREATE INDEX IF NOT EXISTS crm_team_activity_feed
    ON crm_team_activity(workspace_id, created_at DESC, id DESC);
