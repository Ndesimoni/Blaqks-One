//! What happens to a new sample deal, through the deal owners' writes: `earn::apply`, the
//! Admin's `holder::apply`, and the holder's `handover::offer` with the Admin's approval
//! (the decision `handover_decide` makes, so every event names the Admin).
use super::{
    super::{dates::Calendar, failed, Outcome},
    people::People,
    present,
    specs::Step,
};
use crate::{
    auth::profile::UserRow,
    finance::deals::{
        earn,
        gate::{self, Need},
        handover::{self, ensure_move},
        handover_store::{self, Decision},
        holder::{self, Move},
        row::{self, DealRow},
    },
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

const APPROVED: &str = "Sample: hand-over approved with a referral share.";
const ADMIN_HELD: &str = "Sample: the Admin handles this sale.";

/// One step on the deal, re-locked so it sees the previous step's changes.
pub async fn apply(
    tx: &mut Tx<'_>,
    admin: &UserRow,
    people: &People,
    id: Uuid,
    step: Step,
    (calendar, today): (&Calendar, &str),
) -> Outcome<()> {
    let workspace = admin.workspace_id.as_str();
    let deal = row::locked(tx, workspace, admin, id)
        .await
        .map_err(failed)?;
    let mut change = Move {
        workspace,
        deal: &deal,
        to: Some(admin.id),
        actor: admin.id,
        history: "reassigned",
        reason: ADMIN_HELD,
        referral: None,
        requested_by: None,
    };
    match step {
        Step::Earn(offset) => {
            let earned_on = calendar.day(offset);
            earn::apply(tx, workspace, admin, &deal, &earned_on, today)
                .await
                .map_err(failed)?;
            return Ok(());
        }
        Step::HoldByAdmin => {}
        Step::Offer {
            to,
            referral,
            approved,
        } => {
            let to = people.finance(to).unwrap_or(admin.id);
            let Some(requester) = offer(tx, admin, &deal, to, (referral, approved)).await? else {
                return Ok(());
            };
            (change.to, change.history, change.reason) = (Some(to), "handover", APPROVED);
            (change.referral, change.requested_by) = (referral, Some(requester));
        }
    }
    holder::apply(tx, change).await.map_err(failed)
}

/// The holder's pending request; when `approved`, the Admin's approval of it. Returns
/// the requester once approved (the move itself is the caller's `holder::apply`).
async fn offer(
    tx: &mut Tx<'_>,
    admin: &UserRow,
    deal: &DealRow,
    to: Uuid,
    (referral, approved): (Option<i32>, bool),
) -> Outcome<Option<Uuid>> {
    let workspace = admin.workspace_id.as_str();
    let holder = deal.assignee_id.unwrap_or(admin.id);
    let live = gate::relock(tx, workspace, holder, Need::Assign).await;
    let live = live.map_err(failed)?;
    let request = handover::offer(tx, workspace, &live, deal, to, referral).await;
    let request = request.map_err(failed)?;
    present::mark(tx, "handover", request, workspace).await?;
    if !approved {
        return Ok(None);
    }
    let decision = Decision::Approve;
    let found = handover_store::fetch(tx, workspace, admin, request, decision).await;
    let found = found.map_err(failed)?;
    ensure_move(tx, workspace, deal, to, referral)
        .await
        .map_err(failed)?;
    handover_store::set_status(tx, request, decision, referral, admin.id)
        .await
        .map_err(failed)?;
    Ok(Some(found.requested_by))
}
