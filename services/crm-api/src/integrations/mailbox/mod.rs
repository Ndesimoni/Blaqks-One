//! Each member's own mailbox (design §8 and §11, packet E1a): the member connects it with
//! Google sign-in and may disconnect it. The Admin's email grant is the approval: only the
//! Admin and staff with `channel_access.email` may connect, and only in their own company.
//! The Super Admin never holds a company mailbox.
mod disconnect;
mod finish;
mod start;

pub use disconnect::{disconnect, revoke_soon};
pub use finish::finish;
pub use start::start;

use super::{model::ConnectionRow, store};
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const NOT_SET_UP: &str = "Google email is not set up for this CRM yet.";

pub fn may_connect(user: &UserRow, workspace: &str) -> bool {
    user.workspace_id == workspace
        && user.role != "super-admin"
        && (user.role == "admin" || user.channel_access.0.email)
}

/// Session checks before any read; mutations also pass the Origin and CSRF checks.
pub async fn ensure(
    state: &AppState,
    session: &Session,
    headers: Option<&HeaderMap>,
    workspace: &str,
) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    if session.user.workspace_id != workspace || session.user.role == "super-admin" {
        return Err(ApiError::forbidden());
    }
    match headers {
        Some(headers) => protection::mutation(state, headers, &session.csrf_token),
        None => Ok(()),
    }
}

/// Repeats the connect rule on live membership, under the workspace lock.
pub async fn live(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
) -> ApiResult<()> {
    let user = workspaces::member(tx, workspace, member).await?;
    may_connect(&user, workspace)
        .then_some(())
        .ok_or_else(ApiError::forbidden)
}

pub fn unconfigured() -> ApiError {
    ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        NOT_SET_UP,
        "google_unconfigured",
    )
}

/// `GET /mailbox`: the caller's own mailbox, if any, whether they may connect one, and
/// their company email address when the company uses SendGrid.
pub async fn mine(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    ensure(&state, &session, None, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let row = store::own_mailbox(&mut tx, &workspace, session.user.id).await?;
    let company =
        super::sendgrid::sender::own_address(&mut tx, &workspace, session.user.id).await?;
    tx.commit().await?;
    // A SendGrid company sends from each member's address on its domain (E3d).
    let company_email = company.map(|(connection, connected, address)| {
        json!({
            "connectionId": connection,
            "connected": connected,
            "address": address.as_ref().map(|(address, _)| address),
            "displayName": address.as_ref().map(|(_, name)| name),
        })
    });
    Ok(Json(json!({
        "companyEmail": company_email,
        "google": state.config.google.is_some() && state.config.messaging.is_some(),
        "mayConnect": may_connect(&session.user, &workspace),
        "mailbox": row.as_ref().map(ConnectionRow::view),
    })))
}
