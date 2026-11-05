use crate::{
    auth::{accounts, profile::UserRow},
    error::{ApiError, ApiResult},
    workspaces,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Company details have no Super Admin cross-team exception and require no module grant.
pub(super) async fn member(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<UserRow> {
    let user = workspaces::member(transaction, workspace, actor).await?;
    if user.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM crm_workspaces WHERE id=$1)")
            .bind(workspace)
            .fetch_one(&mut **transaction)
            .await?;
    if !exists {
        return Err(ApiError::forbidden());
    }
    Ok(user)
}

/// The workspace lock precedes the owner's identity row lock and all live checks.
pub(super) async fn owner(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<()> {
    let owner: Uuid = sqlx::query_scalar("SELECT owner_id FROM crm_workspaces WHERE id=$1")
        .bind(workspace)
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or_else(ApiError::forbidden)?;
    accounts::lock_active_admin(transaction, owner).await?;
    let user = member(transaction, workspace, actor).await?;
    if user.role != "admin" || owner != actor {
        return Err(ApiError::forbidden());
    }
    Ok(())
}
