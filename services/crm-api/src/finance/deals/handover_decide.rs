//! Deciding hand-over requests (§13 H-F1; routes in `handover_routes.rs`). Accepting or
//! approving moves the deal to the receiver. A request recorded as an agreement moves its
//! agreement in the same transaction (agreements design §14), after the deal lock.
use super::{
    gate::{self, Need},
    handover::ensure_move,
    handover_evidence,
    handover_rows::{self, NOT_PENDING},
    handover_store::{self, Decision},
    holder::{self, Move},
    links, list, row,
    views::Viewer,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::Json;
use serde_json::{json, Value};

pub const RECEIVER_GONE: &str = "The receiving agent can no longer hold this deal.";
const ACCEPTED: &str = "Hand-over accepted by the receiving agent.";

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
    let mut referral = request.referral_share_bp;
    let mut entry = Value::Null;
    if decision.moves() {
        if let Some((share, _)) = &approval {
            referral = *share;
        }
        let deal_id = request.deal_id;
        let deal = row::locked_for_handover(&mut tx, &workspace, live.id, deal_id).await?;
        if deal.assignee_id != Some(request.from_id) {
            return Err(ApiError::conflict(NOT_PENDING));
        }
        if !links::finance_member(&mut tx, &workspace, request.to_id, true).await? {
            return Err(ApiError::conflict(RECEIVER_GONE));
        }
        ensure_move(&mut tx, &workspace, &deal, request.to_id, referral).await?;
        let decided = (decision, &live);
        handover_evidence::decide(&mut tx, &request, decided, version, referral).await?;
        handover_store::set_status(&mut tx, id, decision, referral, live.id).await?;
        let reason = approval
            .as_ref()
            .map_or(ACCEPTED, |(_, reason)| reason.as_str());
        let change = Move {
            workspace: &workspace,
            deal: &deal,
            to: Some(request.to_id),
            actor: live.id,
            history: "handover",
            reason,
            referral,
            requested_by: Some(request.requested_by),
        };
        holder::apply(&mut tx, change).await?;
        entry = json!(list::entry(&mut tx, &workspace, &live, deal_id).await?);
    } else {
        handover_evidence::decide(&mut tx, &request, (decision, &live), None, None).await?;
        handover_store::set_status(&mut tx, id, decision, referral, live.id).await?;
    }
    let view = handover_rows::find(&mut tx, id)
        .await?
        .view(&Viewer::of(&live));
    tx.commit().await?;
    Ok(Json(json!({"handover": view, "entry": entry})))
}
