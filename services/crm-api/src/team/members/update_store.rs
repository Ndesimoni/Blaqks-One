use super::{
    directory::MemberRow,
    update::{self, UpdateRequest},
};
use crate::team::{access, audit};
use crate::{
    error::{ApiError, ApiResult},
    workspaces,
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
    update::prepare(&mut request, &current)?;
    let active = request.active.unwrap_or(current.active);
    sqlx::query(
        "UPDATE crm_users SET name=$2,phone=$3,positions=$4,permissions=$5,channel_access=$6, \
         active=$7,record_scope=COALESCE($8,record_scope),version=version+1 WHERE id=$1",
    )
    .bind(id)
    .bind(&request.name)
    .bind(&request.phone)
    .bind(sqlx::types::Json(request.positions.as_ref().unwrap()))
    .bind(sqlx::types::Json(request.permissions.as_ref().unwrap()))
    .bind(sqlx::types::Json(request.channel_access.as_ref().unwrap()))
    .bind(active)
    .bind(request.record_scope.map(update::RecordScopeGrant::as_str))
    .execute(&mut *transaction)
    .await?;
    if request.active == Some(false) && !current.accepted {
        sqlx::query("UPDATE crm_team_invitations SET revoked_at=now() WHERE user_id=$1 AND consumed_at IS NULL")
            .bind(id).execute(&mut *transaction).await?;
    }
    sqlx::query("DELETE FROM crm_sessions WHERE user_id=$1 OR user_id IN (SELECT id FROM crm_users WHERE owner_id=$1)")
        .bind(id).execute(&mut *transaction).await?;
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
