//! The holder's offer of their locked deal (§13 H-F1, agreements design §17): one open
//! request per deal, an eligible receiver (active staff with Finance, or the company's
//! Admin for a full hand-over), the move rules and, when asked, a chosen approver.
use super::{
    assign::SHARES,
    handover::{HOLDER_ONLY, PENDING},
    handover_checks::{self as checks, Receiver},
    handover_evidence,
    handover_rows::{CAP, HAS_SECOND},
    row::DealRow,
    split::REVISE,
};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    finance::errors::INELIGIBLE,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// What the holder offers: the receiver, an optional referral share and approver.
#[derive(Clone, Copy, Debug)]
pub struct Terms {
    pub to: Uuid,
    pub referral: Option<i32>,
    pub approver: Option<Uuid>,
}

/// Business rules for moving `deal` to `to` with an optional referral (step 9).
pub async fn ensure_move(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: &DealRow,
    to: Uuid,
    referral: Option<i32>,
) -> ApiResult<()> {
    if referral.is_some() && deal.earned() {
        return Err(ApiError::conflict(REVISE));
    }
    if referral.is_some() && deal.second_agent_id.is_some() {
        return Err(ApiError::conflict(HAS_SECOND));
    }
    if !deal.earned() && deal.second_agent_id == Some(to) {
        return Err(ApiError::conflict(SHARES));
    }
    if let Some(share) = referral {
        if share > checks::cap(tx, workspace).await? {
            return Err(ApiError::conflict(CAP));
        }
    }
    Ok(())
}

/// Amendment 13: a staff sender, a staff receiver and an approver who is neither of them
/// nor the deal's second agent, and who may approve now.
async fn ensure_approver(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    (live, deal): (&UserRow, &DealRow),
    (terms, receiver): (&Terms, Receiver),
) -> ApiResult<()> {
    let Some(approver) = terms.approver else {
        return Ok(());
    };
    if live.role != "staff" || receiver == Receiver::Admin {
        return Err(ApiError::invalid(checks::ADMIN_NO_APPROVAL));
    }
    if [Some(live.id), Some(terms.to), deal.second_agent_id].contains(&Some(approver)) {
        return Err(ApiError::invalid(checks::APPROVER_ROLE));
    }
    if !checks::approver(tx, workspace, approver).await? {
        return Err(ApiError::invalid(checks::APPROVER));
    }
    Ok(())
}

/// Steps 7–10 on the locked deal with the live holder, then the pending request; returns
/// its ID. `evidence` records the offer as an agreement; the sample data command records
/// none (and never asks for approval).
pub async fn offer(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    deal: &DealRow,
    terms: Terms,
    evidence: bool,
) -> ApiResult<Uuid> {
    let (to, referral) = (terms.to, terms.referral);
    if deal.assignee_id != Some(live.id) {
        return Err(ApiError::denied(HOLDER_ONLY));
    }
    if deal.pending_handover.is_some() {
        return Err(ApiError::conflict(PENDING));
    }
    let receiver = match to == live.id {
        true => None,
        false => checks::receiver(tx, workspace, to).await?,
    };
    let Some(receiver) = receiver else {
        return Err(ApiError::invalid(INELIGIBLE));
    };
    if receiver == Receiver::Admin && referral.is_some() {
        return Err(ApiError::invalid(checks::TO_ADMIN_FULL));
    }
    if live.role != "staff" && referral.is_some() {
        return Err(ApiError::invalid(checks::AGENT_REFERRAL));
    }
    ensure_approver(tx, workspace, (live, deal), (&terms, receiver)).await?;
    if terms.approver.is_some() && !evidence {
        return Err(ApiError::invalid(checks::APPROVER));
    }
    ensure_move(tx, workspace, deal, to, referral).await?;
    let agreement = match evidence {
        true => Some(handover_evidence::offer(tx, workspace, deal, (live.id, to), referral).await?),
        false => None,
    };
    let handover = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_deal_handovers (id,workspace_id,deal_id,from_id,to_id, \
         referral_share_bp,requested_by,agreement_id,requires_approval,approver_id) \
         VALUES ($1,$2,$3,$4,$5,$6,$4,$7,$8,$9)",
    )
    .bind(handover)
    .bind(workspace)
    .bind(deal.id)
    .bind(live.id)
    .bind(to)
    .bind(referral)
    .bind(agreement)
    .bind(terms.approver.is_some())
    .bind(terms.approver)
    .execute(&mut **tx)
    .await?;
    Ok(handover)
}
