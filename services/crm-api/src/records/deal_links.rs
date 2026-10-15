//! Interaction log deal links (finance-design §6.3, §13 L-F7). A link resolves only
//! through the `deal_ref` column, never by matching payload text, and a deal is linkable
//! or reported only when the finance predicate shows it to the caller.
use super::{
    collections::{Links, Slot},
    links::missing_message,
    list::Row,
    visibility::{finance_predicate, FinanceTable},
};
use crate::{
    auth::{finance_access::FinanceScope, profile::UserRow},
    error::{ApiError, ApiResult},
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// Value bound to the finance predicate's caller: `Some(None)` for team finance,
/// `Some(Some(id))` for the own view and `None` without the finance module.
fn finance_caller(user: &UserRow) -> Option<Option<Uuid>> {
    match user.finance_access().scope {
        FinanceScope::Team => Some(None),
        FinanceScope::Own => Some(Some(user.id)),
        FinanceScope::None => None,
    }
}

/// Step 8 for the deal slot. A changed, non-empty deal must be visible to the caller
/// under the finance predicate; hidden, unknown and other-workspace deals, and callers
/// without the finance module, get the identical `link_missing`. Unchanged links (equal
/// to the locked row's `deal_ref`) and cleared links are allowed. A grandfathered value
/// (payload text with `deal_ref` NULL) counts as changed, like legacy referrals. Call
/// under the workspace lock with the live profile.
pub async fn ensure(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    links: &Links,
    previous: Option<&Links>,
) -> ApiResult<()> {
    let Some(deal) = links.deal.as_deref() else {
        return Ok(());
    };
    if previous.and_then(|old| old.deal.as_deref()) == Some(deal) {
        return Ok(());
    }
    let missing = || ApiError::link_missing(missing_message(Slot::Deal));
    let caller = finance_caller(user).ok_or_else(missing)?;
    let sql = format!(
        "SELECT EXISTS(SELECT 1 FROM crm_deals d WHERE d.workspace_id=$1 AND d.legacy_id=$2 \
         AND {})",
        finance_predicate(FinanceTable::Deals, "d", "$1", "$3")
    );
    let present: bool = sqlx::query_scalar(&sql)
        .bind(workspace)
        .bind(deal)
        .bind(caller)
        .fetch_one(&mut **tx)
        .await?;
    present.then_some(()).ok_or_else(missing)
}

/// `dealLinks` projection: `{log_id, deal_id}` for visible Interaction logs whose
/// `deal_ref` names a deal the caller can see under the finance predicate. Grandfathered
/// values, hidden deals and callers without finance are all simply absent, so the UI
/// shows "Linked deal unavailable" without learning which case applies.
pub async fn projection(
    tx: &mut Tx<'_>,
    workspace: &str,
    user: &UserRow,
    rows: &[Row],
) -> ApiResult<Value> {
    let linked: Vec<(&str, &str)> = rows
        .iter()
        .filter(|row| row.collection == "Interaction log")
        .filter_map(|row| Some((row.legacy_id.as_str(), row.deal_ref.as_deref()?)))
        .collect();
    let Some(caller) = finance_caller(user).filter(|_| !linked.is_empty()) else {
        return Ok(json!([]));
    };
    let wanted: Vec<&str> = linked.iter().map(|(_, deal)| *deal).collect();
    let sql = format!(
        "SELECT d.legacy_id FROM crm_deals d WHERE d.workspace_id=$1 AND d.legacy_id=ANY($2) \
         AND {}",
        finance_predicate(FinanceTable::Deals, "d", "$1", "$3")
    );
    let visible: Vec<String> = sqlx::query_scalar(&sql)
        .bind(workspace)
        .bind(&wanted)
        .bind(caller)
        .fetch_all(&mut **tx)
        .await?;
    let entries = linked
        .into_iter()
        .filter(|(_, deal)| visible.iter().any(|id| id == deal))
        .map(|(log, deal)| json!({"log_id": log, "deal_id": deal}));
    Ok(Value::Array(entries.collect()))
}

#[cfg(test)]
#[path = "deal_links_tests.rs"]
mod tests;
