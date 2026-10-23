//! System endings called by other modules inside their own transactions: a member leaving
//! their company (`member_left`) and a company archived (`company_closed`). Each ends the
//! open outside shares through the same database function the records triggers use.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// Ends the open shares sent by or to `member` of `workspace`.
pub async fn end_for_member(tx: &mut Tx<'_>, workspace: &str, member: Uuid) -> ApiResult<()> {
    sqlx::query(
        "SELECT agreements.crm_listing_shares_end(ARRAY(SELECT id FROM \
         agreements.crm_listing_shares WHERE status IN ('pending','accepted') \
         AND ((workspace_id=$1 AND from_id=$2) OR (recipient_workspace_id=$1 AND to_id=$2)) \
         ORDER BY id),'member_left')",
    )
    .bind(workspace)
    .bind(member)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Ends every open share from or to `workspace`.
pub async fn end_for_company(tx: &mut Tx<'_>, workspace: &str) -> ApiResult<()> {
    sqlx::query(
        "SELECT agreements.crm_listing_shares_end(ARRAY(SELECT id FROM \
         agreements.crm_listing_shares WHERE status IN ('pending','accepted') \
         AND (workspace_id=$1 OR recipient_workspace_id=$1) ORDER BY id),'company_closed')",
    )
    .bind(workspace)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
