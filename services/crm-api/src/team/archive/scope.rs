//! Who an archive acts for. Only Blaqks One archives accounts: a company Admin (with their
//! whole team) through its organisation, or one agent of a company through the platform
//! resolver, never by opening the company (BO1a item 8, owner answer Q1).
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
    /// The live Blaqks One operator, re-read under the archive lock.
    pub operator: Uuid,
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
    let manages_admin = access::can_manage_admin(session, &workspace);
    let owner = if manages_admin {
        access::owner(state, session, &workspace).await?
    } else {
        access::company_owner(state, session, &workspace).await?
    };
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
        operator: session.user.id,
        owner,
        workspace,
        target_workspace,
        manages_admin,
    })
}

/// Locks both workspaces in the shared order, then re-reads the operator and checks the
/// owner is still not archived.
pub async fn lock(transaction: &mut Transaction<'_, Postgres>, scope: &Scope) -> ApiResult<()> {
    let both = [scope.workspace.as_str(), scope.target_workspace.as_str()];
    workspaces::lock_all(transaction, &both).await?;
    workspaces::platform::operator(transaction, scope.operator).await?;
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
