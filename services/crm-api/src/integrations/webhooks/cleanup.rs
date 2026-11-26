//! Retention (design §9): webhook receipts are kept for 30 days; their sealed staging rows
//! cascade with them.
use crate::error::ApiResult;
use sqlx::PgPool;

pub const RETENTION_DAYS: i32 = 30;

pub async fn purge(pool: &PgPool) -> ApiResult<u64> {
    let deleted = sqlx::query(
        "DELETE FROM integrations.crm_webhook_receipts \
         WHERE received_at<now()-make_interval(days=>$1)",
    )
    .bind(RETENTION_DAYS)
    .execute(pool)
    .await?
    .rows_affected();
    Ok(deleted)
}
