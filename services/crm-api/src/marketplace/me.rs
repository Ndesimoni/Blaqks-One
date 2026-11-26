//! `PATCH …/marketplace/me` (packet MK1b): the member edits their own profile with the version
//! they last saw. A newer terms version blocks edits until it is accepted.
use super::{application, events, gate, profile, profiles};
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

pub const STALE: &str = "Your profile changed elsewhere. Reload and try again.";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Edit {
    pub expected_version: i64,
    pub profile: profile::Input,
}

pub async fn edit(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Edit>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let Json(request) = body.map_err(|_| ApiError::invalid(profile::INVALID))?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let valid = profile::validate(request.profile)?;
    let saved = profiles::update(&mut tx, user.id, request.expected_version, valid).await?;
    if saved.is_none() {
        return Err(ApiError::stale(STALE));
    }
    events::append(&mut tx, &workspace, user.id, user.id, "profile_updated").await?;
    tx.commit().await?;
    application::reply(&state, &workspace, user.id, axum::http::StatusCode::OK).await
}
