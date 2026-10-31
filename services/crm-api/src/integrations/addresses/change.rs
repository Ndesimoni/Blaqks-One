//! `PATCH` (display name) and `DELETE` (reserve) on one sending address. The local part
//! never changes, and a reserved address is never deleted or handed to someone else.
use super::{
    rules,
    store::{self, AddressRow},
    write,
};
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
use serde_json::{json, Map, Value};

const RELOAD: &str = "Reload the address and try again.";
const RESERVED: &str = "This address is kept for a former member and cannot be changed.";

pub async fn rename(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let (map, expected) = versioned(&state, &session, &headers, &workspace, body, true).await?;
    let name = map.get("displayName").and_then(Value::as_str).unwrap_or("");
    let name = rules::display_name(name).map_err(ApiError::invalid)?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    let found = current(&mut tx, &workspace, id, expected).await?;
    if found.state != "active" {
        return Err(ApiError::invalid(RESERVED));
    }
    let row = changed(
        &mut tx,
        &workspace,
        &found,
        &name,
        "active",
        session.user.id,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "address": row.view() })))
}

/// Idempotent: an address already reserved is returned unchanged.
pub async fn reserve(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let (_, expected) = versioned(&state, &session, &headers, &workspace, body, false).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    let found = store::by_id(&mut tx, &workspace, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    if found.state == "reserved" {
        tx.commit().await?;
        return Ok(Json(json!({ "address": found.view() })));
    }
    if found.version != expected {
        return Err(ApiError::stale(RELOAD));
    }
    let name = found.display_name.clone();
    let row = changed(
        &mut tx,
        &workspace,
        &found,
        &name,
        "reserved",
        session.user.id,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "address": row.view() })))
}

async fn versioned(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
    body: Result<Json<Value>, JsonRejection>,
    named: bool,
) -> ApiResult<(Map<String, Value>, i64)> {
    access::ensure_admin(state, session, headers, workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let keys: &[&str] = if named {
        &["expectedVersion", "displayName"]
    } else {
        &["expectedVersion"]
    };
    let map = wire::exact(body, keys, wire::INVALID)?;
    let expected = wire::version(&map)?;
    Ok((map, expected))
}

async fn current(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    id: uuid::Uuid,
    expected: i64,
) -> ApiResult<AddressRow> {
    let found = store::by_id(tx, workspace, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    if found.version != expected {
        return Err(ApiError::stale(RELOAD));
    }
    Ok(found)
}

async fn changed(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    found: &AddressRow,
    name: &str,
    state: &str,
    actor: uuid::Uuid,
) -> ApiResult<AddressRow> {
    let change = write::Change {
        workspace,
        id: found.id,
        version: found.version,
        name,
        state,
        actor,
    };
    write::apply(tx, &change)
        .await?
        .ok_or_else(|| ApiError::stale(RELOAD))
}
