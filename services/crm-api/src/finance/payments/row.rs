//! Payment rows behind every payment read, through the shared finance-predicate query.
use crate::{
    auth::profile::UserRow,
    error::ApiResult,
    finance::entry::{self, EntryState, Kind},
};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Debug, FromRow)]
pub struct PaymentRow {
    #[sqlx(flatten)]
    pub state: EntryState,
    pub deal_ref: String,
    pub receipt_date: String,
    pub vat_fils: i64,
    pub reference: Option<String>,
}

const EXTRA: &str = ",x.deal_ref,x.receipt_date::text AS receipt_date,x.vat_fils,x.reference";

/// Visible payments, optionally on one agent's deals or one payment, oldest first.
pub async fn visible(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    agent: Option<Uuid>,
    only: Option<Uuid>,
) -> ApiResult<Vec<PaymentRow>> {
    let sql = entry::select(Kind::Payment, EXTRA, "ORDER BY x.created_at,x.id");
    entry::fetch(tx, &sql, workspace, user, agent, only).await
}

/// Step 5 for edits: the visible payment, locked, or the identical 404.
pub async fn locked(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    id: Uuid,
) -> ApiResult<PaymentRow> {
    let sql = entry::select(Kind::Payment, EXTRA, "FOR UPDATE OF x");
    let rows = entry::fetch::<PaymentRow>(tx, &sql, workspace, user, None, Some(id)).await?;
    rows.into_iter()
        .next()
        .ok_or_else(crate::error::ApiError::missing)
}
