//! `POST /finance/deals/{id}/handovers {version, toId, referralShareBp|null, approverId?}`
//! (§13 H-F1, agreements design §17): the holder offers their deal to an active finance
//! colleague, fully or keeping a referral share (capped by the team setting), or fully to
//! the company's Admin; optionally the move then waits for a chosen approver. Nothing moves
//! until the receiver accepts. An offer made in the app is recorded as an agreement (§14).
use super::{
    gate::{self, Need, STALE},
    handover_checks as checks, handover_rows, row,
    split::nullable_bp,
    views::Viewer,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{errors::INELIGIBLE, wire},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

pub use super::handover_offer::{ensure_move, offer, Terms};

const INVALID: &str =
    "Provide a version, a receiving agent, a referral share or null, and optionally an approver.";
pub const HOLDER_ONLY: &str = "Only the deal's holder can hand it over. Ask your Admin to move it.";
pub const PENDING: &str = "This deal already has a pending hand-over.";

pub async fn request(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace, Need::Assign).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let keys: &[&str] = match body.get("approverId") {
        Some(_) => &["version", "toId", "referralShareBp", "approverId"],
        None => &["version", "toId", "referralShareBp"],
    };
    let body = wire::exact(body, keys, INVALID)?;
    let version = gate::version(&body["version"])?;
    let to = wire::uuid(&body["toId"], INELIGIBLE)?;
    let referral = nullable_bp(&body["referralShareBp"])?.filter(|share| *share > 0);
    let approver = match body.get("approverId") {
        None | Some(Value::Null) => None,
        Some(value) => Some(wire::uuid(value, checks::APPROVER)?),
    };
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Assign).await?;
    let deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    let terms = Terms {
        to,
        referral,
        approver,
    };
    let handover = offer(&mut tx, &workspace, &live, &deal, terms, true).await?;
    let view = handover_rows::shown(&mut tx, handover, &Viewer::of(&live)).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "handover": view }))))
}
