//! Completion and two-party cancellation (docs/agreements-a3b.md); archiving is in
//! `archive.rs`.
use super::{command, ledger, model::Party};
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
use serde_json::{json, Value};

async fn close(
    state: AppState,
    session: Session,
    headers: HeaderMap,
    path: (String, String),
    body: Result<Json<Value>, JsonRejection>,
    complete: bool,
) -> ApiResult<Json<Value>> {
    let mut cmd = command::begin(
        &state,
        &session,
        &headers,
        &path.0,
        &path.1,
        body,
        &["expectedVersion"],
    )
    .await?;
    if cmd.row.state != "accepted" {
        return Err(ApiError::conflict(
            "Only accepted agreements can take this action.",
        ));
    }
    let sender = cmd.party == Party::Sender;
    let own = if sender {
        cmd.row.cancel_sender_revision_id
    } else {
        cmd.row.cancel_recipient_revision_id
    };
    let other = if sender {
        cmd.row.cancel_recipient_revision_id
    } else {
        cmd.row.cancel_sender_revision_id
    };
    if !complete && own.is_some() {
        return Err(ApiError::conflict("Cancellation is already requested."));
    }
    let cancelled = !complete && other == cmd.row.current_revision_id;
    let next = if complete {
        "completed"
    } else if cancelled {
        "cancelled"
    } else {
        "accepted"
    };
    let version = sqlx::query_scalar::<_, i64>(
        "UPDATE agreements.crm_agreements SET state=$2,proposed_revision_id=CASE WHEN $3 THEN NULL
         ELSE proposed_revision_id END,cancel_sender_revision_id=CASE WHEN $4 THEN NULL
         WHEN $5 THEN current_revision_id ELSE cancel_sender_revision_id END,
         cancel_recipient_revision_id=CASE WHEN $4 THEN NULL WHEN NOT $5 THEN current_revision_id
         ELSE cancel_recipient_revision_id END,version=version+1,updated_at=now()
         WHERE id=$1 RETURNING version",
    )
    .bind(cmd.row.id)
    .bind(next)
    .bind(complete || cancelled)
    .bind(complete)
    .bind(sender)
    .fetch_one(&mut *cmd.tx)
    .await?;
    let action = if complete {
        "completed"
    } else if cancelled {
        "cancelled"
    } else {
        "cancel_requested"
    };
    ledger::event(
        &mut cmd.tx,
        cmd.row.id,
        cmd.row.current_revision_id,
        action,
        cmd.actor,
        cmd.party,
    )
    .await?;
    cmd.commit(next, version, json!({})).await
}
pub async fn complete(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    close(state, session, headers, path, body, true).await
}
pub async fn cancel(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    close(state, session, headers, path, body, false).await
}
