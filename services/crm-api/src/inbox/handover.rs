//! A deal hand-over that moves the client also moves the client's conversations the
//! sender holds (agreements design §18; owner, 2026-10-22: the receiver texts the client
//! and receives the replies). Each move steps the conversation's version and writes a
//! redacted `assigned` event, as a manual reassignment does.
use super::events;
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Moves the conversations linked to client record `client` from `from` to `to`; returns
/// how many moved.
pub async fn follow_client(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    client: Uuid,
    (from, to): (Uuid, Uuid),
    actor: Uuid,
) -> ApiResult<usize> {
    let moved: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE inbox.crm_inbox_conversations SET assignee_id=$4,version=version+1, \
         updated_at=now() WHERE workspace_id=$1 AND linked_collection='Clients' \
         AND linked_record_id=$2 AND assignee_id=$3 RETURNING id",
    )
    .bind(workspace)
    .bind(client)
    .bind(from)
    .bind(to)
    .fetch_all(&mut **tx)
    .await?;
    for conversation in &moved {
        events::append(tx, workspace, *conversation, Some(actor), "assigned").await?;
    }
    Ok(moved.len())
}
