//! Retention (design §9): finished jobs and their attempts are kept for 30 days.
use crate::error::ApiResult;
use sqlx::PgPool;

pub const RETENTION_DAYS: i32 = 30;

/// Deletes jobs that reached `done`, `failed` or `unknown` more than [`RETENTION_DAYS`] ago;
/// attempts cascade. Pending and leased jobs are never touched.
pub async fn purge(pool: &PgPool) -> ApiResult<u64> {
    let deleted = sqlx::query(
        "DELETE FROM outbox.crm_outbox_jobs \
         WHERE finished_at IS NOT NULL AND finished_at<now()-make_interval(days=>$1)",
    )
    .bind(RETENTION_DAYS)
    .execute(pool)
    .await?
    .rows_affected();
    Ok(deleted)
}
