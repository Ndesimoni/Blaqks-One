//! Locking and recording hand-over decisions (§13 H-F1, agreements design §17). A caller
//! who may not make a decision on a request gets the same 404 as for an unknown request;
//! a request at another step is a 409.
use super::{
    handover_rows::{self, HandoverRow, NOT_PENDING},
    handover_rules,
    views::Viewer,
};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Decision {
    Accept,
    Decline,
    Cancel,
    Approve,
    /// The chosen approver or an Admin approves the receiver's acceptance (H2).
    ApproveAcceptance,
    /// The chosen approver or an Admin rejects it; the request is cancelled.
    RejectAcceptance,
}

impl Decision {
    /// The status a decision ends in; an acceptance that needs approval waits instead.
    pub fn status(self) -> &'static str {
        match self {
            Self::Accept => "accepted",
            Self::Decline => "declined",
            Self::Cancel | Self::RejectAcceptance => "cancelled",
            Self::Approve | Self::ApproveAcceptance => "approved",
        }
    }

    /// Accepting (without an approval step) and approving move the deal.
    pub fn moves(self) -> bool {
        matches!(self, Self::Accept | Self::Approve | Self::ApproveAcceptance)
    }
}

/// Step 5: the request, locked, when this caller may make this decision (404 otherwise);
/// a request at another step is a 409. The chosen approver must be a member of this
/// company with the Approve right now (amendment 13).
pub async fn fetch(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    id: Uuid,
    decision: Decision,
) -> ApiResult<HandoverRow> {
    let locked: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM crm_deal_handovers WHERE id=$1 AND workspace_id=$2 FOR UPDATE",
    )
    .bind(id)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    if locked.is_none() {
        return Err(ApiError::missing());
    }
    let row = handover_rows::find(tx, id).await?;
    let member = live.workspace_id == workspace && matches!(live.role.as_str(), "staff" | "admin");
    if !member || !handover_rules::may(&row, decision, &Viewer::of(live)) {
        return Err(ApiError::missing());
    }
    if !handover_rules::fits(&row, decision) {
        return Err(ApiError::conflict(NOT_PENDING));
    }
    Ok(row)
}

pub async fn set_status(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    decision: Decision,
    referral: Option<i32>,
    actor: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_deal_handovers SET status=$2,referral_share_bp=$3,decided_by=$4, \
         decided_at=now() WHERE id=$1",
    )
    .bind(id)
    .bind(decision.status())
    .bind(referral)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The receiver accepted an offer that needs approval: it now waits for the approver.
pub async fn set_awaiting(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    actor: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_deal_handovers SET status='awaiting_approval',accepted_by=$2, \
         accepted_at=now() WHERE id=$1",
    )
    .bind(id)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
