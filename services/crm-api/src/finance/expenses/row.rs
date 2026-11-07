//! Expense rows behind every expense read, through the shared finance-predicate query.
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    finance::entry::{self, EntryState, Kind},
};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Debug, FromRow)]
pub struct ExpenseRow {
    #[sqlx(flatten)]
    pub state: EntryState,
    pub incurred_by: Uuid,
    pub incurred_name: String,
    pub date_paid: String,
    pub category: Option<String>,
    pub supplier: Option<String>,
    pub campaign_reference: Option<String>,
    pub property_ref: Option<String>,
    pub receipt_url: Option<String>,
}

const EXTRA: &str = ",x.incurred_by,(SELECT i.name FROM crm_users i WHERE i.id=x.incurred_by) \
    AS incurred_name,x.date_paid::text AS date_paid,x.category,x.supplier,x.campaign_reference, \
    x.property_ref,x.receipt_url";

/// Visible expenses, optionally one member's or one expense, oldest first.
pub async fn visible(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    agent: Option<Uuid>,
    only: Option<Uuid>,
) -> ApiResult<Vec<ExpenseRow>> {
    let sql = entry::select(Kind::Expense, EXTRA, "ORDER BY x.created_at,x.id");
    entry::fetch(tx, &sql, workspace, user, agent, only).await
}

/// Step 5 for edits: the visible expense, locked, or the identical 404.
pub async fn locked(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    id: Uuid,
) -> ApiResult<ExpenseRow> {
    let sql = entry::select(Kind::Expense, EXTRA, "FOR UPDATE OF x");
    let rows = entry::fetch::<ExpenseRow>(tx, &sql, workspace, user, None, Some(id)).await?;
    rows.into_iter().next().ok_or_else(ApiError::missing)
}
