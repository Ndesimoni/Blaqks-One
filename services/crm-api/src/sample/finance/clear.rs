//! Removes marked sample finance in foreign-key order: payments and expenses, hand-overs,
//! commission lines and snapshots, deals, then agreements. The deletes pass the 0020
//! guard only because the rows are marked and the sample source is set. Deals, payments
//! and expenses log a `deleted` activity row; every removed entity gets a `deleted`
//! finance event. Settings the seed created go too unless they were changed in the app or
//! the team's own finance uses them; kept settings stop being sample data.
use super::super::{failed, target::Target, Outcome};
use crate::agreements::handover;
use sqlx::{Postgres, Transaction};

type Tx<'c> = Transaction<'c, Postgres>;

/// A finance table: `(table, marker entity, activity collection)`.
type Table = (&'static str, &'static str, Option<&'static str>);
const PAYMENTS: Table = ("crm_payments", "payment", Some("Payments"));
const EXPENSES: Table = ("crm_expenses", "expense", Some("Expenses"));
const DEALS: Table = ("crm_deals", "deal", Some("Deals"));
const AGREEMENTS: Table = ("crm_commission_agreements", "agreement", None);
const SETTINGS: Table = ("crm_finance_settings", "settings", None);

/// Offers made in the app on marked deals, still open: their agreements are withdrawn
/// before the hand-overs go (agreements design §14).
const OPEN_OFFERS: &str = "SELECT c.agreement_id FROM crm_deal_handovers c \
     JOIN crm_sample_finance m ON m.entity='deal' AND m.entity_id=c.deal_id \
     WHERE m.workspace_id=$1 AND c.status IN ('pending','awaiting_approval') \
     AND c.agreement_id IS NOT NULL";
/// Rows that belong to marked deals: hand-overs, then lines, then snapshots.
const HANDOVERS: &str = "DELETE FROM crm_deal_handovers c USING crm_sample_finance m \
     WHERE m.entity='deal' AND m.entity_id=c.deal_id AND m.workspace_id=$1 RETURNING c.id";
const LINES: &str = "DELETE FROM crm_deal_commission_lines c \
     USING crm_deal_snapshots s, crm_sample_finance m WHERE c.snapshot_id=s.id \
     AND m.entity='deal' AND m.entity_id=s.deal_id AND m.workspace_id=$1 RETURNING c.role";
const SNAPSHOTS: &str = "DELETE FROM crm_deal_snapshots c USING crm_sample_finance m \
     WHERE m.entity='deal' AND m.entity_id=c.deal_id AND m.workspace_id=$1 RETURNING c.id";

/// `(label, removed)` in deletion order, and whether sample settings were kept.
pub struct Cleared {
    pub counts: Vec<(&'static str, i64)>,
    pub settings_kept: bool,
}

pub async fn clear(tx: &mut Tx<'_>, target: &Target) -> Outcome<Cleared> {
    let (workspace, owner) = (target.workspace.as_str(), target.owner);
    let open: Vec<uuid::Uuid> = sqlx::query_scalar(OPEN_OFFERS)
        .bind(workspace)
        .fetch_all(&mut **tx)
        .await
        .map_err(failed)?;
    handover::withdraw_all(tx, &open, owner)
        .await
        .map_err(failed)?;
    let mut counts = vec![
        ("Payments", remove(tx, workspace, owner, PAYMENTS).await?),
        ("Expenses", remove(tx, workspace, owner, EXPENSES).await?),
        ("Hand-overs", count(tx, HANDOVERS, workspace).await?),
    ];
    count(tx, LINES, workspace).await?;
    count(tx, SNAPSHOTS, workspace).await?;
    counts.push(("Deals", remove(tx, workspace, owner, DEALS).await?));
    counts.push((
        "Agreements",
        remove(tx, workspace, owner, AGREEMENTS).await?,
    ));
    let settings_kept = settings(tx, workspace, owner, &mut counts).await?;
    sqlx::query("DELETE FROM crm_sample_finance WHERE workspace_id=$1")
        .bind(workspace)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    Ok(Cleared {
        counts,
        settings_kept,
    })
}

/// Runs one `DELETE … RETURNING` and counts the removed rows.
async fn count(tx: &mut Tx<'_>, delete: &str, workspace: &str) -> Outcome<i64> {
    sqlx::query_scalar(&format!(
        "WITH gone AS ({delete}) SELECT count(*) FROM gone"
    ))
    .bind(workspace)
    .fetch_one(&mut **tx)
    .await
    .map_err(failed)
}

/// Deletes the marked rows of one table, with their activity and finance events.
async fn remove(
    tx: &mut Tx<'_>,
    workspace: &str,
    owner: uuid::Uuid,
    (table, entity, collection): Table,
) -> Outcome<i64> {
    sqlx::query_scalar(&format!(
        "WITH gone AS (DELETE FROM {table} t USING crm_sample_finance m WHERE m.entity=$3 \
         AND m.entity_id=t.id AND m.workspace_id=$1 AND t.workspace_id=$1 RETURNING t.id), \
         logged AS (INSERT INTO crm_activity (id,actor_id,workspace_id,action,collection,\
         record_id) SELECT gen_random_uuid(),$2,$1,'deleted',$4,id FROM gone WHERE $4::text IS NOT NULL), \
         events AS (INSERT INTO crm_finance_events (id,workspace_id,entity,entity_id,action,\
         actor_id,created_at) SELECT gen_random_uuid(),$1,$3,id,'deleted',$2,clock_timestamp() \
         FROM gone) SELECT count(*) FROM gone"
    ))
    .bind(workspace)
    .bind(owner)
    .bind(entity)
    .bind(collection)
    .fetch_one(&mut **tx)
    .await
    .map_err(failed)
}

/// Removes sample settings nobody changed while no finance of the team's own remains;
/// otherwise keeps them as the team's settings. Returns whether they were kept.
async fn settings(
    tx: &mut Tx<'_>,
    workspace: &str,
    owner: uuid::Uuid,
    counts: &mut Vec<(&'static str, i64)>,
) -> Outcome<bool> {
    let in_use = "EXISTS (SELECT 1 FROM crm_finance_events f WHERE f.workspace_id=$1 \
         AND f.entity_id=t.id AND f.source<>'sample') OR EXISTS (SELECT 1 FROM crm_deals \
         WHERE workspace_id=$1) OR EXISTS (SELECT 1 FROM crm_expenses WHERE workspace_id=$1) \
         OR EXISTS (SELECT 1 FROM crm_commission_agreements WHERE workspace_id=$1)";
    let kept: bool = sqlx::query_scalar(&format!(
        "SELECT COALESCE(bool_or({in_use}),false) FROM crm_finance_settings t \
         JOIN crm_sample_finance m ON m.entity='settings' AND m.entity_id=t.id \
         WHERE t.workspace_id=$1"
    ))
    .bind(workspace)
    .fetch_one(&mut **tx)
    .await
    .map_err(failed)?;
    if kept {
        counts.push(("Finance settings", 0));
        return Ok(true);
    }
    let removed = remove(tx, workspace, owner, SETTINGS).await?;
    counts.push(("Finance settings", removed));
    Ok(false)
}
