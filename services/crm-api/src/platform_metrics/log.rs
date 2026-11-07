//! Counts from the platform event log, for figures no other table keeps (sign-ins). The
//! log starts when BO1d ships, so these figures count from then.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};

/// Events named `event` on or after `since` (an Asia/Dubai day), outside the organisation.
pub async fn count(
    tx: &mut Transaction<'_, Postgres>,
    organisation: &str,
    event: &str,
    since: &str,
) -> ApiResult<i64> {
    sqlx::query_scalar(
        "SELECT count(*) FROM platform_metrics.crm_platform_events \
         WHERE event=$2 AND COALESCE(workspace_id,'')<>$1 \
         AND occurred_at>=(($3::date)::timestamp AT TIME ZONE 'Asia/Dubai')",
    )
    .bind(organisation)
    .bind(event)
    .bind(since)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}
