//! Whether a member's company email address has been used (owner decision 2026-10-21):
//! an unused address may be removed, a used one is kept for ever. Used means any email the
//! member sent, or any conversation they were given, on the company's SendGrid
//! connections since the address was made. When unsure, it counts as used.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// `since` is the address's creation time as `YYYY-MM-DDTHH:MI:SSZ`.
pub async fn address_used(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    connections: &[Uuid],
    member: Uuid,
    since: &str,
) -> ApiResult<bool> {
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM inbox.crm_inbox_messages m \
           JOIN inbox.crm_inbox_conversations c ON c.id=m.conversation_id \
           WHERE c.workspace_id=$1 AND c.connection_id=ANY($2) \
             AND m.created_at >= $4::timestamptz - interval '1 second' \
             AND (m.author_user_id=$3 OR c.assignee_id=$3))",
    )
    .bind(workspace)
    .bind(connections)
    .bind(member)
    .bind(since)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}
