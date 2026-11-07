//! Redacted, insert-only Inbox history: conversation ID, actor (none for the system),
//! action and time. Never a body, address, name or provider payload.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn append(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    conversation: Uuid,
    actor: Option<Uuid>,
    action: &str,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_events (id,workspace_id,conversation_id,actor_id,action) \
         VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(conversation)
    .bind(actor)
    .bind(action)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
