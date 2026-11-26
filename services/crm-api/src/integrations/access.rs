//! Channel administration is limited to the owning company's Admin
//! (docs/messaging-integrations-plan.md §2.8). Staff and the Super Admin are refused,
//! and every mutation needs the session CSRF token and Origin check.
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn ensure_reader(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    owning_admin(session, workspace)
}

pub async fn ensure_admin(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
) -> ApiResult<()> {
    ensure_reader(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)
}

/// Re-reads live membership under the workspace lock and repeats the Admin rule.
pub async fn live_admin(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<()> {
    let live = workspaces::member(tx, workspace, actor).await?;
    if live.role != "admin" || live.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

fn owning_admin(session: &Session, workspace: &str) -> ApiResult<()> {
    if session.user.role != "admin" || session.user.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

/// A malformed or foreign connection ID is treated as a missing connection.
pub fn id(value: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(value).map_err(|_| ApiError::missing())
}
