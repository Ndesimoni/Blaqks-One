//! Share routes are for members of this company only (R1 amendment 1): never the Super
//! Admin, never another company's member; writes also check Origin and CSRF and run on the
//! live profile after the workspace lock.
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn reader(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    if session.user.role == "super-admin" || session.user.workspace_id != workspace {
        return Err(ApiError::missing());
    }
    workspaces::ensure_access(state, session, workspace)
        .await
        .map_err(|_| ApiError::missing())
}

pub async fn writer(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
) -> ApiResult<()> {
    reader(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)
}

/// The workspace lock, then the caller's live profile (frozen workspaces refuse writes).
pub async fn live(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<UserRow> {
    workspaces::lock(tx, workspace).await?;
    workspaces::ensure_writable(tx, workspace, actor, None, None).await
}

/// A share ID from the path; anything else is the shared not-found.
pub fn id(text: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(text).map_err(|_| ApiError::missing())
}
