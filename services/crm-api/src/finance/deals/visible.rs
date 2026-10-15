//! Deal lookups for other modules (service-boundaries C5/C6): whether deals exist in the
//! workspace and are visible under the finance predicate. Callers bind `caller` as the
//! predicate expects: `None` for team finance, `Some(id)` for the own view.
use crate::{
    error::ApiResult,
    finance::visibility::{finance_predicate, FinanceTable},
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// The identical `link_missing` message for a hidden, unknown or other-workspace deal.
pub const DEAL_MISSING: &str =
    "The linked deal is missing from this workspace. Choose another deal or clear it.";

/// Whether `deal` (a legacy ID) is in the workspace and visible to `caller`.
pub async fn exists(
    tx: &mut Tx<'_>,
    workspace: &str,
    deal: &str,
    caller: Option<Uuid>,
) -> ApiResult<bool> {
    let sql = format!(
        "SELECT EXISTS(SELECT 1 FROM crm_deals d WHERE d.workspace_id=$1 AND d.legacy_id=$2 \
         AND {})",
        finance_predicate(FinanceTable::Deals, "d", "$1", "$3")
    );
    Ok(sqlx::query_scalar(&sql)
        .bind(workspace)
        .bind(deal)
        .bind(caller)
        .fetch_one(&mut **tx)
        .await?)
}

/// The legacy IDs among `wanted` that are in the workspace and visible to `caller`.
pub async fn among(
    tx: &mut Tx<'_>,
    workspace: &str,
    wanted: &[&str],
    caller: Option<Uuid>,
) -> ApiResult<Vec<String>> {
    let sql = format!(
        "SELECT d.legacy_id FROM crm_deals d WHERE d.workspace_id=$1 AND d.legacy_id=ANY($2) \
         AND {}",
        finance_predicate(FinanceTable::Deals, "d", "$1", "$3")
    );
    Ok(sqlx::query_scalar(&sql)
        .bind(workspace)
        .bind(wanted)
        .bind(caller)
        .fetch_all(&mut **tx)
        .await?)
}
