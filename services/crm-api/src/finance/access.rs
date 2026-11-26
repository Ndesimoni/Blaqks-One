//! Finance check order, steps 1, 2 and 4 (finance-design §6.1). Every check here
//! depends only on the caller, so it runs before any body or target is read.
use crate::{
    auth::{
        finance_access::{FinanceAccess, FinanceScope},
        profile::UserRow,
        protection,
        session::Session,
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const MANAGE_DENIED: &str = "Only your Admin can change finance settings.";

/// Reads: workspace access, then the finance module ("Access denied.").
pub async fn reader(
    state: &AppState,
    session: &Session,
    workspace: &str,
) -> ApiResult<FinanceAccess> {
    workspaces::ensure_access(state, session, workspace).await?;
    let access = session.user.finance_access();
    if access.scope == FinanceScope::None {
        return Err(ApiError::forbidden());
    }
    Ok(access)
}

/// Reads limited to team finance (Admins, team-view staff and the Super Admin).
pub async fn team_reader(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    match reader(state, session, workspace).await?.scope {
        FinanceScope::Team => Ok(()),
        _ => Err(ApiError::forbidden()),
    }
}

/// Admin-only writes: workspace access, CSRF, the finance module, then the role. The
/// Super Admin has no finance write authority inside companies (§13).
pub async fn manager(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
) -> ApiResult<()> {
    workspaces::ensure_access(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)?;
    let access = session.user.finance_access();
    if access.scope == FinanceScope::None {
        return Err(ApiError::forbidden());
    }
    if !access.manage {
        return Err(ApiError::denied(MANAGE_DENIED));
    }
    Ok(())
}

/// Step 4 for Admin-only writes: the workspace lock, then the live profile (archived
/// workspaces are read-only) and the same role check on it.
pub async fn lock_manager(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<UserRow> {
    workspaces::lock(transaction, workspace).await?;
    let live = workspaces::ensure_writable(transaction, workspace, actor, None, None).await?;
    let access = live.finance_access();
    if access.scope == FinanceScope::None {
        return Err(ApiError::forbidden());
    }
    if !access.manage || live.workspace_id != workspace {
        return Err(ApiError::denied(MANAGE_DENIED));
    }
    Ok(live)
}

/// Today in Asia/Dubai, as the database sees it.
pub async fn today(transaction: &mut Transaction<'_, Postgres>) -> ApiResult<String> {
    Ok(
        sqlx::query_scalar("SELECT ((now() AT TIME ZONE 'Asia/Dubai')::date)::text")
            .fetch_one(&mut **transaction)
            .await?,
    )
}
