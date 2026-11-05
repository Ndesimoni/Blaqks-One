//! The marketplace's own history (review amendment 5): insert-only rows that name the member
//! and the action, never a field value, address or message body. `crm_activity` belongs to
//! records and is not used here.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn append(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    member: Uuid,
    action: &str,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO marketplace.crm_market_events (id,workspace_id,actor_id,member_id,action) \
         VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(actor)
    .bind(member)
    .bind(action)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
