use super::session::{checked_session, persist, public_status, session_id};
use crate::{error, store::Tokens, ApiError, App};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

async fn tokens(app: &App, id: &str) -> Result<Tokens, ApiError> {
    let mut tokens = app
        .store
        .lock()
        .await
        .sessions
        .get(id)
        .and_then(|s| s.tokens.clone())
        .ok_or_else(|| {
            error(
                StatusCode::UNAUTHORIZED,
                "Connect your Google account first.",
            )
        })?;
    if let Err(failure) = app
        .google
        .refresh(&mut tokens, &app.client_id, &app.client_secret)
        .await
    {
        if failure.reconnect {
            let mut store = app.store.lock().await;
            let mut candidate = store.clone();
            let session = candidate.sessions.get_mut(id).unwrap();
            session.tokens = None;
            session.connection_error = Some(failure.message.clone());
            persist(app, &mut store, candidate)?;
        }
        return Err(error(StatusCode::BAD_GATEWAY, &failure.message));
    }
    let mut store = app.store.lock().await;
    let mut candidate = store.clone();
    let session = candidate.sessions.get_mut(id).unwrap();
    if session
        .tokens
        .as_ref()
        .is_some_and(|t| t.refresh == tokens.refresh)
    {
        session.tokens = Some(tokens.clone());
    }
    persist(app, &mut store, candidate)?;
    Ok(tokens)
}
pub(super) async fn calendars(
    State(app): State<App>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let id = session_id(&headers)?;
    let credentials = tokens(&app, &id).await?;
    let calendars = app
        .google
        .calendars(&credentials)
        .await
        .map_err(|f| error(StatusCode::BAD_GATEWAY, &f.message))?;
    Ok(Json(json!({"calendars": calendars})))
}
#[derive(Deserialize)]
pub(super) struct Selection {
    id: String,
}
pub(super) async fn selection(
    State(app): State<App>,
    headers: HeaderMap,
    Json(input): Json<Selection>,
) -> Result<Json<Value>, ApiError> {
    let id = checked_session(&app, &headers, &*app.store.lock().await)?;
    let credentials = tokens(&app, &id).await?;
    let available = app
        .google
        .calendars(&credentials)
        .await
        .map_err(|f| error(StatusCode::BAD_GATEWAY, &f.message))?;
    let selected = available
        .into_iter()
        .find(|c| c.id == input.id)
        .ok_or_else(|| {
            error(
                StatusCode::BAD_REQUEST,
                "Choose a calendar that you can edit.",
            )
        })?;
    let mut store = app.store.lock().await;
    checked_session(&app, &headers, &store)?;
    let mut candidate = store.clone();
    let session = candidate.sessions.get_mut(&id).unwrap();
    if session.tokens.is_none() {
        return Err(error(
            StatusCode::UNAUTHORIZED,
            "Connect your Google account first.",
        ));
    }
    session.calendar = Some(selected);
    session.ready = false;
    for job in session.jobs.values_mut().filter(|job| {
        session
            .calendar
            .as_ref()
            .is_some_and(|calendar| calendar.id == job.calendar_id)
    }) {
        job.error = None;
        job.attempts = 0;
        job.retry_at = 0;
    }
    persist(&app, &mut store, candidate)?;
    Ok(Json(public_status(&app, &store.sessions[&id])))
}
