//! Storing reserved inbound files after the owning module's commit (packet F3b, review M1,
//! M4): one file at a time from the verified request body, cleaned again and checked against
//! its reserved fingerprint, within one deadline for the whole mail. A file that cannot be
//! stored in time is hidden and counted as not kept; the message itself is already saved.
use super::{inbound::Reserved, s3, sigv4::sha256_hex, sniff::clean};
use crate::config::media_settings::MediaConfig;
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

/// All of one mail's files must be stored within this time (F3 design).
const DEADLINE: Duration = Duration::from_secs(45);

/// Stores each reserved file; answers how many could not be kept.
pub async fn store_all(
    pool: &PgPool,
    config: &MediaConfig,
    body: &[u8],
    reserved: &[Reserved],
) -> usize {
    let mut stored: Vec<Uuid> = Vec::new();
    let work = async {
        for file in reserved {
            if store_one(pool, config, body, file).await {
                stored.push(file.id);
            }
        }
    };
    let _ = tokio::time::timeout(DEADLINE, work).await;
    let failed: Vec<Uuid> = reserved
        .iter()
        .map(|file| file.id)
        .filter(|id| !stored.contains(id))
        .collect();
    if !failed.is_empty() {
        // Hidden at once; the sweep removes anything that reached storage.
        let _ = sqlx::query(
            "UPDATE media.crm_media_objects SET deleted_at=now() \
             WHERE id=ANY($1) AND storage_pending",
        )
        .bind(&failed)
        .execute(pool)
        .await;
    }
    failed.len()
}

async fn store_one(pool: &PgPool, config: &MediaConfig, body: &[u8], file: &Reserved) -> bool {
    let prepared = &file.prepared;
    let Some(Ok(bytes)) = body
        .get(prepared.range.clone())
        .map(|raw| clean(prepared.kind, raw))
    else {
        return false;
    };
    if sha256_hex(&bytes) != prepared.sha256 {
        return false;
    }
    let content_type = prepared.kind.content_type();
    if s3::put_creating(config, &file.key, bytes, content_type)
        .await
        .is_err()
    {
        return false;
    }
    sqlx::query(
        "UPDATE media.crm_media_objects SET storage_pending=false \
         WHERE id=$1 AND storage_pending AND deleted_at IS NULL",
    )
    .bind(file.id)
    .execute(pool)
    .await
    .is_ok_and(|done| done.rows_affected() == 1)
}
