use super::{
    directory::MemberRow,
    prepare::prepare,
    update::{self, UpdateRequest},
    update_channels,
};
use crate::team::{access, account_type::seats, audit};
use crate::{
    assignments::departure,
    auth::{actions::Actions, sessions},
    error::{ApiError, ApiResult},
    finance, workspaces,
};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn update(
    pool: &PgPool,
    actor: Uuid,
    owner: Uuid,
    workspace: &str,
    id: Uuid,
    manages_admin: bool,
    mut request: UpdateRequest,
) -> ApiResult<()> {
    let mut transaction = pool.begin().await?;
    workspaces::lock(&mut transaction, workspace).await?;
    access::lock_owner(&mut transaction, owner).await?;
    let home = update_channels::home(&mut transaction, workspace, id, manages_admin).await?;
    let target = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM crm_users WHERE id=$1 AND deleted_at IS NULL AND \
         ((role='staff' AND owner_id=$2 AND workspace_id=$3) OR ($4 AND role='admin')) FOR UPDATE",
    )
    .bind(id)
    .bind(owner)
    .bind(workspace)
    .bind(manages_admin)
    .fetch_optional(&mut *transaction)
    .await?;
    if target.is_none() {
        return Err(ApiError::forbidden());
    }
    let current = sqlx::query_as::<_, MemberRow>(
        "SELECT * FROM crm_member_profiles WHERE id=$1 AND NOT archived",
    )
    .bind(id)
    .fetch_one(&mut *transaction)
    .await?;
    if current.version != request.version {
        return Err(ApiError::stale(
            "This member changed. Reload before saving.",
        ));
    }
    let before = current.user.effective_permissions();
    prepare(&mut request, &current)?;
    let active = request.active.unwrap_or(current.active);
    if !current.active && active {
        seats::ensure(&mut transaction, workspace, Some(id)).await?;
    }
    let access_changed = grants_changed(&current, &request);
    // Admin rows keep '{}' (L-2): their `actions` stays None and COALESCE keeps it.
    sqlx::query(
        "UPDATE crm_users SET name=$2,phone=$3,positions=$4,permissions=$5,channel_access=$6, \
         active=$7,record_scope=COALESCE($8,record_scope),actions=COALESCE($9,actions), \
         version=version+1 WHERE id=$1",
    )
    .bind(id)
    .bind(&request.name)
    .bind(&request.phone)
    .bind(sqlx::types::Json(request.positions.as_ref().unwrap()))
    .bind(sqlx::types::Json(request.permissions.as_ref().unwrap()))
    .bind(sqlx::types::Json(request.channel_access.as_ref().unwrap()))
    .bind(active)
    .bind(request.record_scope.map(update::RecordScopeGrant::as_str))
    .bind(
        request
            .actions
            .map(|requested| sqlx::types::Json(requested.actions)),
    )
    .execute(&mut *transaction)
    .await?;
    if access_changed {
        // L-6: the action name only, never the grant contents.
        audit::append(&mut transaction, actor, workspace, id, "access_changed").await?;
    }
    // M3: a staff member who is suspended or loses a grant releases those records in
    // this transaction. Admins and recordScope changes release nothing.
    if matches!(current.user.role.as_str(), "staff") {
        let after = request.permissions.as_ref().unwrap();
        let (collections, reason) = departure::releases(current.active, active, &before, after);
        departure::release(&mut transaction, workspace, id, &collections, actor, reason).await?;
        if let Some(reason) = finance::departure::releases(current.active, active, &before, after) {
            finance::departure::release(&mut transaction, workspace, id, actor, reason).await?;
        }
    }
    if request.active == Some(false) && !current.accepted {
        sqlx::query("UPDATE crm_team_invitations SET revoked_at=now() WHERE user_id=$1 AND consumed_at IS NULL")
            .bind(id).execute(&mut *transaction).await?;
    }
    // Suspension or a lost channel grant ends those channels, in the member's own company
    // workspace (M1, W-M1).
    let leaving = update_channels::leaving(&current, &request, active);
    if leaving.any() {
        crate::integrations::departure(&mut transaction, &home, &[id], leaving, actor).await?;
    }
    sessions::revoke_member(&mut transaction, id).await?;
    audit::append(
        &mut transaction,
        actor,
        workspace,
        id,
        if request.active == Some(false) {
            "suspended"
        } else {
            "updated"
        },
    )
    .await?;
    transaction.commit().await?;
    Ok(())
}

/// Whether a stored grant changes: modules, actions, record scope or channels.
fn grants_changed(current: &MemberRow, request: &UpdateRequest) -> bool {
    let user = &current.user;
    let channels = request.channel_access.as_ref() != Some(&user.channel_access.0);
    if user.role != "staff" {
        return channels;
    }
    let scope = request
        .record_scope
        .is_some_and(|scope| scope.as_str() != user.record_scope);
    let actions = request.actions.is_some_and(|requested| {
        !user.actions_recorded() || requested.actions != Actions::from_stored(&user.actions.0)
    });
    channels || scope || actions || request.permissions.as_ref() != Some(&user.permissions.0)
}
