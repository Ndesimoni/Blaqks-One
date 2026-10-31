//! Marketplace conversations never reuse same-company Team chat access.
use super::{conversation_access as access, conversation_store as store, gate, limits};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Message {
    pub body: String,
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::live_member(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let row = access::request(&mut tx, limits::missing_id(&id)?).await?;
    let items = store::list(&mut tx, row.id, session.user.id, row.member_id).await?;
    tx.commit().await?;
    Ok(Json(json!({"conversations":items})))
}

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::live_member(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let (room, _) = access::load(&mut tx, limits::missing_id(&id)?, session.user.id).await?;
    let messages = store::messages(&mut tx, room.id).await?;
    tx.commit().await?;
    Ok(Json(json!({"messages":messages})))
}

pub async fn send(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    Json(input): Json<Message>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let body = access::body(&input.body)?;
    let mut tx = state.pool.begin().await?;
    gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let (room, row) = access::load(&mut tx, limits::missing_id(&id)?, session.user.id).await?;
    if row.closed_at.is_some() || row.expired {
        return Err(ApiError::conflict("This request is closed or expired."));
    }
    let id = store::append(&mut tx, room.id, session.user.id, &body).await?;
    super::events::append(
        &mut tx,
        &workspace,
        session.user.id,
        session.user.id,
        "message_posted",
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({"id":id})))
}
