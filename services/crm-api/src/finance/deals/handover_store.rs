//! Locking and recording hand-over decisions (§13 H-F1). A caller who may not make a
//! decision on a request gets the same 404 as for an unknown request.
use super::handover_rows::{self, HandoverRow, NOT_PENDING};
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
}

impl Decision {
    pub fn status(self) -> &'static str {
        match self {
            Self::Accept => "accepted",
            Self::Decline => "declined",
            Self::Cancel => "cancelled",
            Self::Approve => "approved",
        }
    }

    /// Accepting and approving move the deal; declining and cancelling do not.
    pub fn moves(self) -> bool {
        matches!(self, Self::Accept | Self::Approve)
    }

    /// Receivers accept or decline, requesters cancel, Admins decline, cancel or approve.
    pub fn allowed(self, live: &UserRow, to: Uuid, requester: Uuid) -> bool {
        let manage = live.finance_access().manage;
        match self {
            Self::Accept => to == live.id,
            Self::Decline => to == live.id || manage,
            Self::Cancel => requester == live.id || manage,
            Self::Approve => manage,
        }
    }
}

/// Step 5: the request, locked, when this caller may make this decision (404 otherwise);
/// a decided request is a 409.
pub async fn fetch(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    id: Uuid,
    decision: Decision,
) -> ApiResult<HandoverRow> {
    let locked: Option<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT to_id,requested_by,status FROM crm_deal_handovers WHERE id=$1 \
         AND workspace_id=$2 FOR UPDATE",
    )
    .bind(id)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    match locked {
        Some((to, requester, status)) if decision.allowed(live, to, requester) => {
            if status != "pending" {
                return Err(ApiError::conflict(NOT_PENDING));
            }
            handover_rows::find(tx, id).await
        }
        _ => Err(ApiError::missing()),
    }
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
