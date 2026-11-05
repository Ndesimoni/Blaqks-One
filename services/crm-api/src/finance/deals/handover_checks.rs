//! Who may receive and who may approve a hand-over (agreements design §17, H2 amendments
//! 12 and 13), checked live with the member row locked `FOR SHARE`, and the team's
//! referral limit.
use super::links;
use crate::{auth::profile::UserRow, error::ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const TO_ADMIN_FULL: &str =
    "A hand-over to your Admin is a full hand-over, without a referral share or an approval.";
pub const APPROVER: &str =
    "Choose an approver who can approve finance records: your Admin or a colleague with the Approve right.";
pub const APPROVER_ROLE: &str =
    "The approver can't be you, the receiver or the deal's second agent.";
pub const AGENT_REFERRAL: &str =
    "Only an agent can keep a referral share. Offer the deal as a full hand-over.";
pub const ADMIN_NO_APPROVAL: &str =
    "Needs approval is not available when you or the receiver is the Admin.";

/// Who can receive a deal.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Receiver {
    Staff,
    /// The company's own Admin, never the Super Admin.
    Admin,
}

async fn member(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
) -> ApiResult<Option<UserRow>> {
    sqlx::query("SELECT 1 FROM crm_users WHERE id=$1 FOR SHARE")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?;
    Ok(sqlx::query_as::<_, UserRow>(
        "SELECT * FROM crm_user_profiles WHERE id=$1 AND workspace_id=$2 AND active \
         AND owner_active",
    )
    .bind(id)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?)
}

/// The active staff member with Finance, or the company's Admin, who may hold the deal.
pub async fn receiver(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
) -> ApiResult<Option<Receiver>> {
    if !links::finance_member(tx, workspace, id, false).await? {
        return Ok(None);
    }
    let found = member(tx, workspace, id).await?;
    Ok(found.and_then(|row| match row.role.as_str() {
        "staff" => Some(Receiver::Staff),
        "admin" => Some(Receiver::Admin),
        _ => None,
    }))
}

/// Whether `id` may approve hand-overs of this company now: its Admin, or active staff
/// holding the Finance Approve right.
pub async fn approver(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
) -> ApiResult<bool> {
    let found = member(tx, workspace, id).await?;
    Ok(found.is_some_and(|row| eligible(&row, workspace)))
}

/// A member of `workspace` who may approve: the Admin or staff with Approve.
pub fn eligible(row: &UserRow, workspace: &str) -> bool {
    row.workspace_id == workspace
        && matches!(row.role.as_str(), "staff" | "admin")
        && row.finance_access().approve
}

/// The team's referral cap (0 before settings exist).
pub async fn cap(tx: &mut Transaction<'_, Postgres>, workspace: &str) -> ApiResult<i32> {
    let cap: Option<i32> = sqlx::query_scalar(
        "SELECT max_referral_share_bp FROM crm_finance_settings WHERE workspace_id=$1 FOR SHARE",
    )
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(cap.unwrap_or(0))
}

pub const OPEN_HANDOVER: &str =
    "This deal has an open hand-over. Cancel it before earning, unearning or revising the deal.";

/// The deal at `version` with no open hand-over (amendment 16): earning, unearning and
/// revising wait until the hand-over is decided or cancelled.
pub fn settled(deal: &super::row::DealRow, version: i64) -> ApiResult<()> {
    if deal.version != version {
        return Err(crate::error::ApiError::stale(super::gate::STALE));
    }
    if deal.pending_handover.is_some() {
        return Err(crate::error::ApiError::conflict(OPEN_HANDOVER));
    }
    Ok(())
}
