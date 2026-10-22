//! Files moved out of record JSON by the trusted `media-backfill` command (docs/media-storage.md,
//! "F2 backfill as built"). Bytes are checked and cleaned exactly like uploads. Rows are
//! reserved first (attached to their owner, not yet stored, origin `backfill`) and committed
//! before any bytes are put; only the owner's own transaction marks them stored. A failed or
//! skipped commit therefore leaves nothing visible, and the sweep removes whatever reached
//! storage. Media still never learns what the owner is or what its record says.
use super::{
    naming::{plain_name, typed_name},
    s3,
    sigv4::sha256_hex,
    sniff::{clean, detect, Kind},
};
use crate::{config::media_settings::MediaConfig, error::ApiResult};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// Why a file cannot be stored; the owning module leaves it where it was.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Refusal {
    /// Not a JPEG, PNG, WebP or PDF by its first bytes.
    Unsupported,
    /// Over 10 MB (photos) or 20 MB (PDFs), as for uploads.
    TooLarge,
    /// The type is known but the file is malformed, so metadata cannot be removed.
    Unreadable,
}

/// A file ready to store: its real type, metadata removed, display name typed.
pub struct Prepared {
    pub name: String,
    pub kind: Kind,
    pub bytes: Vec<u8>,
}

pub fn prepare(name: &str, bytes: &[u8]) -> Result<Prepared, Refusal> {
    let kind = detect(bytes).ok_or(Refusal::Unsupported)?;
    if bytes.len() > kind.max_bytes() {
        return Err(Refusal::TooLarge);
    }
    let bytes = clean(kind, bytes).map_err(|_| Refusal::Unreadable)?;
    Ok(Prepared {
        name: typed_name(&plain_name(name), kind.content_type()),
        kind,
        bytes,
    })
}

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

/// Commits one row per file, attached to the owner and marked not yet stored, before any
/// bytes are put. Returns each file's ID and storage key, in order.
pub async fn reserve(
    pool: &PgPool,
    workspace: &str,
    uploader: Uuid,
    (kind, owner): (&str, Uuid),
    files: &[&Prepared],
) -> ApiResult<Vec<(Uuid, String)>> {
    let mut tx = pool.begin().await?;
    let mut reserved = Vec::with_capacity(files.len());
    for file in files {
        let (id, key) = (Uuid::new_v4(), Uuid::new_v4().simple().to_string());
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
        .bind(sha256_hex(&file.bytes))
        .bind(kind)
        .bind(owner)
        .execute(&mut *tx)
        .await?;
        reserved.push((id, key));
    }
    tx.commit().await?;
    Ok(reserved)
}

/// Puts one reserved file's bytes; false when storage refuses or is unreachable.
pub async fn put(config: &MediaConfig, key: &str, kind: Kind, bytes: Vec<u8>) -> bool {
    s3::put_creating(config, key, bytes, kind.content_type())
        .await
        .is_ok()
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
