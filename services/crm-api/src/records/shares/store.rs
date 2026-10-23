//! Share rows (docs/record-sharing.md R1, amendments 6 and 8). A pending share past its end
//! reads as `expired` and is marked so under the lock before any write; every closing goes
//! through `close`, and the guard trigger removes the colleague's copy when an accepted
//! share closes.
use crate::{error::ApiResult, records::visibility::predicate};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

const STAMP: &str = "'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'";

#[derive(Clone, Debug, FromRow)]
pub struct ShareRow {
    pub id: Uuid,
    pub record_id: Uuid,
    pub collection: String,
    pub from_id: Uuid,
    pub from_name: String,
    pub to_id: Uuid,
    pub to_name: String,
    /// The stored status, with a pending share past its end read as `expired`.
    pub status: String,
    pub holder_id: Option<Uuid>,
    pub title: Option<String>,
    pub community: Option<String>,
    pub person: Option<String>,
    pub created_at: String,
    pub expires_at: String,
    pub decided_at: Option<String>,
    pub closed_at: Option<String>,
    /// Whether the caller sees the record under the strict rule.
    pub caller_sees: Option<bool>,
}

/// `$1` workspace, `$2` the caller's predicate value (NULL for team scope).
pub fn select(tail: &str) -> String {
    let at = |column: &str| format!("to_char({column} AT TIME ZONE 'UTC',{STAMP})");
    format!(
        "SELECT s.id,s.record_id,s.collection,s.from_id,f.name AS from_name,s.to_id, \
         t.name AS to_name,CASE WHEN s.status='pending' AND s.expires_at<=clock_timestamp() \
         THEN 'expired' ELSE s.status END AS status,r.assignee_id AS holder_id, \
         r.payload->>'listing_title' AS title,r.payload->>'community' AS community, \
         r.payload->>'full_name' AS person,{} AS created_at,{} AS expires_at, \
         {} AS decided_at,{} AS closed_at,({}) AS caller_sees \
         FROM crm_record_shares s JOIN crm_records r ON r.id=s.record_id \
         JOIN crm_users f ON f.id=s.from_id JOIN crm_users t ON t.id=s.to_id \
         WHERE s.workspace_id=$1 {tail}",
        at("s.created_at"),
        at("s.expires_at"),
        at("s.decided_at"),
        at("s.closed_at"),
        predicate("r", "$1", "$2")
    )
}

/// The share `id` of this workspace, as `caller` reads it; `lock` takes it `FOR UPDATE`.
pub async fn find(
    tx: &mut Tx<'_>,
    workspace: &str,
    caller: Option<Uuid>,
    id: Uuid,
    lock: bool,
) -> ApiResult<Option<ShareRow>> {
    let tail = if lock {
        "AND s.id=$3 FOR UPDATE OF s"
    } else {
        "AND s.id=$3"
    };
    Ok(sqlx::query_as::<_, ShareRow>(&select(tail))
        .bind(workspace)
        .bind(caller)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?)
}

/// A new pending share; returns its ID.
pub async fn insert(
    tx: &mut Tx<'_>,
    (workspace, record, collection): (&str, Uuid, &str),
    (from, to): (Uuid, Uuid),
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_record_shares (id,workspace_id,record_id,collection,from_id,to_id, \
         status,created_at,expires_at) \
         VALUES ($1,$2,$3,$4,$5,$6,'pending',now(),now() + interval '336 hours')",
    )
    .bind(id)
    .bind(workspace)
    .bind(record)
    .bind(collection)
    .bind(from)
    .bind(to)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

/// Moves the share to `status`: `accepted` stays open; every other status closes it, by
/// `by` (None when the system ends it).
pub async fn set(tx: &mut Tx<'_>, id: Uuid, status: &str, by: Option<Uuid>) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_record_shares SET status=$2, \
         decided_at=CASE WHEN $2 IN ('accepted','declined') THEN now() ELSE decided_at END, \
         closed_at=CASE WHEN $2='accepted' THEN NULL ELSE now() END, \
         closed_by=CASE WHEN $2='accepted' THEN NULL ELSE $3 END WHERE id=$1",
    )
    .bind(id)
    .bind(status)
    .bind(by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Marks pending shares of `record` to `to` that are past their end as `expired`.
pub async fn expire_stale(tx: &mut Tx<'_>, record: Uuid, to: Uuid) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_record_shares SET status='expired',closed_at=now(),closed_by=NULL \
         WHERE record_id=$1 AND to_id=$2 AND status='pending' AND expires_at<=clock_timestamp()",
    )
    .bind(record)
    .bind(to)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Whether this colleague already has a live offer for the record. The workspace lock
/// makes the check stable through the following insert.
pub async fn open_exists(tx: &mut Tx<'_>, record: Uuid, to: Uuid) -> ApiResult<bool> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_record_shares WHERE record_id=$1 AND to_id=$2 \
         AND status IN ('pending','accepted'))",
    )
    .bind(record)
    .bind(to)
    .fetch_one(&mut **tx)
    .await?)
}
