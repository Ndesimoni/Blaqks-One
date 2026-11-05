//! Reading keeps (agreements design §18, docs/record-sharing.md R1): kept rows in the
//! record list, outside projections and deal links, each cut to what its reason may show,
//! and the photos of a kept record. Contacts are kept only through a colleague share.
use super::{handover_listing, mutation::Entry, share_fields, visibility::predicate};
use crate::{auth::profile::UserRow, error::ApiResult};
use serde_json::{json, Map, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

#[derive(FromRow)]
pub struct KeptRow {
    #[sqlx(flatten)]
    pub entry: Entry,
    pub collection: String,
    pub reason: String,
    pub other_id: Uuid,
    pub other_name: String,
    pub keep_deal: Option<String>,
    pub kind: Option<String>,
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
    AND k.member_id=$2 AND (r.collection IN ('Clients','Properties') \
    OR (r.collection='Contacts' AND k.reason='colleague')) AND r.collection=ANY($3)";

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
         AS kept_at {KEPT} AND ({}) IS NOT TRUE ORDER BY r.created_at,r.id",
        predicate("r", "$1", "$4")
    );
    let mut rows = sqlx::query_as::<_, KeptRow>(&sql)
        .bind(workspace)
        .bind(user.id)
        .bind(granted)
        .bind(caller)
        .fetch_all(&mut **tx)
        .await?;
    // Never who holds it now (review L4); a shared listing is its allowlist only (M1).
    for row in &mut rows {
        row.entry.assignee = None;
        row.entry.record = match row.reason.as_str() {
            "shared" => handover_listing::shared(&row.entry.record),
            "colleague" => share_fields::copy(&row.collection, &row.entry.record),
            _ => continue,
        };
    }
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
