//! `POST …/marketplace/join` (packet MK1b): the profile, one `true` per stored commitment, the
//! publication consent and the current terms, written in one transaction. A newer or edited
//! terms version answers `terms_outdated`; a draft is refused on a hosted server.
use super::{application, events, gate, profile, profiles, terms};
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

pub const JOINED: &str = "You have already joined the marketplace.";
pub const TICKS: &str = "Tick all four commitments and the publication consent.";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Join {
    pub profile: profile::Input,
    pub commitments: Vec<bool>,
    pub consent: bool,
    pub terms_version: String,
    pub terms_digest: String,
}

pub async fn join(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Join>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let Json(request) = body.map_err(|_| ApiError::invalid(profile::INVALID))?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    let terms = terms::current(&mut tx).await?;
    let terms = terms::current_or_outdated(terms, &request.terms_version, &request.terms_digest)?;
    terms::refuse_draft(&terms, state.config.secure_cookie)?;
    if profiles::load(&mut tx, user.id).await?.is_some() {
        return Err(ApiError::conflict(JOINED));
    }
    let ticked = request.commitments.iter().filter(|tick| **tick).count();
    if !agreed(
        &request.commitments,
        terms.commitments.0.len(),
        request.consent,
        ticked,
    ) {
        return Err(ApiError::invalid(TICKS));
    }
    let valid = profile::validate(request.profile)?;
    profiles::insert(&mut tx, &workspace, user.id, valid).await?;
    terms::accept(&mut tx, &workspace, user.id, &terms).await?;
    terms::consent(&mut tx, &workspace, user.id, &terms).await?;
    events::append(&mut tx, &workspace, user.id, user.id, "joined").await?;
    tx.commit().await?;
    application::reply(&state, &workspace, user.id, StatusCode::CREATED).await
}

/// One `true` per stored commitment, nothing extra, and the publication consent.
pub fn agreed(commitments: &[bool], stored: usize, consent: bool, ticked: usize) -> bool {
    consent && commitments.len() == stored && ticked == stored
}
