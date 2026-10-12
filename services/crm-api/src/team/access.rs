use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use uuid::Uuid;

pub async fn owner(state: &AppState, session: &Session, workspace: &str) -> ApiResult<Uuid> {
    resolve_owner(state, session, workspace, false).await
}

pub async fn read_owner(state: &AppState, session: &Session, workspace: &str) -> ApiResult<Uuid> {
    resolve_owner(
        state,
        session,
        workspace,
        session.user.role == "super-admin",
    )
    .await
}

async fn resolve_owner(
    state: &AppState,
    session: &Session,
    workspace: &str,
    include_archived: bool,
) -> ApiResult<Uuid> {
    if session.user.role == "staff" {
        return Err(ApiError::forbidden());
    }
    workspaces::ensure_access(state, session, workspace).await?;
    let owner = sqlx::query_scalar::<_, Uuid>(
        "SELECT u.id FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         WHERE w.id=$1 AND u.role IN ('admin','super-admin') \
         AND ($2 OR (u.active AND u.deleted_at IS NULL))",
    )
    .bind(workspace)
    .bind(include_archived)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    if session.user.role == "admin" && owner != session.user.id {
        return Err(ApiError::forbidden());
    }
    Ok(owner)
}

pub fn can_manage_admin(session: &Session, workspace: &str) -> bool {
    session.user.role == "super-admin" && workspace == workspaces::ORGANISATION
}

pub async fn lock_owner(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    owner: Uuid,
) -> ApiResult<()> {
    let active: bool = sqlx::query_scalar(
        "SELECT active FROM crm_users WHERE id=$1 AND role IN ('admin','super-admin') \
         AND deleted_at IS NULL FOR SHARE",
    )
    .bind(owner)
    .fetch_optional(&mut **transaction)
    .await?
    .unwrap_or(false);
    if !active {
        return Err(ApiError::forbidden());
    }
    Ok(())
}
