//! The backfill's rows in `media.crm_media_objects`: company usage, reservation before any
//! bytes are put, confirmation inside the owner's transaction and hiding what was not kept.
use super::Prepared;
use crate::{error::ApiResult, media::upload::COMPANY_BYTES};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// The company's stored bytes now (the cap is `upload::COMPANY_BYTES`).
pub async fn used(pool: &PgPool, workspace: &str) -> ApiResult<i64> {
    sqlx::query_scalar(
        "SELECT coalesce(sum(byte_size),0)::bigint FROM media.crm_media_objects \
         WHERE workspace_id=$1 AND deleted_at IS NULL",
    )
    .bind(workspace)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

/// Inside the owner's transaction, after its reserved rows exist: whether the company is
/// still within its cap with them counted (security review L3).
pub async fn within_cap(tx: &mut Transaction<'_, Postgres>, workspace: &str) -> ApiResult<bool> {
    sqlx::query_scalar(
        "SELECT coalesce(sum(byte_size),0)::bigint<=$2 FROM media.crm_media_objects \
         WHERE workspace_id=$1 AND deleted_at IS NULL",
    )
    .bind(workspace)
    .bind(COMPANY_BYTES)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Commits one row per file under the ID the owner chose, attached to the owner and marked
/// not yet stored, before any bytes are put. Returns each file's storage key, in order.
pub async fn reserve(
    pool: &PgPool,
    workspace: &str,
    uploader: Uuid,
    (kind, owner): (&str, Uuid),
    files: &[(Uuid, &Prepared)],
) -> ApiResult<Vec<String>> {
    let mut tx = pool.begin().await?;
    let mut keys = Vec::with_capacity(files.len());
    for (id, file) in files {
        let key = Uuid::new_v4().simple().to_string();
        sqlx::query(
            "INSERT INTO media.crm_media_objects (id,workspace_id,uploaded_by,storage_key, \
               file_name,content_type,byte_size,sha256,owner_kind,owner_id,attached_at,origin, \
               storage_pending) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),'backfill',true)",
        )
        .bind(id)
        .bind(workspace)
        .bind(uploader)
        .bind(&key)
        .bind(&file.name)
        .bind(file.kind.content_type())
        .bind(i32::try_from(file.bytes.len()).unwrap_or(i32::MAX))
        .bind(&file.sha256)
        .bind(kind)
        .bind(owner)
        .execute(&mut *tx)
        .await?;
        keys.push(key);
    }
    tx.commit().await?;
    Ok(keys)
}

/// Inside the owner's own transaction: the reserved files become visible. False when any
/// of them was hidden meanwhile (the owner was saved or deleted), so the caller rolls back.
pub async fn confirm(
    tx: &mut Transaction<'_, Postgres>,
    (kind, owner): (&str, Uuid),
    ids: &[Uuid],
) -> ApiResult<bool> {
    let done = sqlx::query(
        "UPDATE media.crm_media_objects SET storage_pending=false \
         WHERE id=ANY($1) AND owner_kind=$2 AND owner_id=$3 AND origin='backfill' \
           AND storage_pending AND deleted_at IS NULL",
    )
    .bind(ids)
    .bind(kind)
    .bind(owner)
    .execute(&mut **tx)
    .await?;
    Ok(done.rows_affected() == ids.len() as u64)
}

/// Hides reserved files that were never confirmed; the sweep removes their objects.
pub async fn discard(pool: &PgPool, ids: &[Uuid]) -> ApiResult<()> {
    sqlx::query(
        "UPDATE media.crm_media_objects SET deleted_at=now() \
         WHERE id=ANY($1) AND origin='backfill' AND storage_pending AND deleted_at IS NULL",
    )
    .bind(ids)
    .execute(pool)
    .await?;
    Ok(())
}
