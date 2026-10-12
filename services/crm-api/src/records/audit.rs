use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn append(
    transaction: &mut Transaction<'_, Postgres>,
    actor: Uuid,
    workspace: &str,
    action: &str,
    collection: &str,
    record: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO crm_activity (id,actor_id,workspace_id,action,collection,record_id) \
         VALUES ($1,$2,$3,$4,$5,$6)",
    )
    .bind(Uuid::new_v4())
    .bind(actor)
    .bind(workspace)
    .bind(action)
    .bind(collection)
    .bind(record)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
