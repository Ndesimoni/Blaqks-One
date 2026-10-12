use super::{
    archive::ArchiveRequest,
    archive_access::{self, Scope},
    archive_snapshot, audit, members,
};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn archive(
    pool: &PgPool,
    actor: Uuid,
    id: Uuid,
    scope: &Scope,
    request: ArchiveRequest,
) -> ApiResult<Value> {
    let mut transaction = pool.begin().await?;
    archive_access::lock(&mut transaction, scope).await?;
    let snapshot = archive_snapshot::read(
        &mut transaction,
        id,
        scope.owner,
        &scope.workspace,
        scope.manages_admin,
    )
    .await?;
    if snapshot.member.version != request.version
        || snapshot.team_fingerprint != request.team_fingerprint
    {
        return Err(ApiError::stale(
            "This account or team changed. Review the archive again.",
        ));
    }
    if snapshot.member.profile.email != request.confirmation_email {
        return Err(ApiError::invalid(
            "Type the account email exactly to confirm archival.",
        ));
    }
    let admin = snapshot.member.profile.role_id == "admin";
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM crm_users WHERE (id=$1 OR ($2 AND owner_id=$1)) \
         AND deleted_at IS NULL ORDER BY id FOR UPDATE",
    )
    .bind(id)
    .bind(admin)
    .fetch_all(&mut *transaction)
    .await?;
    sqlx::query(
        "UPDATE crm_users SET active=false,deleted_at=now(),version=version+1 WHERE id=ANY($1)",
    )
    .bind(&ids)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM crm_sessions WHERE user_id=ANY($1)")
        .bind(&ids)
        .execute(&mut *transaction)
        .await?;
    sqlx::query(
        "UPDATE crm_team_invitations SET revoked_at=COALESCE(revoked_at,now()) \
         WHERE user_id=ANY($1) OR owner_id=ANY($1)",
    )
    .bind(&ids)
    .execute(&mut *transaction)
    .await?;
    for member in &ids {
        audit::append(
            &mut transaction,
            actor,
            &scope.target_workspace,
            *member,
            "archived",
        )
        .await?;
    }
    transaction.commit().await?;
    Ok(
        json!({"archived":true,"member":members::find(pool,id).await?,
        "teamCount":snapshot.team_count,"recordCount":snapshot.record_count}),
    )
}
