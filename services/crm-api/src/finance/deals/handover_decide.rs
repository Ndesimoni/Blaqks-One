//! Deciding hand-over requests (§13 H-F1): `POST /finance/handovers/{id}/accept`,
//! `/decline`, `/cancel` (no body) and `/approve {referralShareBp|null, reason}` (Admin,
//! may adjust the referral). Accepting or approving moves the deal to the receiver.
use super::{
    gate::{self, Need},
    handover::ensure_move,
    handover_rows::{self, NOT_PENDING},
    handover_store::{self, Decision},
    holder::{self, Move},
    links, list, row,
    split::nullable_bp,
    views::Viewer,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::wire,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub const RECEIVER_GONE: &str = "The receiving agent can no longer hold this deal.";
const INVALID: &str = "Provide a referral share or null, and a reason.";
const ACCEPTED: &str = "Hand-over accepted by the receiving agent.";

/// Steps 4–10 once the caller-only checks passed. `approval` is the Admin's referral
/// share and reason.
async fn decide(
    state: AppState,
    session: Session,
    (workspace, id): (String, String),
    decision: Decision,
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
        handover_store::set_status(&mut tx, id, decision, referral, live.id).await?;
    }
    let view = handover_rows::find(&mut tx, id)
        .await?
        .view(&Viewer::of(&live));
    tx.commit().await?;
    Ok(Json(json!({"handover": view, "entry": entry})))
}

async fn simple(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    decision: Decision,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &path.0, Need::Module).await?;
    decide(state, session, path, decision, None).await
}

pub async fn accept(
    state: State<AppState>,
    session: Session,
    headers: HeaderMap,
    path: Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    simple(state, session, headers, path, Decision::Accept).await
}

pub async fn decline(
    state: State<AppState>,
    session: Session,
    headers: HeaderMap,
    path: Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    simple(state, session, headers, path, Decision::Decline).await
}

pub async fn cancel(
    state: State<AppState>,
    session: Session,
    headers: HeaderMap,
    path: Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    simple(state, session, headers, path, Decision::Cancel).await
}

pub async fn approve(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &path.0, Need::Manage).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["referralShareBp", "reason"], INVALID)?;
    let referral = nullable_bp(&body["referralShareBp"])?.filter(|share| *share > 0);
    let reason = gate::reason(&body["reason"])?;
    decide(
        state,
        session,
        path,
        Decision::Approve,
        Some((referral, reason)),
    )
    .await
}
