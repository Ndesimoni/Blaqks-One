use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn append(
    transaction: &mut Transaction<'_, Postgres>,
    actor: Uuid,
    workspace: &str,
    member: Uuid,
    action: &str,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO crm_team_activity (id,actor_id,workspace_id,member_id,action) \
         VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(actor)
    .bind(workspace)
    .bind(member)
    .bind(action)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
