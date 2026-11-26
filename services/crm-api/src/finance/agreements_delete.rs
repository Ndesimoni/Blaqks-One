//! Deleting a future agreement (finance-design §6.2, §13 M-F3): only agreements that
//! have not started, and the agreement it auto-closed is reopened.
use super::{
    access,
    agreements::AgreementRow,
    agreements_store::SELECT,
    errors::STARTED,
    events::{self, Action, Changes, Entity},
};
use crate::error::{ApiError, ApiResult};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// Deletes a future agreement and reopens the one it auto-closed (whose end equals its
/// start) up to the deleted agreement's own end. Returns the reopened `(id, effectiveTo)`.
pub async fn delete(
    pool: &PgPool,
    actor: Uuid,
    workspace: &str,
    id: Uuid,
) -> ApiResult<Option<(Uuid, Option<String>)>> {
    let mut transaction = pool.begin().await?;
    access::lock_manager(&mut transaction, workspace, actor).await?;
    let today = access::today(&mut transaction).await?;
    let found = sqlx::query_as::<_, AgreementRow>(&format!(
        "{SELECT} WHERE a.id=$1 AND a.workspace_id=$2 FOR UPDATE OF a"
    ))
    .bind(id)
    .bind(workspace)
    .fetch_optional(&mut *transaction)
    .await?;
    let agreement = found.ok_or_else(ApiError::missing)?;
    if agreement.effective_from <= today {
        return Err(ApiError::conflict(STARTED));
    }
    sqlx::query("DELETE FROM crm_commission_agreements WHERE id=$1")
        .bind(id)
        .execute(&mut *transaction)
        .await?;
    let reopened: Option<Uuid> = sqlx::query_scalar(
        "UPDATE crm_commission_agreements SET effective_to=$4::date WHERE workspace_id=$1 \
         AND agent_id=$2 AND effective_to=$3::date RETURNING id",
    )
    .bind(workspace)
    .bind(agreement.agent_id)
    .bind(&agreement.effective_from)
    .bind(&agreement.effective_to)
    .fetch_optional(&mut *transaction)
    .await?;
    let removed = Changes::default()
        .pair("agentShareBp", agreement.agent_share_bp, Value::Null)
        .pair(
            "effectiveFrom",
            agreement.effective_from.clone(),
            Value::Null,
        )
        .pair("effectiveTo", agreement.effective_to.clone(), Value::Null);
    events::append(
        &mut transaction,
        workspace,
        Entity::Agreement,
        id,
        Action::Deleted,
        actor,
        removed,
        None,
    )
    .await?;
    if let Some(previous) = reopened {
        let changes = Changes::default().pair(
            "effectiveTo",
            agreement.effective_from.clone(),
            agreement.effective_to.clone(),
        );
        events::append(
            &mut transaction,
            workspace,
            Entity::Agreement,
            previous,
            Action::Reopened,
            actor,
            changes,
            None,
        )
        .await?;
    }
    transaction.commit().await?;
    Ok(reopened.map(|previous| (previous, agreement.effective_to)))
}
