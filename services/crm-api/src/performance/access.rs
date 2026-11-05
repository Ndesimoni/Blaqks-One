//! Performance check order (H1): workspace access and the reports module before any query
//! or body is read; writes add CSRF and the Admin role, then repeat both on the live
//! profile under the workspace lock.
use super::{errors::MANAGE, errors::MEMBER, visibility};
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

fn reports(user: &UserRow) -> ApiResult<()> {
    if user.effective_permissions().reports {
        Ok(())
    } else {
        Err(ApiError::forbidden())
    }
}

pub async fn reader(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    reports(&session.user)
}

pub async fn manager(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)?;
    reports(&session.user)?;
    if !visibility::can_edit(&session.user, workspace) {
        return Err(ApiError::denied(MANAGE));
    }
    Ok(())
}

/// Under the lock: the workspace must be writable and the live caller still its Admin.
pub async fn lock_manager(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<UserRow> {
    workspaces::lock(transaction, workspace).await?;
    let live = workspaces::ensure_writable(transaction, workspace, actor, None, None).await?;
    reports(&live)?;
    if !visibility::can_edit(&live, workspace) {
        return Err(ApiError::denied(MANAGE));
    }
    Ok(live)
}

/// A member target names an active Admin or staff member of this workspace. Archived,
/// suspended, unknown and other teams' members get the same answer.
pub async fn ensure_member(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
) -> ApiResult<()> {
    let found: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_user_profiles WHERE id=$1 AND workspace_id=$2 \
         AND active AND owner_active AND role IN ('admin','staff'))",
    )
    .bind(member)
    .bind(workspace)
    .fetch_one(&mut **transaction)
    .await?;
    found.then_some(()).ok_or(ApiError::invalid(MEMBER))
}
