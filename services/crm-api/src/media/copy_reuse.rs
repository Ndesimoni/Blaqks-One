//! Reusing stored copies (R2a security review M4): a listing shared again after an edit
//! names the copies its earlier snapshots already hold for the same source files, so only
//! new files are copied and counted against the company's bytes. A copy may then serve
//! several snapshots of one listing; a future retention job keeps it while any of them is
//! kept. The owning module says which snapshots belong to the listing.
use super::copies::{Source, KIND};
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

/// Source file → a stored copy of it with the same SHA-256, held by one of `snapshots`.
pub async fn reusable(
    tx: &mut Tx<'_>,
    workspace: &str,
    snapshots: &[Uuid],
    sources: &[Source],
) -> ApiResult<HashMap<Uuid, Uuid>> {
    if snapshots.is_empty() || sources.is_empty() {
        return Ok(HashMap::new());
    }
    let ids: Vec<Uuid> = sources.iter().map(|source| source.id).collect();
    let rows: Vec<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT DISTINCT ON (copied_from) copied_from,id,sha256 FROM media.crm_media_objects \
         WHERE workspace_id=$1 AND origin='copy' AND owner_kind=$2 AND owner_id=ANY($3) \
           AND copied_from=ANY($4) AND deleted_at IS NULL AND NOT storage_pending \
         ORDER BY copied_from,created_at DESC",
    )
    .bind(workspace)
    .bind(KIND)
    .bind(snapshots)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    let sha: HashMap<Uuid, &str> = sources
        .iter()
        .map(|source| (source.id, source.sha256.as_str()))
        .collect();
    Ok(rows
        .into_iter()
        .filter(|(from, _, hash)| sha.get(from) == Some(&hash.as_str()))
        .map(|(from, id, _)| (from, id))
        .collect())
}

/// The snapshot holding stored copy `file` of `workspace`, if there is one.
pub async fn holder(tx: &mut Tx<'_>, workspace: &str, file: Uuid) -> ApiResult<Option<Uuid>> {
    let found: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT owner_id FROM media.crm_media_objects WHERE id=$1 AND workspace_id=$2 \
         AND origin='copy' AND owner_kind=$3 AND deleted_at IS NULL AND NOT storage_pending",
    )
    .bind(file)
    .bind(workspace)
    .bind(KIND)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(found.flatten())
}
