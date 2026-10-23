//! Snapshot rows (migration 0067): insert-only, one per listing and digest, so an unchanged
//! listing sent to a second agent reuses the same snapshot and its photo copies. The
//! location salt stays with the listing's snapshots, so an unchanged listing keeps its digest.
use super::{digest, snapshot::Draft};
use crate::{error::ApiResult, media::copies};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// The snapshot of this listing with this digest, if one was made before.
pub async fn existing(
    tx: &mut Tx<'_>,
    workspace: &str,
    record: Uuid,
    digest: &str,
) -> ApiResult<Option<Uuid>> {
    Ok(sqlx::query_scalar(
        "SELECT id FROM agreements.crm_listing_snapshots \
         WHERE workspace_id=$1 AND source_record_id=$2 AND digest=$3",
    )
    .bind(workspace)
    .bind(record)
    .bind(digest)
    .fetch_optional(&mut **tx)
    .await?)
}

/// The salt of this listing's latest snapshot that has one.
pub async fn salt_for(tx: &mut Tx<'_>, workspace: &str, record: Uuid) -> ApiResult<Option<String>> {
    Ok(sqlx::query_scalar(
        "SELECT location_salt FROM agreements.crm_listing_snapshots \
         WHERE workspace_id=$1 AND source_record_id=$2 AND location_salt IS NOT NULL \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(workspace)
    .bind(record)
    .fetch_optional(&mut **tx)
    .await?)
}

/// A new snapshot of `draft`, its media naming the stored copies (`copy` maps each source
/// file to its copy), which are attached to it here.
pub async fn insert(
    tx: &mut Tx<'_>,
    (workspace, record, actor): (&str, Uuid, Uuid),
    draft: &Draft,
    copy: &HashMap<Uuid, Uuid>,
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    let media: Vec<Value> = draft
        .files
        .iter()
        .map(|file| {
            json!({
                "kind": file.kind,
                "name": file.name,
                "file": copy.get(&file.source.id),
                "thumb": file.thumb.as_ref().and_then(|thumb| copy.get(&thumb.id)),
                "sha256": file.source.sha256,
            })
        })
        .collect();
    sqlx::query(
        "INSERT INTO agreements.crm_listing_snapshots (id,workspace_id,source_record_id, \
         reference,facts,media,exact_location,location_digest,location_salt,digest,scheme, \
         created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    )
    .bind(id)
    .bind(workspace)
    .bind(record)
    .bind(digest::reference())
    .bind(Value::Object(draft.facts.clone()))
    .bind(Value::Array(media))
    .bind(draft.exact)
    .bind(&draft.location)
    .bind(&draft.salt)
    .bind(&draft.digest)
    .bind(digest::SCHEME)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = copy.values().copied().collect();
    if !ids.is_empty() {
        copies::attach(tx, workspace, actor, &ids, id).await?;
    }
    Ok(id)
}
