//! In-company deal hand-overs as agreements (design §14 A3a). Only the finance module
//! calls these, inside the transaction that changes the hand-over and after it took the
//! workspace lock, so the hand-over and its agreement always change together. The
//! agreement routes refuse these agreements (`origin` `deal_handover`).
pub use super::handover_read::{deadlines, offer_terms, OfferTerms};
use super::{
    evidence::Parties,
    handover_terms::{self, HandoverFacts},
    ledger::{self, Response},
    limits,
    model::{Party, State},
    rows::AgreementRow,
    store, write,
};
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

pub const EXPIRED: &str = "This hand-over offer has expired. Cancel it and offer the deal again.";
pub const CHANGED: &str = "This hand-over changed. Reload before deciding.";

/// A holder's offer of their deal to a colleague in the same company.
pub struct Offer<'a> {
    pub workspace: &'a str,
    pub from: Uuid,
    pub to: Uuid,
    pub facts: HandoverFacts,
}

/// Records the offer as a sent agreement and returns its ID.
pub async fn offer(tx: &mut Transaction<'_, Postgres>, offer: Offer<'_>) -> ApiResult<Uuid> {
    let cap = limits::referral_cap(tx, offer.workspace).await?;
    let now = OffsetDateTime::now_utc();
    let (kind, built) = handover_terms::build(&offer.facts, cap, now)?;
    let parties = Parties {
        sender_workspace: offer.workspace.to_owned(),
        sender_member: offer.from,
        recipient_workspace: offer.workspace.to_owned(),
        recipient_member: offer.to,
    };
    let kind = (kind.as_str(), "deal_handover");
    let id = write::insert_draft(tx, &parties, kind, offer.from, &built).await?;
    let revision = store::current(tx, id).await?;
    ledger::bump(tx, id, 1, "sent", Some(built.expires_at), None).await?;
    ledger::event(tx, id, Some(revision.id), "sent", offer.from, Party::Sender).await?;
    Ok(id)
}

/// The locked hand-over agreement between `from` and `to`; anything else is a conflict,
/// because finance only links its own requests.
pub async fn locked(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
    (from, to): (Uuid, Uuid),
) -> ApiResult<AgreementRow> {
    let row = store::load_locked(tx, agreement).await?;
    row.filter(|row| {
        row.handover()
            && row.workspace_id == row.recipient_workspace_id
            && (row.sender_member_id, row.recipient_member_id) == (from, to)
    })
    .ok_or(ApiError::conflict(CHANGED))
}

/// Whether the offer's time has run out, measured when this statement runs (not when the
/// transaction began), so a request that waited on a lock cannot answer it late.
pub async fn expired(tx: &mut Transaction<'_, Postgres>, agreement: Uuid) -> ApiResult<bool> {
    let expired: Option<bool> = sqlx::query_scalar(
        "SELECT expires_at <= clock_timestamp() FROM agreements.crm_agreements WHERE id=$1",
    )
    .bind(agreement)
    .fetch_one(&mut **tx)
    .await?;
    Ok(expired.unwrap_or(false))
}

/// The receiving agent declines an open offer. An expired offer can only be cancelled, and
/// an acceptance waiting for approval cannot be taken back (H2 amendment 14).
pub async fn decline(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
    members: (Uuid, Uuid),
) -> ApiResult<()> {
    let row = locked(tx, agreement, members).await?;
    if row.state() != State::Sent {
        return Err(ApiError::conflict(CHANGED));
    }
    if expired(tx, agreement).await? {
        return Err(ApiError::conflict(EXPIRED));
    }
    let revision = store::current(tx, agreement).await?;
    if store::accepted_by(tx, revision.id).await?.is_some() {
        return Err(ApiError::conflict(CHANGED));
    }
    ledger::bump(tx, agreement, row.version, "declined", None, None).await?;
    let response = Response {
        agreement,
        revision: revision.id,
        action: "declined",
        actor: members.1,
        party: Party::Recipient,
        accepted_digest: None,
    };
    ledger::respond(tx, &response).await
}

/// Withdraws an open offer: the holder cancelling (`Some(Sender)`), or an Admin, a deal
/// move, a member leaving or a deal deletion (`None`). Expired offers can be withdrawn.
pub async fn withdraw(
    tx: &mut Transaction<'_, Postgres>,
    agreement: Uuid,
    actor: Uuid,
    party: Option<Party>,
) -> ApiResult<()> {
    let row = store::load_locked(tx, agreement).await?;
    let row = row
        .filter(AgreementRow::handover)
        .ok_or(ApiError::conflict(CHANGED))?;
    if row.state() != State::Sent {
        return Ok(());
    }
    let revision = store::current(tx, agreement).await?;
    ledger::bump(tx, agreement, row.version, "revoked", None, None).await?;
    ledger::event_by(tx, agreement, Some(revision.id), "revoked", actor, party).await
}

/// Withdraws each linked agreement of hand-overs a bulk update just closed.
pub async fn withdraw_all(
    tx: &mut Transaction<'_, Postgres>,
    agreements: &[Uuid],
    actor: Uuid,
) -> ApiResult<()> {
    for agreement in agreements {
        withdraw(tx, *agreement, actor, None).await?;
    }
    Ok(())
}
