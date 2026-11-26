use super::session::{checked_session, persist, public_status};
use crate::{
    error,
    store::{queue_snapshot, Event},
    ApiError, App,
};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeSet;

#[derive(Deserialize)]
pub(super) struct Snapshot {
    events: Vec<Event>,
    revision: i64,
}
pub(super) async fn snapshot(
    State(app): State<App>,
    headers: HeaderMap,
    Json(input): Json<Snapshot>,
) -> Result<Json<Value>, ApiError> {
    if input.events.len() > 2000
        || input.events.iter().any(|e| !e.validate())
        || input
            .events
            .iter()
            .map(|e| &e.key)
            .collect::<BTreeSet<_>>()
            .len()
            != input.events.len()
    {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "Calendar activities contain invalid dates, invitations or duplicate IDs.",
        ));
    }
    let mut store = app.store.lock().await;
    let id = checked_session(&app, &headers, &store)?;
    let mut candidate = store.clone();
    let session = candidate.sessions.get_mut(&id).unwrap();
    if session.tokens.is_none() || session.calendar.is_none() {
        return Err(error(
            StatusCode::CONFLICT,
            "Connect Google and choose a calendar first.",
        ));
    }
    if input.revision <= session.snapshot_revision {
        return Ok(Json(public_status(&app, session)));
    }
    session.snapshot_revision = input.revision;
    session.ready = true;
    queue_snapshot(session, input.events);
    persist(&app, &mut store, candidate)?;
    Ok(Json(public_status(&app, &store.sessions[&id])))
}
pub(super) async fn retry(
    State(app): State<App>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let mut store = app.store.lock().await;
    let id = checked_session(&app, &headers, &store)?;
    let mut candidate = store.clone();
    for job in candidate.sessions.get_mut(&id).unwrap().jobs.values_mut() {
        job.retry_at = 0;
        job.attempts = 0;
        job.error = None;
    }
    persist(&app, &mut store, candidate)?;
    Ok(Json(public_status(&app, &store.sessions[&id])))
}
pub(super) async fn disconnect(
    State(app): State<App>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    // Serialize with the worker: once this returns, no pending job can use the old token.
    let _gate = app.sync_gate.lock().await;
    let id = checked_session(&app, &headers, &*app.store.lock().await)?;
    let old_tokens = app.store.lock().await.sessions[&id].tokens.clone();
    if let Some(tokens) = old_tokens {
        app.google
            .revoke(&tokens)
            .await
            .map_err(|f| error(StatusCode::BAD_GATEWAY, &f.message))?;
    }
    let mut store = app.store.lock().await;
    let mut candidate = store.clone();
    let session = candidate.sessions.get_mut(&id).unwrap();
    session.tokens = None;
    session.calendar = None;
    session.oauth = None;
    session.connection_error = None;
    session.ready = false;
    persist(&app, &mut store, candidate)?;
    Ok(Json(public_status(&app, &store.sessions[&id])))
}
