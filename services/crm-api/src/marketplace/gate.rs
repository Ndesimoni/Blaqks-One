//! One gate on every member route (review amendment 1): the Super Admin, another company's
//! members, the organisation workspace and unknown workspaces get the shared not-found; a
//! live member of a company that is not frozen passes. Writes also check Origin and CSRF and
//! re-read the caller's live profile after their own workspace lock.
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};

/// Whether this caller must never see the marketplace at all.
pub fn outside(session: &Session, workspace: &str) -> bool {
    session.user.role == "super-admin"
        || workspace == workspaces::ORGANISATION
        || session.user.workspace_id != workspace
}

/// A read: the shared not-found for everyone outside, then a live member of a live company.
pub async fn reader(state: &AppState, session: &Session, workspace: &str) -> ApiResult<UserRow> {
    if outside(session, workspace) {
        return Err(ApiError::missing());
    }
    let mut tx = state.pool.begin().await?;
    let user = live_member(&mut tx, workspace, session.user.id).await?;
    tx.commit().await?;
    Ok(user)
}

/// A write: the read gate, then Origin and the in-memory anti-forgery token.
pub async fn writer(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
) -> ApiResult<UserRow> {
    let user = reader(state, session, workspace).await?;
    protection::mutation(state, headers, &session.csrf_token)?;
    Ok(user)
}

/// The caller's live profile for a read, without the workspace lock a write takes; a frozen
/// or archived company gets the shared not-found like everyone outside (code review L10).
pub async fn live_member(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: uuid::Uuid,
) -> ApiResult<UserRow> {
    if workspaces::frozen(tx, workspace).await? {
        return Err(ApiError::missing());
    }
    workspaces::member(tx, workspace, actor).await
}

/// The same live check a write needs: the company must not be frozen or archived.
pub async fn live_writer(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: uuid::Uuid,
) -> ApiResult<UserRow> {
    workspaces::lock(tx, workspace).await?;
    workspaces::ensure_writable(tx, workspace, actor, None, None).await
}

pub const NOT_APPROVED: &str = "Your company is not approved for the marketplace yet.";
pub const OFF: &str = "Your company has turned the marketplace off.";
pub const JOIN_FIRST: &str = "Join the marketplace first.";

/// The company may use the marketplace: approved and switched on (§14.1).
pub async fn company_open(tx: &mut Transaction<'_, Postgres>, workspace: &str) -> ApiResult<()> {
    let latest = super::state::latest(tx, workspace).await?;
    if super::state::state(&latest) != super::state::State::Approved {
        return Err(ApiError::conflict(NOT_APPROVED));
    }
    if !super::state::enabled(tx, workspace).await?.0 {
        return Err(ApiError::conflict(OFF));
    }
    Ok(())
}

/// The same check for the profile reads, which answer the shared not-found instead.
pub async fn company_open_or_missing(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<()> {
    let latest = super::state::latest(tx, workspace).await?;
    let open = super::state::state(&latest) == super::state::State::Approved
        && super::state::enabled(tx, workspace).await?.0;
    if !open {
        return Err(ApiError::missing());
    }
    Ok(())
}

/// The member joined and accepted the current terms; anything beyond joining needs both.
pub async fn joined(tx: &mut Transaction<'_, Postgres>, member: uuid::Uuid) -> ApiResult<()> {
    if super::profiles::load(tx, member).await?.is_none() {
        return Err(ApiError::conflict(JOIN_FIRST));
    }
    let current = super::terms::current(tx)
        .await?
        .ok_or_else(|| ApiError::conflict(super::terms::OUTDATED))?;
    if !super::terms::accepted(tx, member, &current.version).await? {
        return Err(ApiError::conflict(super::terms::OUTDATED));
    }
    Ok(())
}
