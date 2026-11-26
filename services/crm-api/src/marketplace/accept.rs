//! `POST …/marketplace/terms/accept` (packet MK1b): a member who joined accepts a newer terms
//! version before they can post or edit again. The version and digest must be the current row,
//! with one tick per stored commitment and the consent again (MK1 code review M4); the consent
//! is recorded each time.
use super::{application, events, gate, join, profiles, terms};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State as AxumState},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Accept {
    pub terms_version: String,
    pub terms_digest: String,
    pub commitments: Vec<bool>,
    pub consent: bool,
}

pub async fn accept(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Accept>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let Json(request) = body.map_err(|_| ApiError::invalid(terms::OUTDATED))?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    let current = terms::current(&mut tx).await?;
    let current =
        terms::current_or_outdated(current, &request.terms_version, &request.terms_digest)?;
    terms::refuse_draft(&current, state.config.secure_cookie)?;
    if profiles::load(&mut tx, user.id).await?.is_none() {
        return Err(ApiError::conflict(gate::JOIN_FIRST));
    }
    let stored = current.commitments.0.len();
    let ticked = request.commitments.iter().filter(|tick| **tick).count();
    if !join::agreed(&request.commitments, stored, request.consent, ticked) {
        return Err(ApiError::invalid(join::TICKS));
    }
    if terms::accepted(&mut tx, user.id, &current.version).await? {
        return Err(ApiError::conflict(terms::ALREADY));
    }
    terms::accept(&mut tx, &workspace, user.id, &current).await?;
    terms::consent(&mut tx, &workspace, user.id, &current).await?;
    events::append(&mut tx, &workspace, user.id, user.id, "terms_accepted").await?;
    tx.commit().await?;
    application::reply(&state, &workspace, user.id, StatusCode::OK).await
}
