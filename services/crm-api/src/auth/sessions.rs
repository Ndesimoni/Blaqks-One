//! Session revocation for other modules (service-boundaries C5): auth owns `crm_sessions`,
//! so team suspensions and archives sign members out through these functions, inside the
//! caller's transaction.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Signs out `member` and every account they own (an Admin's staff).
pub async fn revoke_member(
    transaction: &mut Transaction<'_, Postgres>,
    member: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "DELETE FROM crm_sessions WHERE user_id=$1 \
         OR user_id IN (SELECT id FROM crm_users WHERE owner_id=$1)",
    )
    .bind(member)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

/// Signs out every listed account.
pub async fn revoke_all(
    transaction: &mut Transaction<'_, Postgres>,
    members: &[Uuid],
) -> ApiResult<()> {
    sqlx::query("DELETE FROM crm_sessions WHERE user_id=ANY($1)")
        .bind(members)
        .execute(&mut **transaction)
        .await?;
    Ok(())
}
