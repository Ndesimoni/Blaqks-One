//! Hand-overs as agreements (agreements design §14 A3a): every hand-over offered in the
//! app is recorded by the agreements module in the same transaction, and every decision
//! on it moves its agreement too. Finance never touches agreement tables; it calls the
//! agreements module, which never touches finance tables. Older and sample hand-overs
//! carry no agreement and are decided as before.
use super::{gate::STALE, handover_rows::HandoverRow, handover_store::Decision, row::DealRow};
use crate::{
    agreements::{
        handover::{self as evidence, Offer},
        handover_decide::{self, Approver, Decide},
        handover_terms::HandoverFacts,
        model::Party,
    },
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    finance::calc::{calculate, Fee, SecondSource, Terms},
    records::handover_facts,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const RELOAD: &str = "Reload the hand-over offer and decide again.";
pub const PENDING_FROZEN: &str =
    "This deal has a pending hand-over. Cancel it before changing the fee, client, property or split.";

/// The deal at `version`, not frozen by a pending hand-over recorded as an agreement.
pub fn unfrozen(deal: &DealRow, version: i64) -> ApiResult<()> {
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    if deal.pending_agreement.is_some() {
        return Err(ApiError::conflict(PENDING_FROZEN));
    }
    Ok(())
}

/// The deal's fee before any partner or agent split, in fils.
pub fn fee(deal: &DealRow) -> ApiResult<i64> {
    let fee = match deal.fee_basis.as_str() {
        "fixed" => Fee::Fixed {
            fee_fils: deal.fixed_fee_fils.unwrap_or(0),
        },
        _ => Fee::Percentage {
            agreed_value_fils: deal.agreed_value_fils,
            rate_bp: deal.fee_rate_bp.unwrap_or(0),
        },
    };
    let terms = Terms {
        fee,
        partner_share_bp: 0,
        agent_share_bp: None,
        second_share_bp: None,
        second_source: SecondSource::FirstAgent,
        vat_registered: false,
    };
    let calculation = calculate(&terms).map_err(|_| ApiError::invalid(RELOAD))?;
    Ok(calculation.gross_fils)
}

/// Records the holder's offer of `deal` to `to` and returns the agreement's ID.
pub async fn offer(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: &DealRow,
    (from, to): (Uuid, Uuid),
    referral: Option<i32>,
) -> ApiResult<Uuid> {
    let property = deal.property_ref.as_deref();
    let (client_name, property) =
        handover_facts::handover(tx, workspace, &deal.client_ref, property).await?;
    let facts = HandoverFacts {
        referral_bp: referral,
        fee_fils: fee(deal)?,
        client_name,
        property,
    };
    evidence::offer(
        tx,
        Offer {
            workspace,
            from,
            to,
            facts,
        },
    )
    .await
}

/// Moves the request's agreement with `decision`, taken by `live`. Accepting and
/// approving name the agreement version the decider saw; approving in place may carry
/// the Admin's referral share. An acceptance that needs approval is recorded while the
/// agreement stays sent; approving it records the approver's decision (§17).
pub async fn decide(
    tx: &mut Transaction<'_, Postgres>,
    request: &HandoverRow,
    (decision, live): (Decision, &UserRow),
    version: Option<i64>,
    share: Option<i32>,
) -> ApiResult<()> {
    let Some(agreement) = request.agreement_id else {
        return Ok(());
    };
    let members = (request.from_id, request.to_id);
    let decide = |version: Option<i64>| -> ApiResult<Decide> {
        Ok(Decide {
            agreement,
            version: version.ok_or(ApiError::invalid(RELOAD))?,
            actor: live.id,
            members,
            referral: request.referral_share_bp,
        })
    };
    let approver = match live.role.as_str() {
        "admin" => Approver::Admin,
        _ => Approver::Chosen,
    };
    match decision {
        Decision::Accept if request.requires_approval => {
            handover_decide::accept_awaiting(tx, &decide(version)?).await
        }
        Decision::Accept => handover_decide::accept(tx, &decide(version)?).await,
        Decision::ApproveAcceptance => {
            handover_decide::approve_acceptance(tx, &decide(version)?, approver).await
        }
        Decision::Approve => handover_decide::approve(tx, &decide(version)?, share).await,
        Decision::Decline if live.id == request.to_id => {
            evidence::decline(tx, agreement, members).await
        }
        Decision::Cancel if live.id == request.requested_by => {
            evidence::withdraw(tx, agreement, live.id, Some(Party::Sender)).await
        }
        Decision::Decline | Decision::RejectAcceptance
            if evidence::expired(tx, agreement).await? =>
        {
            Err(ApiError::conflict(evidence::EXPIRED))
        }
        Decision::Decline | Decision::Cancel | Decision::RejectAcceptance => {
            evidence::withdraw(tx, agreement, live.id, None).await
        }
    }
}
