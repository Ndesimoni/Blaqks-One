use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{
        self,
        platform::{areas, Area, Level},
    },
};
use uuid::Uuid;

/// The owner whose team the caller manages in `workspace` (BO1a item 5): Blaqks One only
/// its organisation (the company Admins it invites), an Admin only their own company. The
/// owner must be live; archived and suspended owners and every other caller are refused.
/// Blaqks One staff with the invite-Admins area act for the Owner on the organisation
/// (BO1b); handlers re-read them live with `workspaces::platform::operator`.
pub async fn owner(state: &AppState, session: &Session, workspace: &str) -> ApiResult<Uuid> {
    // Role allowlist (L-4): only Admins and Blaqks One manage a team.
    let own = match session.user.role.as_str() {
        "super-admin" => workspace == workspaces::ORGANISATION,
        "platform" if workspace == workspaces::ORGANISATION => {
            let invite = (Area::InviteAdmins, Level::Manage);
            return organisation_owner(state, session, invite).await;
        }
        "admin" => workspace == session.user.workspace_id && workspace != workspaces::ORGANISATION,
        _ => false,
    };
    if !own {
        return Err(ApiError::forbidden());
    }
    let owner = sqlx::query_scalar::<_, Uuid>(
        "SELECT u.id FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         WHERE w.id=$1 AND u.role=$2 AND u.active AND u.deleted_at IS NULL",
    )
    .bind(workspace)
    .bind(&session.user.role)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    if owner != session.user.id {
        return Err(ApiError::forbidden());
    }
    Ok(owner)
}

/// The Owner of the organisation, for a live operator holding `area` at its level: Blaqks
/// One staff act for the Owner on company Admins (BO1b). Callers re-read the operator
/// under their locks.
pub async fn organisation_owner(
    state: &AppState,
    session: &Session,
    (area, level): (Area, Level),
) -> ApiResult<Uuid> {
    let mut transaction = state.pool.begin().await?;
    workspaces::platform::operator(&mut transaction, session.user.id, area, level).await?;
    let owner = workspaces::owner_of(&mut transaction, workspaces::ORGANISATION).await?;
    transaction.commit().await?;
    Ok(owner)
}

/// The owning Admin of company `workspace`, for Blaqks One's agent controls on Companies
/// (BO1a item 8): the caller must be the live operator managing companies and the
/// company's owner must not be archived. The organisation is not a company. Callers re-read
/// both under their locks.
pub async fn company_owner(
    state: &AppState,
    session: &Session,
    workspace: &str,
) -> ApiResult<Uuid> {
    let (area, level) = (Area::Companies, Level::Manage);
    if !areas::allows(&session.user, area, level) || workspace == workspaces::ORGANISATION {
        return Err(ApiError::forbidden());
    }
    let mut transaction = state.pool.begin().await?;
    workspaces::platform::operator(&mut transaction, session.user.id, area, level).await?;
    let owner = sqlx::query_scalar::<_, Uuid>(
        "SELECT u.id FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         WHERE w.id=$1 AND u.role='admin' AND u.deleted_at IS NULL",
    )
    .bind(workspace)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    transaction.commit().await?;
    Ok(owner)
}

/// Whether the caller works on the organisation's company Admins: the Owner, or Blaqks One
/// staff with the invite-Admins area.
pub fn can_manage_admin(session: &Session, workspace: &str) -> bool {
    areas::allows(&session.user, Area::InviteAdmins, Level::Manage)
        && workspace == workspaces::ORGANISATION
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

/// Re-reads exact owner authority after the caller has taken the workspace lock.
pub async fn lock_exact_owner(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<()> {
    let owner: Uuid = sqlx::query_scalar("SELECT owner_id FROM crm_workspaces WHERE id=$1")
        .bind(workspace)
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or_else(ApiError::forbidden)?;
    lock_owner(transaction, owner).await?;
    let user = workspaces::member(transaction, workspace, actor).await?;
    if owner != actor || user.role != "admin" || user.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    Ok(())
}
