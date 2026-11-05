//! `POST /whatsapp-numbers/{id}/disconnect` `{expectedVersion}`: the owning Admin may
//! disconnect any number of the company, a member only their own (design §10). Versioned
//! and idempotent; history stays and intake stops. Another member's number, or one in
//! another company, is indistinguishable from a missing one.
use super::{store, write};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    integrations::{access, wire},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

const RELOAD: &str = "Reload the WhatsApp number and try again.";

pub async fn disconnect(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    super::super::mailbox::ensure(&state, &session, Some(&headers), &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let map = wire::exact(body, &["expectedVersion"], wire::INVALID)?;
    let expected = wire::version(&map)?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let live = workspaces::member(&mut tx, &workspace, session.user.id).await?;
    let admin = live.role == "admin" && live.workspace_id == workspace;
    let found = store::by_id(&mut tx, &workspace, id)
        .await?
        .filter(|row| admin || row.member_id == session.user.id)
        .ok_or_else(ApiError::missing)?;
    if found.state == "disconnected" {
        tx.commit().await?;
        return Ok(Json(json!({ "number": found.view() })));
    }
    if found.version != expected {
        return Err(ApiError::stale(RELOAD));
    }
    let row = write::disconnect(&mut tx, &workspace, &found, session.user.id)
        .await?
        .ok_or_else(|| ApiError::stale(RELOAD))?;
    tx.commit().await?;
    Ok(Json(json!({ "number": row.view() })))
}
