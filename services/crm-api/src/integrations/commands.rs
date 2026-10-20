//! Reconnect and disconnect (docs/messaging-integrations-plan.md §4 X1): versioned,
//! Admin-only, under the workspace lock. Disconnect is idempotent and clears the sealed
//! credential while keeping the row for history.
use super::{
    access, crypto,
    handlers::key,
    model::{Channel, State as ConnectionState},
    provider, store, store_write, wire,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

const RECONNECT: [&str; 2] = ["expectedVersion", "credential"];
const DISCONNECT: [&str; 1] = ["expectedVersion"];
const RELOAD: &str = "Reload the channel and try again.";

pub async fn reconnect(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_admin(&state, &session, &headers, &workspace).await?;
    let key = key(&state)?.clone();
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let map = wire::exact(body, &RECONNECT, wire::INVALID)?;
    let expected = wire::version(&map)?;
    let credential = wire::secret(wire::node(&map, "credential")?, 4096)?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    let row = store::load(&mut tx, &workspace, id)
        .await?
        .filter(|row| row.state() != ConnectionState::Disconnected)
        .ok_or_else(ApiError::missing)?;
    if row.version != expected {
        return Err(ApiError::stale(RELOAD));
    }
    let channel = Channel::parse(&row.channel).ok_or_else(ApiError::missing)?;
    provider::adapter(channel)
        .verify(&row.external_account_id, &credential)
        .map_err(ApiError::invalid)?;
    let aad = crypto::aad(
        &workspace,
        &id.to_string(),
        &row.provider,
        &row.channel,
        key.version,
    );
    let sealed = crypto::seal(&key.bytes, &aad, credential.as_bytes())
        .map_err(|_| ApiError::invalid("The credential could not be secured."))?;
    let updated = store_write::set_connected(
        &mut tx,
        &workspace,
        id,
        &sealed,
        key.version,
        session.user.id,
    )
    .await?
    .ok_or_else(ApiError::missing)?;
    store_write::event(&mut tx, &workspace, id, "reconnected", session.user.id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "connection": updated.view() })))
}

pub async fn disconnect(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_admin(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let map = wire::exact(body, &DISCONNECT, wire::INVALID)?;
    let expected = wire::version(&map)?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    let row = store::load(&mut tx, &workspace, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    if row.state() == ConnectionState::Disconnected {
        tx.commit().await?;
        return Ok(Json(json!({ "connection": row.view() })));
    }
    if row.version != expected {
        return Err(ApiError::stale(RELOAD));
    }
    let updated = store_write::set_disconnected(&mut tx, &workspace, id, session.user.id)
        .await?
        .ok_or_else(ApiError::missing)?;
    store_write::event(&mut tx, &workspace, id, "disconnected", session.user.id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "connection": updated.view() })))
}

#[cfg(test)]
mod tests {
    #[test]
    fn malformed_connection_ids_are_not_found() {
        assert!(super::access::id("not-a-uuid").is_err());
        assert!(super::access::id(&uuid::Uuid::new_v4().to_string()).is_ok());
    }
}
