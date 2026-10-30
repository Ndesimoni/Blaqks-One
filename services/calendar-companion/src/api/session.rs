use crate::{
    error,
    store::{random_id, Session, Store},
    ApiError, App,
};
use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

pub fn persist(app: &App, store: &mut Store, candidate: Store) -> Result<(), ApiError> {
    app.vault.save(&candidate).map_err(|_| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Calendar changes could not be saved. Please retry.",
        )
    })?;
    *store = candidate;
    Ok(())
}
pub(super) fn session_id(headers: &HeaderMap) -> Result<String, ApiError> {
    headers
        .get(header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookie| {
            cookie
                .split(';')
                .find_map(|part| part.trim().strip_prefix("kws_calendar=").map(String::from))
        })
        .filter(|id| id.len() == 64 && id.bytes().all(|b| b.is_ascii_hexdigit()))
        .ok_or_else(|| {
            error(
                StatusCode::UNAUTHORIZED,
                "Refresh the calendar connection and try again.",
            )
        })
}
pub(super) fn checked_session(
    app: &App,
    headers: &HeaderMap,
    store: &Store,
) -> Result<String, ApiError> {
    let id = session_id(headers)?;
    let session = store.sessions.get(&id).ok_or_else(|| {
        error(
            StatusCode::UNAUTHORIZED,
            "Refresh the calendar connection and try again.",
        )
    })?;
    if headers.get(header::ORIGIN).and_then(|h| h.to_str().ok()) != Some(app.origin.as_str())
        || headers.get("x-calendar-csrf").and_then(|h| h.to_str().ok())
            != Some(session.csrf.as_str())
    {
        return Err(error(
            StatusCode::FORBIDDEN,
            "The calendar request could not be verified.",
        ));
    }
    Ok(id)
}
pub(super) fn public_status(app: &App, session: &Session) -> Value {
    let items: serde_json::Map<_, _> = session
        .jobs
        .values()
        .filter(|j| {
            session
                .calendar
                .as_ref()
                .is_some_and(|c| c.id == j.calendar_id)
        })
        .map(|j| {
            (
                j.key.clone(),
                json!({"state": j.status(), "url": j.url, "error": j.error}),
            )
        })
        .collect();
    json!({"configured": app.configured(), "connected": session.tokens.is_some(), "calendar": session.calendar,
        "csrf": session.csrf, "items": items, "connectionError": session.connection_error, "revision": session.snapshot_revision})
}
pub(super) async fn status(
    State(app): State<App>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let mut store = app.store.lock().await;
    let id = session_id(&headers)
        .ok()
        .filter(|id| store.sessions.contains_key(id));
    let (id, new) = match id {
        Some(id) => (id, false),
        None => (random_id(), true),
    };
    if new {
        if store.sessions.len() >= 100 {
            return Err(error(
                StatusCode::SERVICE_UNAVAILABLE,
                "Calendar connection limit reached.",
            ));
        }
        let mut candidate = store.clone();
        candidate.sessions.insert(
            id.clone(),
            Session {
                csrf: random_id(),
                ..Default::default()
            },
        );
        persist(&app, &mut store, candidate)?;
    }
    let mut response = Json(public_status(&app, &store.sessions[&id])).into_response();
    if new {
        let secure = if app.origin.starts_with("https:") {
            "; Secure"
        } else {
            ""
        };
        response.headers_mut().insert(header::SET_COOKIE, format!("kws_calendar={id}; Path=/api/calendar; HttpOnly; SameSite=Lax; Max-Age=31536000{secure}").parse().unwrap());
    }
    Ok(response)
}
