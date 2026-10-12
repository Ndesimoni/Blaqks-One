pub mod handlers;

use crate::{
    auth::session::Session,
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

pub async fn ensure_writable(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    actor: uuid::Uuid,
    collection: Option<&str>,
) -> ApiResult<()> {
    let writable: bool = sqlx::query_scalar(
        "SELECT u.deleted_at IS NULL FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         WHERE w.id=$1",
    )
    .bind(workspace)
    .fetch_optional(&mut **transaction)
    .await?
    .unwrap_or(false);
    let user = sqlx::query_as::<_, crate::auth::profile::UserRow>(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND active AND owner_active",
    )
    .bind(actor)
    .fetch_optional(&mut **transaction)
    .await?;
    if !writable
        || user.is_none_or(|user| {
            (user.role != "super-admin" && user.workspace_id != workspace)
                || collection.is_some_and(|key| !user.can_collection(key))
        })
    {
        return Err(ApiError::forbidden());
    }
    Ok(())
}
