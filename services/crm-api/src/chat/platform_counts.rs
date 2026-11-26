//! Team chat messages sent, for Blaqks One's dashboard (BO1d, docs/blaqks-one-console.md
//! §3 item 4): a count only; bodies never leave the schema. Deleted messages were still sent.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};

/// Messages sent on or after `since` (an Asia/Dubai day), outside the organisation.
pub async fn sent(
    tx: &mut Transaction<'_, Postgres>,
    organisation: &str,
    since: &str,
) -> ApiResult<i64> {
    sqlx::query_scalar(
        "SELECT count(*) FROM chat.crm_chat_messages WHERE workspace_id<>$1 \
         AND created_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai')",
    )
    .bind(organisation)
    .bind(since)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}
