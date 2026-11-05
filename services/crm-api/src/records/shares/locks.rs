//! Member-row locks taken last in the R1 workspace → share → record → member order.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn members(tx: &mut Transaction<'_, Postgres>, members: &[Uuid]) -> ApiResult<()> {
    let mut ids = members.to_vec();
    ids.sort_unstable();
    ids.dedup();
    sqlx::query("SELECT 1 FROM crm_users WHERE id=ANY($1) ORDER BY id FOR SHARE")
        .bind(ids)
        .fetch_all(&mut **tx)
        .await?;
    Ok(())
}
