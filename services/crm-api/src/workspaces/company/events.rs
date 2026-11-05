use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Detailed history contains identifiers, actions and type transitions only.
pub(super) async fn append(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    action: &str,
    from_type: Option<&str>,
    to_type: Option<&str>,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO crm_company_events (workspace_id,actor_id,action,from_type,to_type) \
         VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(workspace)
    .bind(actor)
    .bind(action)
    .bind(from_type)
    .bind(to_type)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
