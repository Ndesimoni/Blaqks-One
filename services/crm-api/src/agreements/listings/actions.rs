//! Deciding and ending a listing share: the agent accepts (acknowledging the introduction)
//! or declines, optionally "I already know this listing"; the sender or the sending
//! company's Admin withdraws a pending share or stops an accepted one. Each runs under the
//! caller's own workspace lock, then the share row; nobody acts for the agent.
use super::{
    access::Viewer,
    digest::{self, ShareFacts},
    step::{begin, close, NOT_WAITING},
    store,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;

pub async fn accept(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let mut step = begin(&state, &session, &headers, path, Viewer::Agent).await?;
    if step.row.status != "pending" {
        return step.refuse(NOT_WAITING).await;
    }
    let row = &step.row;
    let acknowledged = digest::share(&ShareFacts {
        id: row.id,
        snapshot: &row.snapshot_digest,
        sender: (&row.workspace_id, row.from_id),
        recipient: (&row.recipient_workspace_id, row.to_id),
        sent_at: &row.created_at,
        view_ends_at: &row.view_ends_at,
        note: row.note.as_deref(),
    });
    sqlx::query(
        "UPDATE agreements.crm_listing_shares SET status='accepted',decided_at=now(), \
         accepted_digest=$2 WHERE id=$1",
    )
    .bind(step.row.id)
    .bind(acknowledged)
    .execute(&mut *step.tx)
    .await?;
    let by = Some((step.actor, "recipient"));
    store::event(&mut step.tx, step.row.id, "accepted", by, (None, None)).await?;
    step.finish().await
}

pub async fn decline(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Bytes,
) -> ApiResult<Json<Value>> {
    let invalid = || ApiError::invalid("Send nothing, or whether you already know this listing.");
    let known = match body.is_empty() {
        true => false,
        false => {
            let value: Value = serde_json::from_slice(&body).map_err(|_| invalid())?;
            let map = value
                .as_object()
                .filter(|map| map.keys().all(|key| key == "alreadyKnown"));
            let known = map.ok_or_else(invalid)?.get("alreadyKnown").cloned();
            known.map_or(Ok(false), |value| value.as_bool().ok_or_else(invalid))?
        }
    };
    let mut step = begin(&state, &session, &headers, path, Viewer::Agent).await?;
    if step.row.status != "pending" {
        return step.refuse(NOT_WAITING).await;
    }
    sqlx::query(
        "UPDATE agreements.crm_listing_shares SET status='declined',decided_at=now(), \
         decline_known=$2,closed_at=now(),closed_by=$3 WHERE id=$1",
    )
    .bind(step.row.id)
    .bind(known)
    .bind(step.actor)
    .execute(&mut *step.tx)
    .await?;
    let reason = known.then_some("already_known");
    let by = Some((step.actor, "recipient"));
    store::event(&mut step.tx, step.row.id, "declined", by, (reason, None)).await?;
    step.finish().await
}

pub async fn withdraw(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let step = begin(&state, &session, &headers, path, Viewer::Sender).await?;
    close(step, "withdrawn", "pending", "sender").await
}

pub async fn stop(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let step = begin(&state, &session, &headers, path, Viewer::Sender).await?;
    close(step, "stopped", "accepted", "sender").await
}
