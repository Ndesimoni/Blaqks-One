use super::{
    handlers::ArchiveRequest,
    scope::{self, Scope},
    snapshot,
};
use crate::assignments::departure;
use crate::auth::sessions;
use crate::error::{ApiError, ApiResult};
use crate::team::{audit, members};
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
    scope::lock(&mut transaction, scope).await?;
    let snapshot = snapshot::read(
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
    sessions::revoke_all(&mut transaction, &ids).await?;
    // Their mailboxes, addresses and WhatsApp numbers end with their accounts (messaging
    // design §3, review M1; WhatsApp design §4), in their own company workspace (W-M1).
    let leaving = crate::integrations::Leaving::ALL;
    let target = &scope.target_workspace;
    crate::integrations::departure(&mut transaction, target, &ids, leaving, actor).await?;
    // An Admin archive also ends the company's channels, releasing its domain and numbers.
    if admin {
        crate::integrations::company_archived(&mut transaction, &scope.target_workspace, actor)
            .await?;
        // Listings shared with or from other companies end too (R2).
        crate::agreements::listings::end_for_company(&mut transaction, &scope.target_workspace)
            .await?;
    }
    sqlx::query(
        "UPDATE crm_team_invitations SET revoked_at=COALESCE(revoked_at,now()) \
         WHERE user_id=ANY($1) OR owner_id=ANY($1)",
    )
    .bind(&ids)
    .execute(&mut *transaction)
    .await?;
    // A staff archive releases their records to the queue; an Admin archive freezes the
    // whole workspace, so its assignments are kept as they are (contract §7).
    if !admin {
        let all = crate::records::visibility::ASSIGNABLE;
        let workspace = &scope.target_workspace;
        departure::release(&mut transaction, workspace, id, &all, actor, "departure").await?;
        crate::finance::departure::release(&mut transaction, workspace, id, actor, "departure")
            .await?;
    }
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
