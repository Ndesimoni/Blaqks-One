pub mod handlers;

use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
};

pub const ORGANISATION: &str = "super-admin-workspace";

pub async fn lock(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
) -> ApiResult<()> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(workspace)
        .execute(&mut **transaction)
        .await?;
    Ok(())
}

pub async fn ensure_access(state: &AppState, session: &Session, workspace: &str) -> ApiResult<()> {
    if session.user.role != "super-admin" && workspace != session.user.workspace_id {
        return Err(ApiError::forbidden());
    }
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM crm_workspaces WHERE id=$1)")
            .bind(workspace)
            .fetch_one(&state.pool)
            .await?;
    if !exists {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

/// Re-reads the caller's live profile for `workspace` inside `transaction` (H4, L3).
/// Inactive members, suspended owners and other teams are refused.
pub async fn member(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    actor: uuid::Uuid,
) -> ApiResult<UserRow> {
    sqlx::query_as::<_, UserRow>(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND active AND owner_active",
    )
    .bind(actor)
    .fetch_optional(&mut **transaction)
    .await?
    .filter(|user| user.role == "super-admin" || user.workspace_id == workspace)
    .ok_or_else(ApiError::forbidden)
}

/// Call under `lock`: the workspace must not be archived and the re-read caller must
/// still be a member holding the collection's grant. Returns that live profile, which
/// is the only source of the caller's record scope for the write.
pub async fn ensure_writable(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    actor: uuid::Uuid,
    collection: Option<&str>,
) -> ApiResult<UserRow> {
    let writable: bool = sqlx::query_scalar(
        "SELECT u.deleted_at IS NULL FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         WHERE w.id=$1",
    )
    .bind(workspace)
    .fetch_optional(&mut **transaction)
    .await?
    .unwrap_or(false);
    if !writable {
        return Err(ApiError::forbidden());
    }
    let user = member(transaction, workspace, actor).await?;
    if collection.is_some_and(|key| !user.can_collection(key)) {
        return Err(ApiError::forbidden());
    }
    Ok(user)
}
