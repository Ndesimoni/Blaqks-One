//! Auth-owned removal of personal identity data from abandoned invitations.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn tombstone(
    transaction: &mut Transaction<'_, Postgres>,
    user: Uuid,
    email: &str,
) -> ApiResult<bool> {
    let tombstone = format!("released-{user}@released.invalid");
    let changed = sqlx::query(
        "UPDATE crm_users SET name='Released invitation',email=$2,phone='+0000000', \
         deleted_at=now(),version=version+1 WHERE id=$1 AND email=$3",
    )
    .bind(user)
    .bind(tombstone)
    .bind(email)
    .execute(&mut **transaction)
    .await?;
    Ok(changed.rows_affected() == 1)
}
