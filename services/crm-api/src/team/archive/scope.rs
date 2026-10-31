use crate::team::access;
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct Scope {
    pub owner: Uuid,
    pub workspace: String,
    pub target_workspace: String,
    pub manages_admin: bool,
}

pub async fn scope(
    state: &AppState,
    session: &Session,
    workspace: String,
    id: Uuid,
) -> ApiResult<Scope> {
    if session.user.role != "super-admin" || session.user.id == id {
        return Err(ApiError::forbidden());
    }
    let owner = access::read_owner(state, session, &workspace).await?;
    let manages_admin = access::can_manage_admin(session, &workspace);
    let target_workspace = sqlx::query_scalar::<_, String>(
        "SELECT workspace_id FROM crm_member_profiles WHERE id=$1 AND NOT archived AND \
         ((role='staff' AND owner_id=$2 AND workspace_id=$3) OR ($4 AND role='admin'))",
    )
    .bind(id)
    .bind(owner)
    .bind(&workspace)
    .bind(manages_admin)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    Ok(Scope {
        owner,
        workspace,
        target_workspace,
        manages_admin,
    })
}

pub async fn lock(transaction: &mut Transaction<'_, Postgres>, scope: &Scope) -> ApiResult<()> {
    let both = [scope.workspace.as_str(), scope.target_workspace.as_str()];
    workspaces::lock_all(transaction, &both).await?;
    let available: bool =
        sqlx::query_scalar("SELECT deleted_at IS NULL FROM crm_users WHERE id=$1 FOR SHARE")
            .bind(scope.owner)
            .fetch_optional(&mut **transaction)
            .await?
            .unwrap_or(false);
    if !available {
        return Err(ApiError::forbidden());
    }
    Ok(())
}
