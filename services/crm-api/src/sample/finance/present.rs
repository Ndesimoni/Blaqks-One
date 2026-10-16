//! Idempotency and tracking for sample finance rows (`crm_sample_finance`, migration 20).
//! A sample ID already in the workspace is skipped; one held by a row that is not
//! sample finance refuses the whole seed, as for sample records.
use super::super::{failed, target::UNCHANGED, Outcome};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// A finance table with legacy IDs: `(table, marker entity, report label)`. A closed list,
/// so table names never come from input.
pub type Table = (&'static str, &'static str, &'static str);
pub const DEALS: Table = ("crm_deals", "deal", "Deals");
pub const PAYMENTS: Table = ("crm_payments", "payment", "Payments");
pub const EXPENSES: Table = ("crm_expenses", "expense", "Expenses");

/// `(added, already present, skipped)` per kind of finance sample.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Tally {
    pub added: usize,
    pub present: usize,
    pub skipped: usize,
}

/// Whether `legacy` is already a sample row of `table` in the workspace (`true`), absent
/// (`false`), or taken by another row (a refusal).
pub async fn present(
    tx: &mut Tx<'_>,
    table: Table,
    workspace: &str,
    legacy: &str,
) -> Outcome<bool> {
    let (name, entity, label) = table;
    let found: Option<bool> = sqlx::query_scalar(&format!(
        "SELECT EXISTS(SELECT 1 FROM crm_sample_finance m WHERE m.entity=$3 \
         AND m.entity_id=t.id) FROM {name} t WHERE t.workspace_id=$1 AND t.legacy_id=$2"
    ))
    .bind(workspace)
    .bind(legacy)
    .bind(entity)
    .fetch_optional(&mut **tx)
    .await
    .map_err(failed)?;
    match found {
        Some(false) => Err(format!(
            "{label} {legacy} already exists in this workspace and is not sample data. \
             Remove it, then seed again.{UNCHANGED}"
        )),
        found => Ok(found.unwrap_or(false)),
    }
}

/// Whether `entity` row `id` is marked as sample finance.
pub async fn marked(tx: &mut Tx<'_>, entity: &str, id: Uuid) -> Outcome<bool> {
    sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_sample_finance WHERE entity=$1 AND entity_id=$2)",
    )
    .bind(entity)
    .bind(id)
    .fetch_one(&mut **tx)
    .await
    .map_err(failed)
}

/// Records a row this seed created, so `clear-sample` may remove it.
pub async fn mark(tx: &mut Tx<'_>, entity: &str, id: Uuid, workspace: &str) -> Outcome<()> {
    sqlx::query("INSERT INTO crm_sample_finance (entity,entity_id,workspace_id) VALUES ($1,$2,$3)")
        .bind(entity)
        .bind(id)
        .bind(workspace)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    Ok(())
}
