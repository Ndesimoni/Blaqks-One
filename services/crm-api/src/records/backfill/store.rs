//! The backfill's SQL on `crm_records`: property records that still hold an inline media
//! entry, one record's media fields, and the media-only rewrite with its version check.
use super::plan::{PHOTOS, PLANS};
use crate::{error::ApiResult, media::backfill as media, records::media_links::KIND, workspaces};
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// Property records with at least one entry carrying `src` in either media field.
const INLINE: &str = "collection='Properties' AND \
     (jsonb_path_exists(payload,'$.media_photos[*].src') \
      OR jsonb_path_exists(payload,'$.media_floorplans[*].src'))";

/// Workspaces holding such records, in a stable order.
pub async fn workspaces(pool: &PgPool) -> ApiResult<Vec<String>> {
    sqlx::query_scalar(&format!(
        "SELECT DISTINCT workspace_id FROM crm_records WHERE {INLINE} ORDER BY workspace_id"
    ))
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// One workspace's such records, oldest first. IDs only: payloads load one at a time.
pub async fn candidates(pool: &PgPool, workspace: &str) -> ApiResult<Vec<Uuid>> {
    sqlx::query_scalar(&format!(
        "SELECT id FROM crm_records WHERE workspace_id=$1 AND {INLINE} ORDER BY created_at,id"
    ))
    .bind(workspace)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// A record's version and its two media fields (nothing else of the payload is read).
#[derive(FromRow)]
pub struct Current {
    pub id: Uuid,
    pub version: i64,
    pub photos: Option<Value>,
    pub plans: Option<Value>,
}

impl Current {
    pub fn fields(&self) -> [(&'static str, Option<Value>); 2] {
        [(PHOTOS, self.photos.clone()), (PLANS, self.plans.clone())]
    }
}

/// `None` when the record was deleted meanwhile.
pub async fn load(pool: &PgPool, workspace: &str, id: Uuid) -> ApiResult<Option<Current>> {
    sqlx::query_as(
        "SELECT id,version,payload->'media_photos' AS photos,payload->'media_floorplans' AS plans \
         FROM crm_records WHERE id=$1 AND workspace_id=$2 AND collection='Properties'",
    )
    .bind(id)
    .bind(workspace)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

#[derive(Debug, PartialEq, Eq)]
pub enum Committed {
    Done,
    /// The record (or one of its reserved files) changed after it was read.
    Stale,
    /// The workspace was archived meanwhile, which freezes it.
    Frozen,
    /// With this record's files the company would be over its storage cap (review L3).
    OverQuota,
}

/// In the record's own transaction, under the workspace lock: replaces only the changed media
/// fields when the version is still the one read and the company stays within its cap with
/// the reserved files counted, bumps the version and makes the files visible. Anything else
/// rolls back with nothing changed.
pub async fn commit(
    pool: &PgPool,
    workspace: &str,
    record: &Current,
    media_fields: &Value,
    files: &[Uuid],
) -> ApiResult<Committed> {
    let mut tx = pool.begin().await?;
    workspaces::lock(&mut tx, workspace).await?;
    if workspaces::frozen(&mut tx, workspace).await? {
        return Ok(Committed::Frozen);
    }
    if !media::within_cap(&mut tx, workspace).await? {
        return Ok(Committed::OverQuota);
    }
    let updated = sqlx::query(
        "UPDATE crm_records SET payload=payload || $1,version=version+1,updated_at=now() \
         WHERE id=$2 AND workspace_id=$3 AND collection='Properties' AND version=$4",
    )
    .bind(media_fields)
    .bind(record.id)
    .bind(workspace)
    .bind(record.version)
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() != 1 || !media::confirm(&mut tx, (KIND, record.id), files).await? {
        return Ok(Committed::Stale);
    }
    tx.commit().await?;
    Ok(Committed::Done)
}
