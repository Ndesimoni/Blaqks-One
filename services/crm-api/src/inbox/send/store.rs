//! SQL for queuing outbound email: the conversation's sending details and the queued
//! message with its outbox job, committed together (design §5).
use crate::{error::ApiResult, outbox::enqueue::enqueue};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

pub const STAMP: &str =
    "to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";

#[derive(FromRow)]
pub struct Thread {
    pub channel: String,
    pub connection_id: Uuid,
    pub state: String,
    pub blocked: bool,
}

/// Sending details of a conversation the caller has already loaded (and locked).
pub async fn thread(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<Thread> {
    sqlx::query_as(
        "SELECT c.channel,c.connection_id,c.state,EXISTS (SELECT 1 FROM inbox.crm_inbox_blocks b \
           WHERE b.workspace_id=c.workspace_id AND b.channel=c.channel \
             AND b.contact_key=c.contact_key) AS blocked \
         FROM inbox.crm_inbox_conversations c WHERE c.id=$1",
    )
    .bind(id)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Queues one outbound message and its job, and moves the conversation to Waiting.
pub async fn queue(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    conversation: Uuid,
    author: Uuid,
    body: &str,
    repeat_of: Option<Uuid>,
) -> ApiResult<serde_json::Value> {
    let id = Uuid::new_v4();
    let at: String = sqlx::query_scalar(&format!(
        "INSERT INTO inbox.crm_inbox_messages \
         (id,conversation_id,workspace_id,direction,status,author_user_id,body,repeat_of) \
         VALUES ($1,$2,$3,'outbound','queued',$4,$5,$6) RETURNING {STAMP}"
    ))
    .bind(id)
    .bind(conversation)
    .bind(workspace)
    .bind(author)
    .bind(body)
    .bind(repeat_of)
    .fetch_one(&mut **tx)
    .await?;
    enqueue(tx, workspace, "inbox", id).await?;
    sqlx::query(
        "UPDATE inbox.crm_inbox_conversations SET last_activity_at=now(),updated_at=now(), \
           state=CASE WHEN state IN ('new','open','resolved') THEN 'waiting' ELSE state END, \
           version=version+1 WHERE id=$1",
    )
    .bind(conversation)
    .execute(&mut **tx)
    .await?;
    Ok(serde_json::json!({
        "id": id, "direction": "outbound", "status": "queued", "body": body,
        "hasMedia": false, "authorId": author, "failureReason": null, "at": at,
        "repeatOf": repeat_of,
    }))
}
