//! `DELETE /mailbox`: a member disconnects their own mailbox. The sealed token is cleared
//! in the same transaction and its revocation queued, then sent after commit (design §8).
use super::ensure;
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    integrations::{revocation, store, wire},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub async fn disconnect(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    ensure(&state, &session, Some(&headers), &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let map = wire::exact(body, &["expectedVersion"], wire::INVALID)?;
    let expected = wire::version(&map)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    // Any live member may switch off their own mailbox, even after losing the email grant.
    workspaces::member(&mut tx, &workspace, session.user.id).await?;
    let row = store::own_mailbox(&mut tx, &workspace, session.user.id)
        .await?
        .ok_or_else(ApiError::missing)?;
    if row.version != expected {
        return Err(ApiError::stale("Reload your mailbox and try again."));
    }
    let updated = revocation::disconnect(&mut tx, &row, session.user.id)
        .await?
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    revoke_soon(&state);
    Ok(Json(json!({ "mailbox": updated.view() })))
}

/// After a commit that queued revocations, so a slow Google never holds the workspace lock.
pub fn revoke_soon(state: &AppState) {
    revocation::drain_soon(
        state.pool.clone(),
        state.config.messaging.clone(),
        state.config.google.clone(),
    );
}
