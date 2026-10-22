//! The deal row and the one finance-predicate query every deal read uses (§5.2), so
//! hidden, unknown and other-workspace IDs all give the same 404.
use super::{gate, row_sql::select};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use serde_json::Value;
use sqlx::{types::Json, FromRow, Postgres, Transaction};
use uuid::Uuid;

pub const LOST: [&str; 2] = ["Lost", "Cancelled"];

#[derive(Clone, Debug, FromRow)]
pub struct DealRow {
    pub id: Uuid,
    pub version: i64,
    pub legacy_id: String,
    pub assignee_id: Option<Uuid>,
    pub assignee_name: Option<String>,
    /// Whether the holder is staff; Admin/owner-held and queued deals have no agent lines.
    pub assignee_staff: bool,
    pub client_ref: String,
    pub property_ref: Option<String>,
    pub deal_type: String,
    pub stage: String,
    pub agreed_value_fils: i64,
    pub fee_basis: String,
    pub fee_rate_bp: Option<i32>,
    pub fixed_fee_fils: Option<i64>,
    pub partner_share_bp: i32,
    pub partner_name: Option<String>,
    pub second_agent_id: Option<Uuid>,
    pub second_agent_name: Option<String>,
    pub second_agent_share_bp: Option<i32>,
    pub second_agent_kind: Option<String>,
    pub override_agent_share_bp: Option<i32>,
    pub override_reason: Option<String>,
    pub earned_on: Option<String>,
    pub details: Json<Value>,
    /// The creation date in Asia/Dubai (§13 M-F2).
    pub created_on: String,
    /// Whether any snapshot was ever written (deletes need none).
    pub ever_earned: bool,
    /// Approved receipts (`crm_deal_approved_fils`, 0 until payments exist).
    pub approved_fils: i64,
    /// §13 H-F1: the acting user reassigned or handed on the deal since its last
    /// earn or unearn.
    pub reassigned_by_actor: bool,
    pub pending_handover: Option<Uuid>,
    /// The agreement recording the pending hand-over, if it has one (agreements §14).
    pub pending_agreement: Option<Uuid>,
}

impl DealRow {
    pub fn earned(&self) -> bool {
        self.earned_on.is_some()
    }
}

/// `(acting user, predicate caller)`.
type Who = (Uuid, Option<Uuid>);

async fn query(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    (actor, caller): Who,
    holder: Option<Uuid>,
    only: Option<Uuid>,
    tail: &str,
) -> ApiResult<Vec<DealRow>> {
    Ok(sqlx::query_as::<_, DealRow>(&select(tail))
        .bind(workspace)
        .bind(actor)
        .bind(caller)
        .bind(holder)
        .bind(only)
        .fetch_all(&mut **transaction)
        .await?)
}

/// Step 5: the visible deal, locked (`FOR UPDATE`), or the identical 404.
pub async fn locked(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    id: Uuid,
) -> ApiResult<DealRow> {
    let who = (user.id, gate::caller(user));
    let found = query(
        transaction,
        workspace,
        who,
        None,
        Some(id),
        "FOR UPDATE OF d",
    )
    .await?;
    found.into_iter().next().ok_or_else(ApiError::missing)
}

/// The deal of a hand-over request the caller may decide, locked; the request itself
/// was the visibility check.
pub async fn locked_for_handover(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    id: Uuid,
) -> ApiResult<DealRow> {
    let who = (actor, None);
    let found = query(
        transaction,
        workspace,
        who,
        None,
        Some(id),
        "FOR UPDATE OF d",
    )
    .await?;
    found.into_iter().next().ok_or_else(ApiError::missing)
}

/// Visible deals, optionally one holder's or one deal, oldest first.
pub async fn visible(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    holder: Option<Uuid>,
    only: Option<Uuid>,
) -> ApiResult<Vec<DealRow>> {
    let who = (user.id, gate::caller(user));
    let tail = "ORDER BY d.created_at,d.id";
    query(transaction, workspace, who, holder, only, tail).await
}
