//! The worker's media sweep (packet F1): uploads never attached within 24 hours, and inbound
//! files still not stored after an hour (F3b), are hidden; hidden files leave storage. A storage failure is retried next round.
use super::s3;
use crate::{config::media_settings::MediaConfig, error::ApiResult};
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

const BATCH: i64 = 100;

pub async fn round(pool: &PgPool, config: &MediaConfig) -> ApiResult<()> {
    sqlx::query(
        "UPDATE media.crm_media_objects SET deleted_at=now() \
         WHERE deleted_at IS NULL AND ((owner_id IS NULL AND created_at<now()-interval '24 hours') \
           OR (storage_pending AND created_at<now()-interval '1 hour'))",
    )
    .execute(pool)
    .await?;
    // A hidden backfill reservation keeps its object for an hour, longer than the command's
    // put deadline, so a put landing late is still removed here (F2 backfill review L1).
    let due: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id,storage_key FROM media.crm_media_objects \
         WHERE deleted_at IS NOT NULL AND storage_removed_at IS NULL \
           AND NOT (origin='backfill' AND storage_pending AND created_at>now()-interval '1 hour') \
         ORDER BY deleted_at LIMIT $1",
    )
    .bind(BATCH)
    .fetch_all(pool)
    .await?;
    for (id, key) in due {
        if s3::delete(config, &key).await.is_ok() {
            sqlx::query("UPDATE media.crm_media_objects SET storage_removed_at=now() WHERE id=$1")
                .bind(id)
                .execute(pool)
                .await?;
        }
    }
    Ok(())
}

pub fn spawn(
    pool: PgPool,
    config: MediaConfig,
    every: Duration,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            if round(&pool, &config).await.is_err() {
                eprintln!("CRM media sweep failed.");
            }
            if crate::outbox::worker::pause(&mut shutdown, every).await {
                break;
            }
        }
    })
}
