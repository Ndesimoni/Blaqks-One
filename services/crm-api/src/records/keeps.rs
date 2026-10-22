//! Read-only keeps of handed-over records (agreements design §18, H3 amendments 4–7).
//! When a deal hand-over moves the client and property, the sender keeps reading them
//! (`handed_over`); a listing that stays with the sender is shared with the receiver
//! (`shared`). A keep covers that one Clients or Properties row: it shows in the record
//! list and its photos, never in writes, pickers, recipients, children or projections.
use super::{mutation::Entry, visibility::predicate};
use crate::{auth::profile::UserRow, error::ApiResult};
use serde_json::{json, Map, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// One keep, written in the transaction that moves the deal.
pub struct NewKeep<'a> {
    pub workspace: &'a str,
    pub record: Uuid,
    pub member: Uuid,
    pub other: Uuid,
    /// `handed_over` or `shared`.
    pub reason: &'static str,
    pub deal_ref: &'a str,
    pub referral_share_bp: Option<i32>,
}

/// Records the keep; a later hand-over of the same record to the same member replaces it.
pub async fn insert(tx: &mut Tx<'_>, keep: &NewKeep<'_>) -> ApiResult<()> {
    let kind = match keep.referral_share_bp {
        Some(_) => "referral",
        None => "full",
    };
    sqlx::query(
        "INSERT INTO crm_record_keeps (workspace_id,record_id,member_id,other_id,reason, \
         deal_ref,kind,referral_share_bp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) \
         ON CONFLICT (record_id,member_id) DO UPDATE SET other_id=EXCLUDED.other_id, \
         reason=EXCLUDED.reason,deal_ref=EXCLUDED.deal_ref,kind=EXCLUDED.kind, \
         referral_share_bp=EXCLUDED.referral_share_bp,created_at=now()",
    )
    .bind(keep.workspace)
    .bind(keep.record)
    .bind(keep.member)
    .bind(keep.other)
    .bind(keep.reason)
    .bind(keep.deal_ref)
    .bind(kind)
    .bind(keep.referral_share_bp)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// A departing member's keeps end with their membership (amendment 6).
pub async fn forget(tx: &mut Tx<'_>, workspace: &str, member: Uuid) -> ApiResult<()> {
    sqlx::query("DELETE FROM crm_record_keeps WHERE workspace_id=$1 AND member_id=$2")
        .bind(workspace)
        .bind(member)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

#[derive(FromRow)]
pub struct KeptRow {
    #[sqlx(flatten)]
    pub entry: Entry,
    pub collection: String,
    pub reason: String,
    pub other_id: Uuid,
    pub other_name: String,
    pub keep_deal: String,
    pub kind: String,
    pub referral_share_bp: Option<i32>,
    pub kept_at: String,
}

impl KeptRow {
    /// The badge facts the screens show.
    pub fn badge(&self) -> Value {
        json!({"reason": self.reason, "other": {"id": self.other_id, "name": self.other_name},
            "dealId": self.keep_deal, "kind": self.kind,
            "referralShareBp": self.referral_share_bp, "at": self.kept_at})
    }
}

const KEPT: &str = "FROM crm_record_keeps k JOIN crm_records r ON r.id=k.record_id \
    JOIN crm_users o ON o.id=k.other_id WHERE k.workspace_id=$1 AND r.workspace_id=$1 \
    AND k.member_id=$2 AND r.collection IN ('Clients','Properties') AND r.collection=ANY($3)";

/// The caller's kept rows they do not already see, in granted collections. Team-scope
/// callers see every row, so they have none.
pub async fn listed(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    granted: &[&str],
    caller: Option<Uuid>,
) -> ApiResult<(Vec<KeptRow>, Value)> {
    if caller.is_none() {
        return Ok((Vec::new(), json!({})));
    }
    let sql = format!(
        "SELECT r.id,r.version,r.payload,r.assignee_id,r.collection,k.reason,k.other_id, \
         o.name AS other_name,k.deal_ref AS keep_deal,k.kind,k.referral_share_bp, \
         to_char(k.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') \
         AS kept_at {KEPT} AND NOT {} ORDER BY r.created_at,r.id",
        predicate("r", "$1", "$4")
    );
    let rows = sqlx::query_as::<_, KeptRow>(&sql)
        .bind(workspace)
        .bind(user.id)
        .bind(granted)
        .bind(caller)
        .fetch_all(&mut **tx)
        .await?;
    let badges: Map<String, Value> = rows
        .iter()
        .map(|row| (row.entry.id.to_string(), row.badge()))
        .collect();
    Ok((rows, Value::Object(badges)))
}

/// Whether the caller keeps record `id` of `collection` (for its photos and floor plans).
pub async fn readable(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    collection: &str,
    id: Uuid,
) -> ApiResult<bool> {
    if !user.can_collection(collection) {
        return Ok(false);
    }
    let sql = format!("SELECT EXISTS(SELECT 1 {KEPT} AND r.id=$4)");
    Ok(sqlx::query_scalar(&sql)
        .bind(workspace)
        .bind(user.id)
        .bind(vec![collection])
        .bind(id)
        .fetch_one(&mut **tx)
        .await?)
}
