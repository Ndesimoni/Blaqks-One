//! `POST …/marketplace/leave` (packet MK1b): the profile and its photo go at once. Acceptances
//! and events stay as evidence, and joining again asks for the consent and terms again.
use super::{application, events, gate, profiles, requests_close};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media,
    state::AppState,
};
use axum::{
    extract::{Path, State as AxumState},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::Value;

pub async fn leave(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    // Only a member who joined can leave; nobody else writes a `left` event (code review L9).
    if profiles::load(&mut tx, user.id).await?.is_none() {
        return Err(ApiError::conflict(gate::JOIN_FIRST));
    }
    // Leaving ends every open request in the same transaction, and frees their clients.
    let closed = requests_close::close_left(&mut tx, user.id).await?;
    for _ in &closed {
        events::append(&mut tx, &workspace, user.id, user.id, "request_closed").await?;
    }
    media::owned::remove(&mut tx, super::photo::KIND, user.id).await?;
    profiles::remove(&mut tx, user.id).await?;
    events::append(&mut tx, &workspace, user.id, user.id, "left").await?;
    tx.commit().await?;
    application::reply(&state, &workspace, user.id, StatusCode::OK).await
}
