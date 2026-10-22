//! `POST /finance/deals/{id}/handovers {version, toId, referralShareBp|null}` (§13 H-F1):
//! the holder offers their deal to an active finance colleague, fully or keeping a
//! referral share (capped by the team setting). Nothing moves until the receiver accepts.
//! An offer made in the app is recorded as an agreement (agreements design §14).
use super::{
    assign::SHARES,
    gate::{self, Need, STALE},
    handover_evidence,
    handover_rows::{self, CAP, HAS_SECOND},
    links,
    row::{self, DealRow},
    split::{nullable_bp, REVISE},
    views::Viewer,
};
use crate::{
    auth::{profile::UserRow, session::Session},
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
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

const INVALID: &str = "Provide a version, a receiving agent and a referral share or null.";
pub const HOLDER_ONLY: &str = "Only the deal's holder can hand it over. Ask your Admin to move it.";
pub const PENDING: &str = "This deal already has a pending hand-over.";

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
        if share > handover_rows::cap(tx, workspace).await? {
            return Err(ApiError::conflict(CAP));
        }
    }
    Ok(())
}

pub async fn request(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace, Need::Assign).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["version", "toId", "referralShareBp"], INVALID)?;
    let version = gate::version(&body["version"])?;
    let to = wire::uuid(&body["toId"], INELIGIBLE)?;
    let referral = nullable_bp(&body["referralShareBp"])?.filter(|share| *share > 0);
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Assign).await?;
    let deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    let handover = offer(&mut tx, &workspace, &live, &deal, to, referral, true).await?;
    let row = handover_rows::find(&mut tx, handover).await?;
    tx.commit().await?;
    let view = row.view(&Viewer::of(&live));
    Ok((StatusCode::CREATED, Json(json!({ "handover": view }))))
}

/// Steps 7–10 on the locked deal with the live holder: holder-only, one pending request,
/// an eligible receiver and the move rules, then the pending request. Returns its ID.
/// `evidence` records the offer as an agreement; the sample data command records none.
pub async fn offer(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    deal: &DealRow,
    to: Uuid,
    referral: Option<i32>,
    evidence: bool,
) -> ApiResult<Uuid> {
    if deal.assignee_id != Some(live.id) {
        return Err(ApiError::denied(HOLDER_ONLY));
    }
    if deal.pending_handover.is_some() {
        return Err(ApiError::conflict(PENDING));
    }
    if to == live.id || !links::finance_member(tx, workspace, to, true).await? {
        return Err(ApiError::invalid(INELIGIBLE));
    }
    ensure_move(tx, workspace, deal, to, referral).await?;
    let agreement = match evidence {
        true => Some(handover_evidence::offer(tx, workspace, deal, (live.id, to), referral).await?),
        false => None,
    };
    let handover = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_deal_handovers \
         (id,workspace_id,deal_id,from_id,to_id,referral_share_bp,requested_by,agreement_id) \
         VALUES ($1,$2,$3,$4,$5,$6,$4,$7)",
    )
    .bind(handover)
    .bind(workspace)
    .bind(deal.id)
    .bind(live.id)
    .bind(to)
    .bind(referral)
    .bind(agreement)
    .execute(&mut **tx)
    .await?;
    Ok(handover)
}
