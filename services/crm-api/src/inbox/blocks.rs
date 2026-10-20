//! Blocking (design §4): the Admin or the conversation's assignee blocks the sender, whose
//! later messages are dropped before any row is written; only the Admin unblocks.
use super::change;
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;

type Body = Result<Json<Value>, JsonRejection>;

fn version(body: Body) -> ApiResult<i64> {
    let Json(value) = body.map_err(|_| ApiError::invalid(change::INVALID))?;
    Ok(change::fields(value, &[])?.0)
}

/// `POST …/block {expectedVersion}`.
pub async fn block(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Body,
) -> ApiResult<Json<Value>> {
    let version = version(body)?;
    let mut lk = change::begin(&state, &session, &headers, workspace, &id, version).await?;
    if !lk.viewer.manager && lk.row.assignee_id != Some(lk.viewer.id) {
        return Err(ApiError::forbidden());
    }
    if lk.row.state == "spam" {
        return Err(ApiError::conflict("This sender is already blocked."));
    }
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_blocks (workspace_id,channel,contact_key,created_by) \
         SELECT workspace_id,channel,contact_key,$2 FROM inbox.crm_inbox_conversations \
         WHERE id=$1 ON CONFLICT DO NOTHING",
    )
    .bind(lk.id())
    .bind(lk.viewer.id)
    .execute(&mut *lk.tx)
    .await?;
    sqlx::query(
        "UPDATE inbox.crm_inbox_conversations SET state='spam',suggested_lead=false, \
           version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(lk.id())
    .execute(&mut *lk.tx)
    .await?;
    lk.event("blocked").await?;
    lk.finish().await
}

/// `POST …/unblock {expectedVersion}`: the Admin lifts the block; the conversation stays
/// resolved until the sender writes again.
pub async fn unblock(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Body,
) -> ApiResult<Json<Value>> {
    let version = version(body)?;
    let mut lk = change::begin(&state, &session, &headers, workspace, &id, version).await?;
    if !lk.viewer.manager {
        return Err(ApiError::forbidden());
    }
    sqlx::query(
        "DELETE FROM inbox.crm_inbox_blocks b USING inbox.crm_inbox_conversations c \
         WHERE c.id=$1 AND b.workspace_id=c.workspace_id AND b.channel=c.channel \
           AND b.contact_key=c.contact_key",
    )
    .bind(lk.id())
    .execute(&mut *lk.tx)
    .await?;
    sqlx::query(
        "UPDATE inbox.crm_inbox_conversations SET \
           state=CASE WHEN state='spam' THEN 'resolved' ELSE state END, \
           version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(lk.id())
    .execute(&mut *lk.tx)
    .await?;
    lk.event("unblocked").await?;
    lk.finish().await
}
