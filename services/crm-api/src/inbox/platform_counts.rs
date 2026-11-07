//! Emails and WhatsApp messages sent, for Blaqks One's dashboard (BO1d,
//! docs/blaqks-one-console.md §3 item 4): counts only, never a body or an address. Sent
//! means a member sent it (queued or further), not a draft and not a failed send.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};

/// Emails and WhatsApp messages sent on or after `since` (an Asia/Dubai day).
pub async fn sent(
    tx: &mut Transaction<'_, Postgres>,
    organisation: &str,
    since: &str,
) -> ApiResult<(i64, i64)> {
    sqlx::query_as(
        "SELECT count(*) FILTER (WHERE c.channel='email'), \
         count(*) FILTER (WHERE c.channel='whatsapp') \
         FROM inbox.crm_inbox_messages m \
         JOIN inbox.crm_inbox_conversations c ON c.id=m.conversation_id \
         WHERE m.direction='outbound' AND m.status NOT IN ('draft','failed') \
         AND m.workspace_id<>$1 \
         AND m.created_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai')",
    )
    .bind(organisation)
    .bind(since)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}
