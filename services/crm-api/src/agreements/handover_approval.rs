//! The approval step of an in-company hand-over that needs approval (design §17, H2
//! amendments 3–4 and 7). The receiving agent has accepted the current revision and the
//! agreement is still `sent`; the chosen approver or the company's Admin then approves that
//! same revision, which accepts the agreement in the transaction that moves the deal. This
//! path writes no revision and cannot change the share. Finance checks who may approve.
use super::{
    handover::CHANGED,
    handover_decide::{open, Decide},
    ledger,
    model::Verification,
    store,
};
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};

/// Who approves the receiver's acceptance: the company's Admin, or the approver the
/// sender chose. Each is recorded as its own verification.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Approver {
    Admin,
    Chosen,
}

impl Approver {
    pub fn verification(self) -> Verification {
        match self {
            Self::Admin => Verification::AdminDecision,
            Self::Chosen => Verification::ApproverDecision,
        }
    }
}

/// Approves the receiving agent's acceptance of the current revision. `d.version` is the
/// agreement version after that acceptance; neither participant may approve.
pub async fn approve_acceptance(
    tx: &mut Transaction<'_, Postgres>,
    d: &Decide,
    approver: Approver,
) -> ApiResult<()> {
    let (row, revision) = open(tx, d).await?;
    if d.actor == d.members.0 || d.actor == d.members.1 {
        return Err(ApiError::forbidden());
    }
    if store::accepted_by(tx, revision.id).await? != Some(d.members.1) {
        return Err(ApiError::conflict(CHANGED));
    }
    ledger::bump(tx, d.agreement, row.version, "accepted", None, None).await?;
    let evidence = (revision.id, revision.digest.as_str());
    ledger::approve(tx, d.agreement, evidence, d.actor, approver.verification()).await
}
