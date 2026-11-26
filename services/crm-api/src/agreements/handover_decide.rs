//! Accepting and approving an in-company hand-over (design §14–§17). The receiving agent
//! accepts exactly the revision at the version they were shown. An Admin approval is
//! recorded as itself (`approved`, `admin_decision`), never as the agent's acceptance;
//! a changed referral share is first written as a new revision by the Admin
//! (`handover_adjust.rs`). The approval step after an acceptance is in
//! `handover_approval.rs`.
pub use super::handover_approval::{approve_acceptance, Approver};
use super::{
    handover::{expired, locked, CHANGED, EXPIRED},
    handover_adjust::adjusted,
    ledger::{self, Response},
    model::{Party, State, Verification, STALE},
    rows::{AgreementRow, RevisionRow},
    store,
};
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const KIND_FIXED: &str = "Changing between a full hand-over and a referral needs a new offer.";

/// The hand-over being decided: its agreement at the version the decider saw, its two
/// members and the referral share finance holds for it.
pub struct Decide {
    pub agreement: Uuid,
    pub version: i64,
    pub actor: Uuid,
    pub members: (Uuid, Uuid),
    pub referral: Option<i32>,
}

pub(super) async fn open(
    tx: &mut Transaction<'_, Postgres>,
    d: &Decide,
) -> ApiResult<(AgreementRow, RevisionRow)> {
    let row = locked(tx, d.agreement, d.members).await?;
    if row.state() != State::Sent {
        return Err(ApiError::conflict(CHANGED));
    }
    if row.version != d.version {
        return Err(ApiError::stale(STALE));
    }
    if expired(tx, d.agreement).await? {
        return Err(ApiError::conflict(EXPIRED));
    }
    let revision = store::current(tx, d.agreement).await?;
    let share = revision.terms["money"]["senderShareBp"].as_i64();
    let held = i64::from(d.referral.unwrap_or(0));
    if revision.author_party == "recipient" || share != Some(held) {
        return Err(ApiError::conflict(CHANGED));
    }
    Ok((row, revision))
}

/// The receiving agent accepts the exact offer, which moves the deal.
pub async fn accept(tx: &mut Transaction<'_, Postgres>, d: &Decide) -> ApiResult<()> {
    acceptance(tx, d, "accepted").await
}

/// The receiving agent accepts an offer that still needs approval (H2 amendment 3): the
/// acceptance is recorded on the revision and the agreement stays `sent`, one version on.
pub async fn accept_awaiting(tx: &mut Transaction<'_, Postgres>, d: &Decide) -> ApiResult<()> {
    acceptance(tx, d, "sent").await
}

/// The receiving agent's one acceptance of the current revision, leaving `state`.
async fn acceptance(tx: &mut Transaction<'_, Postgres>, d: &Decide, state: &str) -> ApiResult<()> {
    let (row, revision) = open(tx, d).await?;
    if d.actor != d.members.1 {
        return Err(ApiError::forbidden());
    }
    unaccepted(tx, &revision).await?;
    ledger::bump(tx, d.agreement, row.version, state, None, None).await?;
    let response = Response {
        agreement: d.agreement,
        revision: revision.id,
        action: "accepted",
        actor: d.actor,
        party: Party::Recipient,
        accepted_digest: Some(revision.digest.as_str()),
    };
    ledger::respond(tx, &response).await
}

/// Refuses a revision the receiver already accepted: the next step is its approval.
async fn unaccepted(tx: &mut Transaction<'_, Postgres>, revision: &RevisionRow) -> ApiResult<()> {
    match store::accepted_by(tx, revision.id).await? {
        Some(_) => Err(ApiError::conflict(CHANGED)),
        None => Ok(()),
    }
}

/// The company Admin approves in place of the receiving agent, with `share` (which may
/// differ from the offer, within the same kind).
pub async fn approve(
    tx: &mut Transaction<'_, Postgres>,
    d: &Decide,
    share: Option<i32>,
) -> ApiResult<()> {
    let (row, offered) = open(tx, d).await?;
    unaccepted(tx, &offered).await?;
    if share.is_some() != d.referral.is_some() {
        return Err(ApiError::conflict(KIND_FIXED));
    }
    let (revision, digest) = if share == d.referral {
        (offered.id, offered.digest.clone())
    } else {
        adjusted(tx, &row, &offered, share.unwrap_or(0), d.actor).await?
    };
    let current = (revision != offered.id).then_some(revision);
    ledger::bump(tx, d.agreement, row.version, "accepted", None, current).await?;
    let evidence = (revision, digest.as_str());
    ledger::approve(
        tx,
        d.agreement,
        evidence,
        d.actor,
        Verification::AdminDecision,
    )
    .await
}
