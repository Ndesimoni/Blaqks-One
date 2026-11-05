//! Who still holds listings shared outside the company (R2a security review L7, owner
//! decision 2026-10-24): a member who shared a listing reads its whole shared copy only
//! while they hold the listing; afterwards they keep the introduction record. Agreements
//! calls this; it never reads `crm_records`.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use std::collections::HashSet;
use uuid::Uuid;

/// The listings among `ids` of `workspace` that `member` holds now. A deleted listing is
/// held by no one.
pub async fn held_by(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    ids: &[Uuid],
) -> ApiResult<HashSet<Uuid>> {
    if ids.is_empty() {
        return Ok(HashSet::new());
    }
    let held: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM crm_records WHERE workspace_id=$1 AND collection='Properties' \
         AND assignee_id=$2 AND id=ANY($3)",
    )
    .bind(workspace)
    .bind(member)
    .bind(ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(held.into_iter().collect())
}
