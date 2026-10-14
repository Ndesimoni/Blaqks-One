//! Agreement persistence under the workspace lock. Effective dates: `from` inclusive,
//! `to` exclusive; at most one open agreement per agent, which a later one auto-closes.
use super::{
    access,
    agreements::{AgreementRow, NewAgreement},
    errors::{NOT_STAFF, OVERLAP},
    events::{self, Action, Changes, Entity},
};
use crate::error::{ApiError, ApiResult};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

pub const EARNED: &str = "This agreement would apply to deals already earned.";
pub const SELECT: &str = "SELECT a.id,a.agent_id,u.name AS agent_name,a.agent_share_bp, \
    a.effective_from::text AS effective_from,a.effective_to::text AS effective_to \
    FROM crm_commission_agreements a JOIN crm_users u ON u.id=a.agent_id";

/// Agreements of one workspace (optionally one agent), by agent then start date.
pub async fn list(
    pool: &PgPool,
    workspace: &str,
    agent: Option<Uuid>,
) -> ApiResult<Vec<AgreementRow>> {
    let sql = format!(
        "{SELECT} WHERE a.workspace_id=$1 AND ($2::uuid IS NULL OR a.agent_id=$2) \
         ORDER BY u.name,a.agent_id,a.effective_from"
    );
    Ok(sqlx::query_as::<_, AgreementRow>(&sql)
        .bind(workspace)
        .bind(agent)
        .fetch_all(pool)
        .await?)
}

/// Returns the new agreement and the one it auto-closed (`id`, new `effectiveTo`).
pub async fn create(
    pool: &PgPool,
    actor: Uuid,
    workspace: &str,
    input: NewAgreement,
) -> ApiResult<(AgreementRow, Option<(Uuid, String)>)> {
    let mut transaction = pool.begin().await?;
    access::lock_manager(&mut transaction, workspace, actor).await?;
    let staff: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_users WHERE id=$1 AND role='staff' \
         AND workspace_id=$2 AND deleted_at IS NULL)",
    )
    .bind(input.agent_id)
    .bind(workspace)
    .fetch_one(&mut *transaction)
    .await?;
    if !staff {
        return Err(ApiError::invalid(NOT_STAFF));
    }
    // §13 M-F3: history is never rewritten by a backdated agreement.
    let earned: bool = sqlx::query_scalar("SELECT crm_agreement_applies_to_earned($1,$2,$3::date)")
        .bind(workspace)
        .bind(input.agent_id)
        .bind(&input.effective_from)
        .fetch_one(&mut *transaction)
        .await?;
    if earned {
        return Err(ApiError::conflict(EARNED));
    }
    let later: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_commission_agreements WHERE workspace_id=$1 \
         AND agent_id=$2 AND effective_from >= $3::date)",
    )
    .bind(workspace)
    .bind(input.agent_id)
    .bind(&input.effective_from)
    .fetch_one(&mut *transaction)
    .await?;
    if later {
        return Err(ApiError::conflict(OVERLAP));
    }
    let closed: Option<(Uuid, Option<String>)> = sqlx::query_as(
        "WITH old AS (SELECT id,effective_to FROM crm_commission_agreements WHERE workspace_id=$1 \
         AND agent_id=$2 AND effective_from < $3::date \
         AND (effective_to IS NULL OR effective_to > $3::date) FOR UPDATE) \
         UPDATE crm_commission_agreements a SET effective_to=$3::date FROM old WHERE a.id=old.id \
         RETURNING a.id, old.effective_to::text",
    )
    .bind(workspace)
    .bind(input.agent_id)
    .bind(&input.effective_from)
    .fetch_optional(&mut *transaction)
    .await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_commission_agreements \
         (id,workspace_id,agent_id,agent_share_bp,effective_from,created_by) \
         VALUES ($1,$2,$3,$4,$5::date,$6)",
    )
    .bind(id)
    .bind(workspace)
    .bind(input.agent_id)
    .bind(input.agent_share_bp)
    .bind(&input.effective_from)
    .bind(actor)
    .execute(&mut *transaction)
    .await?;
    let created = Changes::default()
        .pair("agentId", Value::Null, input.agent_id.to_string())
        .pair("agentShareBp", Value::Null, input.agent_share_bp)
        .pair("effectiveFrom", Value::Null, input.effective_from.clone());
    events::append(
        &mut transaction,
        workspace,
        Entity::Agreement,
        id,
        Action::Created,
        actor,
        created,
        None,
    )
    .await?;
    if let Some((old, before)) = &closed {
        let changes =
            Changes::default().pair("effectiveTo", before.clone(), input.effective_from.clone());
        events::append(
            &mut transaction,
            workspace,
            Entity::Agreement,
            *old,
            Action::Closed,
            actor,
            changes,
            None,
        )
        .await?;
    }
    let row = sqlx::query_as::<_, AgreementRow>(&format!("{SELECT} WHERE a.id=$1"))
        .bind(id)
        .fetch_one(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok((row, closed.map(|(old, _)| (old, input.effective_from))))
}
