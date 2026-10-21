//! `POST /mailbox/google/start`: records a single-use sign-in request for this member and
//! session and returns Google's authorization URL for the browser to open.
use super::{ensure, live, unconfigured};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    integrations::{
        google::{pkce, requests},
        handlers::key,
        wire,
    },
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub async fn start(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    ensure(&state, &session, Some(&headers), &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    wire::exact(body, &[], wire::INVALID)?;
    let google = state.config.google.as_ref().ok_or_else(unconfigured)?;
    let key = key(&state)?.clone();
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    live(&mut tx, &workspace, session.user.id).await?;
    // Refused before Google consent, so no grant is made only to be dropped (review L1).
    super::super::sendgrid::connect::ensure_one_system(&mut tx, &workspace, "google").await?;
    let owner = requests::Owner {
        workspace: &workspace,
        member: session.user.id,
        session: session.id,
    };
    let started = requests::start(&mut tx, &key, &owner).await?;
    tx.commit().await?;
    Ok(Json(json!({
        "url": pkce::authorize_url(google, &started.state, &started.verifier),
    })))
}
