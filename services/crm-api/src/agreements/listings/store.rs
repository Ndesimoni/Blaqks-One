//! Listing-share rows (migrations 0067–0068). A share past its time reads as closed at that
//! time and is marked so, with its true end, under the row lock before any write.
use crate::error::ApiResult;
use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

const STAMP: &str = "'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'";

#[derive(Clone, Debug, FromRow)]
pub struct ShareRow {
    pub id: Uuid,
    pub workspace_id: String,
    pub source_record_id: Uuid,
    pub from_id: Uuid,
    pub recipient_workspace_id: String,
    pub to_id: Uuid,
    /// The stored status, with a share past its time read as closed.
    pub status: String,
    pub end_reason: Option<String>,
    pub note: Option<String>,
    pub decline_known: bool,
    pub created_at: String,
    pub offer_ends_at: String,
    pub view_ends_at: String,
    pub opened_at: Option<String>,
    pub decided_at: Option<String>,
    pub closed_at: Option<String>,
    pub accepted_digest: Option<String>,
    pub from_name: Option<String>,
    pub from_email: Option<String>,
    pub from_phone: Option<String>,
    pub to_name: Option<String>,
    pub snapshot_id: Uuid,
    pub reference: String,
    pub facts: Value,
    pub media: Value,
    pub exact_location: bool,
    pub snapshot_digest: String,
    pub location_digest: Option<String>,
    pub location_salt: Option<String>,
}

impl ShareRow {
    pub fn open(&self) -> bool {
        matches!(self.status.as_str(), "pending" | "accepted")
    }
}

/// Every share column, with `tail` after `WHERE`.
pub fn select(tail: &str) -> String {
    let at = |column: &str| format!("to_char({column} AT TIME ZONE 'UTC',{STAMP})");
    format!(
        "SELECT s.id,s.workspace_id,s.source_record_id,s.from_id,s.recipient_workspace_id, \
         s.to_id,CASE WHEN l.lapsed THEN CASE WHEN s.status='pending' \
         AND s.offer_ends_at<=s.view_ends_at THEN 'expired' ELSE 'ended' END ELSE s.status END \
         AS status,CASE WHEN l.lapsed AND NOT (s.status='pending' \
         AND s.offer_ends_at<=s.view_ends_at) THEN 'end_date' ELSE s.end_reason END AS end_reason, \
         s.note,s.decline_known,{} AS created_at,{} AS offer_ends_at,{} AS view_ends_at, \
         {} AS opened_at,{} AS decided_at, \
         CASE WHEN l.lapsed THEN {} ELSE {} END AS closed_at,s.accepted_digest, \
         f.name AS from_name,f.email AS from_email,f.phone AS from_phone,t.name AS to_name, \
         s.snapshot_id,n.reference,n.facts,n.media,n.exact_location,n.digest AS snapshot_digest, \
         n.location_digest,n.location_salt \
         FROM agreements.crm_listing_shares s \
         JOIN agreements.crm_listing_snapshots n ON n.id=s.snapshot_id \
         CROSS JOIN LATERAL (SELECT CASE WHEN s.status='pending' \
           THEN least(s.offer_ends_at,s.view_ends_at) WHEN s.status='accepted' \
           THEN s.view_ends_at END AS at) e \
         CROSS JOIN LATERAL (SELECT coalesce(e.at<=clock_timestamp(),false) AS lapsed) l \
         LEFT JOIN crm_all_user_profiles f ON f.id=s.from_id \
         LEFT JOIN crm_all_user_profiles t ON t.id=s.to_id WHERE {tail}",
        at("s.created_at"),
        at("s.offer_ends_at"),
        at("s.view_ends_at"),
        at("s.opened_at"),
        at("s.decided_at"),
        at("e.at"),
        at("s.closed_at"),
    )
}

pub async fn find(tx: &mut Tx<'_>, id: Uuid) -> ApiResult<Option<ShareRow>> {
    Ok(sqlx::query_as(&select("s.id=$1"))
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?)
}

/// Locks the share, closes it first if its time has passed, and reads it again.
pub async fn locked(tx: &mut Tx<'_>, id: Uuid) -> ApiResult<Option<ShareRow>> {
    let found: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM agreements.crm_listing_shares WHERE id=$1 FOR UPDATE")
            .bind(id)
            .fetch_optional(&mut **tx)
            .await?;
    if found.is_none() {
        return Ok(None);
    }
    sqlx::query("SELECT agreements.crm_listing_shares_lapse(ARRAY[$1]::uuid[])")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    find(tx, id).await
}

/// One insert-only history entry.
pub async fn event(
    tx: &mut Tx<'_>,
    share: Uuid,
    action: &str,
    by: Option<(Uuid, &str)>,
    (reason, ends_at): (Option<&str>, Option<&str>),
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO agreements.crm_listing_share_events (id,share_id,action,actor_id,side, \
         reason,ends_at) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)",
    )
    .bind(Uuid::new_v4())
    .bind(share)
    .bind(action)
    .bind(by.map(|(actor, _)| actor))
    .bind(by.map(|(_, side)| side))
    .bind(reason)
    .bind(ends_at)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
