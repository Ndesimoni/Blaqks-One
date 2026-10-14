//! `GET /finance/deals/{id}/earn-preview?earnedOn=` (§13 M-F2): what earning on that date
//! would record — the agreement, split source and lines — for the confirmation dialog.
//! Approvers only; nothing is written.
use super::{
    compute, earn_rules,
    figures::Figures,
    gate::{self, Need},
    row,
    views::{self, Viewer},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{access, wire},
    state::AppState,
};
use axum::{
    extract::{rejection::QueryRejection, Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreviewQuery {
    earned_on: String,
}

pub async fn preview(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
    query: Result<Query<PreviewQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace, Need::Approve).await?;
    let Query(query) = query.map_err(|_| ApiError::invalid(wire::DATE))?;
    let earned_on = wire::date(&Value::String(query.earned_on))?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let today = access::today(&mut tx).await?;
    earn_rules::ensure_not_future(&earned_on, &today)?;
    let user = &session.user;
    let found = row::visible(&mut tx, &workspace, user, None, Some(id)).await?;
    let deal = found.into_iter().next().ok_or_else(ApiError::missing)?;
    if deal.earned() {
        return Err(ApiError::conflict(earn_rules::ALREADY));
    }
    let basis = compute::current_basis(&mut tx, &workspace, &deal, &earned_on).await?;
    let outcome = compute::compute(&deal, basis)?;
    let warnings = earn_rules::warnings(&mut tx, &workspace, &deal).await?;
    tx.rollback().await?;
    let figures = Figures::preview(&deal, &outcome);
    let agreement = outcome
        .basis
        .agreement
        .map(|(id, share)| json!({"id": id, "agentShareBp": share}));
    let calculation = views::calculation(&figures, &Viewer::of(user));
    Ok(Json(
        json!({"preview": {"earnedOn": earned_on, "agreement": agreement,
        "calculation": calculation, "warnings": warnings}}),
    ))
}
