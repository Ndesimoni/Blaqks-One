//! Copies of a listing's photos and floor plans for an outside share (migration 0069, R2
//! review amendment 3). A copy is reserved first as a tracked, unattached row with its own
//! key, counted in the company's bytes; then its bytes are copied and checked against the
//! source's SHA-256 and the row is marked stored; only stored copies are attached, in the
//! owning module's transaction (`copy_bytes.rs` moves the bytes). The sweep removes copies
//! left pending or unattached.
use super::upload::COMPANY_BYTES;
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

pub const KIND: &str = "listing_snapshot";
const BUSY: &str = "Photos from your last share are still being copied. Try again in a minute.";
const FULL: &str = "Your company's file space is full. Remove old files and try again.";
pub const FAILED: &str = "The photos could not be copied. Try again.";

/// A stored file of the source record, as the snapshot names it.
#[derive(Clone, Debug, FromRow)]
pub struct Source {
    pub id: Uuid,
    pub storage_key: String,
    pub content_type: String,
    pub byte_size: i32,
    pub sha256: String,
}

/// A reserved copy of `source`, under its own new key.
#[derive(Clone, Debug)]
pub struct Reserved {
    pub id: Uuid,
    pub key: String,
    pub source: Source,
}

/// The stored, visible files among `ids` that belong to `record` of `workspace`.
pub async fn sources(
    tx: &mut Tx<'_>,
    workspace: &str,
    record: Uuid,
    ids: &[Uuid],
) -> ApiResult<Vec<Source>> {
    Ok(sqlx::query_as(
        "SELECT id,storage_key,content_type,byte_size,sha256 FROM media.crm_media_objects \
         WHERE id=ANY($1) AND workspace_id=$2 AND owner_kind='record' AND owner_id=$3 \
           AND deleted_at IS NULL AND NOT storage_pending",
    )
    .bind(ids)
    .bind(workspace)
    .bind(record)
    .fetch_all(&mut **tx)
    .await?)
}

/// Reserves one copy per `(source, neutral name)`, under a per-member lock: one copy run per
/// member at a time, and never beyond the company's stored bytes.
pub async fn reserve(
    tx: &mut Tx<'_>,
    workspace: &str,
    actor: Uuid,
    plan: &[(Source, String)],
) -> ApiResult<Vec<Reserved>> {
    let (_, used, _) = super::store::usage(tx, workspace, actor).await?;
    let busy: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM media.crm_media_objects WHERE uploaded_by=$1 \
         AND origin='copy' AND storage_pending AND deleted_at IS NULL \
         AND created_at>now()-interval '1 hour')",
    )
    .bind(actor)
    .fetch_one(&mut **tx)
    .await?;
    if busy {
        return Err(ApiError(StatusCode::TOO_MANY_REQUESTS, BUSY, "media_busy"));
    }
    let adding: i64 = plan
        .iter()
        .map(|(source, _)| i64::from(source.byte_size))
        .sum();
    if used + adding > COMPANY_BYTES {
        return Err(ApiError(StatusCode::TOO_MANY_REQUESTS, FULL, "media_quota"));
    }
    let mut reserved = Vec::with_capacity(plan.len());
    for (source, name) in plan {
        let copy = Reserved {
            id: Uuid::new_v4(),
            key: Uuid::new_v4().simple().to_string(),
            source: source.clone(),
        };
        sqlx::query(
            "INSERT INTO media.crm_media_objects (id,workspace_id,uploaded_by,storage_key, \
             file_name,content_type,byte_size,sha256,origin,copied_from,storage_pending) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'copy',$9,true)",
        )
        .bind(copy.id)
        .bind(workspace)
        .bind(actor)
        .bind(&copy.key)
        .bind(name)
        .bind(&source.content_type)
        .bind(source.byte_size)
        .bind(&source.sha256)
        .bind(source.id)
        .execute(&mut **tx)
        .await?;
        reserved.push(copy);
    }
    Ok(reserved)
}

/// Attaches the actor's stored, unattached copies to `owner`; every ID must qualify.
pub async fn attach(
    tx: &mut Tx<'_>,
    workspace: &str,
    actor: Uuid,
    ids: &[Uuid],
    owner: Uuid,
) -> ApiResult<()> {
    let attached = sqlx::query(
        "UPDATE media.crm_media_objects SET owner_kind=$4,owner_id=$5,attached_at=now() \
         WHERE id=ANY($1) AND workspace_id=$2 AND uploaded_by=$3 AND origin='copy' \
           AND owner_id IS NULL AND NOT storage_pending AND deleted_at IS NULL",
    )
    .bind(ids)
    .bind(workspace)
    .bind(actor)
    .bind(KIND)
    .bind(owner)
    .execute(&mut **tx)
    .await?;
    if attached.rows_affected() != ids.len() as u64 {
        return Err(ApiError::conflict(FAILED));
    }
    Ok(())
}
