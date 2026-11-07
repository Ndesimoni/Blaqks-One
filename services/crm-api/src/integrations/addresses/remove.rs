//! `POST /email-addresses/{id}/remove` (owner decision 2026-10-21): the Admin removes an
//! address given by mistake. Only an address that has never been used with clients may be
//! removed, freeing its name; a used one is kept for ever (decision E3d), so a former
//! colleague's client mail can never reach someone new.
use super::store;
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    inbox::company_usage,
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
use uuid::Uuid;

const USED: &str =
    "This address has already been used with clients, so it is kept. You can keep it for a former member instead.";

pub async fn remove(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_admin(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let map = wire::exact(body, &["expectedVersion"], wire::INVALID)?;
    let expected = wire::version(&map)?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    access::live_admin(&mut tx, &workspace, session.user.id).await?;
    let found = store::by_id(&mut tx, &workspace, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    if found.version != expected {
        return Err(ApiError::stale("Reload the address and try again."));
    }
    // Every SendGrid connection this company has had for the domain, live or not.
    let connections: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM integrations.crm_channel_connections
         WHERE workspace_id=$1 AND provider='sendgrid' AND external_account_id=$2",
    )
    .bind(&workspace)
    .bind(&found.domain)
    .fetch_all(&mut *tx)
    .await?;
    let member = found.member_id;
    let since = found.created_at.as_str();
    if company_usage::address_used(&mut tx, &workspace, &connections, member, since).await? {
        return Err(ApiError::conflict(USED));
    }
    sqlx::query("DELETE FROM integrations.crm_sendgrid_addresses WHERE workspace_id=$1 AND id=$2")
        .bind(&workspace)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(json!({ "removed": id })))
}
