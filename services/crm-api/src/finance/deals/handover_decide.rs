//! Deciding hand-over requests (§13 H-F1, agreements design §17; routes in
//! `handover_routes.rs`). Accepting or approving moves the deal to the receiver, except
//! that an acceptance needing approval waits for the chosen approver or an Admin. A
//! request recorded as an agreement moves its agreement in the same transaction, after
//! the deal lock.
use super::{
    gate::{self, Need},
    handover::ensure_move,
    handover_checks::{self as checks, Receiver},
    handover_evidence, handover_follow,
    handover_rows::{self, HandoverRow, NOT_PENDING},
    handover_store::{self, Decision},
    holder::{self, Move},
    list,
    row::{self, DealRow},
    views::Viewer,
};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::Json;
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};

pub const RECEIVER_GONE: &str = "The receiving agent can no longer hold this deal.";
const ACCEPTED: &str = "Hand-over accepted by the receiving agent.";
const APPROVED: &str = "Hand-over accepted by the receiving agent and approved.";

type Tx<'c> = Transaction<'c, Postgres>;

/// Steps 4–10 once the caller-only checks passed. `approval` is the Admin's referral
/// share and reason; `version` the agreement version the decider saw.
pub async fn decide(
    state: AppState,
    session: Session,
    (workspace, id): (String, String),
    (decision, version): (Decision, Option<i64>),
    approval: Option<(Option<i32>, String)>,
) -> ApiResult<Json<Value>> {
    let need = match decision {
        Decision::Approve => Need::Manage,
        _ => Need::Module,
    };
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, need).await?;
    let request = handover_store::fetch(&mut tx, &workspace, &live, id, decision).await?;
    let (mut entry, mut records) = (Value::Null, Value::Null);
    if decision == Decision::Accept && request.requires_approval {
        movable(&mut tx, (&workspace, live.id), &request, None).await?;
        handover_evidence::decide(&mut tx, &request, (decision, &live), version, None).await?;
        handover_store::set_awaiting(&mut tx, id, live.id).await?;
    } else if decision.moves() {
        let decided = (decision, &live);
        (entry, records) = moved(&mut tx, &workspace, &request, decided, version, approval).await?;
    } else {
        handover_evidence::decide(&mut tx, &request, (decision, &live), None, None).await?;
        let referral = request.referral_share_bp;
        handover_store::set_status(&mut tx, id, decision, referral, live.id).await?;
    }
    let view = handover_rows::shown(&mut tx, id, &Viewer::of(&live)).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"handover": view, "entry": entry, "records": records}),
    ))
}

/// The locked deal, still held by the sender, with a receiver who can still hold it and
/// the move rules for `referral` (the request's own share when `None`).
async fn movable(
    tx: &mut Tx<'_>,
    (workspace, actor): (&str, uuid::Uuid),
    request: &HandoverRow,
    referral: Option<Option<i32>>,
) -> ApiResult<DealRow> {
    let deal = row::locked_for_handover(tx, workspace, actor, request.deal_id).await?;
    if deal.assignee_id != Some(request.from_id) {
        return Err(ApiError::conflict(NOT_PENDING));
    }
    let receiver = checks::receiver(tx, workspace, request.to_id).await?;
    let expected = if request.to_admin {
        Receiver::Admin
    } else {
        Receiver::Staff
    };
    if receiver != Some(expected) {
        return Err(ApiError::conflict(RECEIVER_GONE));
    }
    let referral = referral.unwrap_or(request.referral_share_bp);
    ensure_move(tx, workspace, &deal, request.to_id, referral).await?;
    Ok(deal)
}

/// Accepting, approving in place or approving an acceptance: the deal moves, and its
/// client and property with it.
async fn moved(
    tx: &mut Tx<'_>,
    workspace: &str,
    request: &HandoverRow,
    (decision, live): (Decision, &UserRow),
    version: Option<i64>,
    approval: Option<(Option<i32>, String)>,
) -> ApiResult<(Value, Value)> {
    let referral = match &approval {
        Some((share, _)) => *share,
        None => request.referral_share_bp,
    };
    let deal = movable(tx, (workspace, live.id), request, Some(referral)).await?;
    let chosen = decision == Decision::ApproveAcceptance && live.role != "admin";
    if chosen && deal.second_agent_id == Some(live.id) {
        return Err(ApiError::conflict(checks::APPROVER_ROLE));
    }
    handover_evidence::decide(tx, request, (decision, live), version, referral).await?;
    handover_store::set_status(tx, request.id, decision, referral, live.id).await?;
    let reason = match (&approval, decision) {
        (Some((_, reason)), _) => reason.as_str(),
        (None, Decision::ApproveAcceptance) => APPROVED,
        (None, _) => ACCEPTED,
    };
    let change = Move {
        workspace,
        deal: &deal,
        to: Some(request.to_id),
        actor: live.id,
        history: "handover",
        reason,
        referral,
        requested_by: Some(request.requested_by),
    };
    holder::apply(tx, change).await?;
    // The client and the property go with the deal (agreements design §18).
    let records =
        handover_follow::follow(tx, workspace, (request, &deal), live.id, referral).await?;
    let entry = json!(list::entry(tx, workspace, live, request.deal_id).await?);
    Ok((entry, records))
}
