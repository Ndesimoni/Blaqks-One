//! SQL for stored files (migration 0042): upload bookkeeping. What owning modules call is
//! in `owned.rs`; nothing else touches the table.
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

#[derive(Clone, Debug, FromRow)]
pub struct Item {
    pub id: Uuid,
    pub name: String,
    pub content_type: String,
    pub size: i32,
}

impl Item {
    pub fn view(&self) -> Value {
        json!({"id": self.id, "name": self.name, "contentType": self.content_type,
            "size": self.size})
    }
}

#[derive(FromRow)]
pub struct Stored {
    pub storage_key: String,
    pub file_name: String,
    pub content_type: String,
}

pub const ITEM: &str = "id,file_name AS name,content_type,byte_size AS size";

/// Uploads by `member` in the last hour, the company's stored bytes, and the member's
/// pending (not yet attached) bytes. Counted under a per-member lock, so two parallel
/// uploads cannot both pass the limits (security review F1 M2).
pub async fn usage(tx: &mut Tx<'_>, workspace: &str, member: Uuid) -> ApiResult<(i64, i64, i64)> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 7))")
        .bind(member.to_string())
        .execute(&mut **tx)
        .await?;
    sqlx::query_as(
        "SELECT (SELECT count(*) FROM media.crm_media_objects \
           WHERE uploaded_by=$2 AND origin='upload' AND created_at>now()-interval '1 hour'), \
         (SELECT coalesce(sum(byte_size),0)::bigint FROM media.crm_media_objects \
           WHERE workspace_id=$1 AND deleted_at IS NULL), \
         (SELECT coalesce(sum(byte_size),0)::bigint FROM media.crm_media_objects \
           WHERE uploaded_by=$2 AND origin='upload' AND owner_id IS NULL AND deleted_at IS NULL)",
    )
    .bind(workspace)
    .bind(member)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

pub async fn insert(
    tx: &mut Tx<'_>,
    workspace: &str,
    uploader: Uuid,
    key: &str,
    item: &Item,
    bytes: &[u8],
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO media.crm_media_objects \
         (id,workspace_id,uploaded_by,storage_key,file_name,content_type,byte_size,sha256) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    )
    .bind(item.id)
    .bind(workspace)
    .bind(uploader)
    .bind(key)
    .bind(&item.name)
    .bind(&item.content_type)
    .bind(item.size)
    .bind(super::sigv4::sha256_hex(bytes))
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// A failed store: hide the row; the sweep removes whatever may have been written.
pub async fn discard(pool: &PgPool, id: Uuid) -> ApiResult<()> {
    sqlx::query("UPDATE media.crm_media_objects SET deleted_at=now() WHERE id=$1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
