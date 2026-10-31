//! System-driven share endings. Callers already hold the workspace lock. Closing an
//! accepted share invokes the database guard, which removes its colleague keep.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// Under the workspace lock, ends a colleague share before the caller locks a legacy-ID
/// record and writes a hand-over keep without changing its holder.
pub async fn end_held_legacy_to(
    tx: &mut Tx<'_>,
    (workspace, collection, legacy): (&str, &str, &str),
    (holder, member): (Uuid, Uuid),
) -> ApiResult<()> {
    let record: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM crm_records WHERE workspace_id=$1 AND collection=$2 \
         AND legacy_id=$3 AND assignee_id=$4",
    )
    .bind(workspace)
    .bind(collection)
    .bind(legacy)
    .bind(holder)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(record) = record {
        end_to(tx, record, member).await?;
    }
    Ok(())
}

/// Ends the open share of `record` to `member` before a hand-over keep replaces it.
pub async fn end_to(tx: &mut Tx<'_>, record: Uuid, member: Uuid) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_record_shares SET status='ended',closed_at=now(),closed_by=NULL \
         WHERE record_id=$1 AND to_id=$2 AND status IN ('pending','accepted')",
    )
    .bind(record)
    .bind(member)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Departure ends open shares from and to `member`; grant loss ends received shares in
/// `collections`. This must run before the member's keeps are forgotten.
pub async fn end_for_member(
    tx: &mut Tx<'_>,
    workspace: &str,
    member: Uuid,
    (collections, departure): (&[&str], bool),
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_record_shares SET status='ended',closed_at=now(),closed_by=NULL \
         WHERE workspace_id=$1 AND status IN ('pending','accepted') \
         AND (to_id=$2 AND ($4 OR collection=ANY($3)) OR ($4 AND from_id=$2))",
    )
    .bind(workspace)
    .bind(member)
    .bind(collections)
    .bind(departure)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
