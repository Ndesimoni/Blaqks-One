//! `POST …/marketplace/requests/{id}/renew` and `/close` (packet MK2): renew sets thirty days from
//! now for an open request or one that expired less than thirty days ago; close ends an open
//! request with the reason `done` and frees its client.
use super::{events, gate, limits, request_view, requests, requests_close, requests_edit, sources};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State as AxumState},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

pub const RENEW: &str =
    "Only an open request, or one that expired less than 30 days ago, can be renewed.";
pub const CLOSE: &str = "Only an open request can be closed.";

pub async fn renew(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    command(
        &state,
        &session,
        &headers,
        &workspace,
        &id,
        "request_renewed",
        RENEW,
    )
    .await
}

pub async fn close(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    command(
        &state,
        &session,
        &headers,
        &workspace,
        &id,
        "request_closed",
        CLOSE,
    )
    .await
}

/// Both commands run the same gate, then one transaction that answers the changed request.
async fn command(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
    id: &str,
    action: &str,
    refusal: &'static str,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(state, session, headers, workspace).await?;
    let request_id = limits::missing_id(id)?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, workspace, session.user.id).await?;
    gate::company_open(&mut tx, workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    requests::own_row(&mut tx, request_id, user.id).await?;
    let row = match action {
        "request_renewed" => requests_edit::renew(&mut tx, request_id, user.id).await?,
        // An already-closed request is refused, so it never gains a second closing event.
        _ => match requests_close::close(&mut tx, request_id, user.id).await? {
            true => requests::load(&mut tx, request_id).await?,
            false => None,
        },
    };
    let Some(row) = row else {
        return Err(ApiError::conflict(refusal));
    };
    if action == "request_closed" {
        super::lifecycle_store::end_offers(&mut tx, row.id, user.id).await?;
    }
    events::append(&mut tx, workspace, user.id, user.id, action).await?;
    let client = sources::client_of(&mut tx, row.id).await?;
    tx.commit().await?;
    Ok((
        StatusCode::OK,
        Json(json!({ "request": request_view::mine(&row, client, None) })),
    ))
}
