use crate::{
    error,
    google::SCOPES,
    store::{now, queue_snapshot, random_id, Event, OAuthState, Session, Store, Tokens},
    ApiError, App,
};
use axum::{
    extract::{DefaultBodyLimit, Query, State},
    http::{header, HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post, put},
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

pub fn router(app: App) -> Router {
    Router::new()
        .route("/api/calendar/status", get(status))
        .route("/api/calendar/connect", post(connect))
        .route("/api/calendar/oauth/callback", get(callback))
        .route("/api/calendar/calendars", get(calendars))
        .route("/api/calendar/selection", put(selection))
        .route("/api/calendar/snapshot", put(snapshot))
        .route("/api/calendar/retry", post(retry))
        .route("/api/calendar/disconnect", post(disconnect))
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024))
        .layer(middleware::from_fn(headers))
        .with_state(app)
}
async fn headers(request: axum::extract::Request, next: Next) -> Response {
    let host = request
        .headers()
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    if !url::Url::parse(&format!("http://{host}"))
        .ok()
        .is_some_and(|u| matches!(u.host_str(), Some("localhost" | "127.0.0.1")))
    {
        return error(
            StatusCode::FORBIDDEN,
            "This calendar service accepts local CRM requests only.",
        )
        .into_response();
    }
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    response
        .headers_mut()
        .insert(header::REFERRER_POLICY, "no-referrer".parse().unwrap());
    response
}
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
fn session_id(headers: &HeaderMap) -> Result<String, ApiError> {
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
fn checked_session(app: &App, headers: &HeaderMap, store: &Store) -> Result<String, ApiError> {
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
fn public_status(app: &App, session: &Session) -> Value {
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
async fn status(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
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
async fn connect(State(app): State<App>, headers: HeaderMap) -> Result<Json<Value>, ApiError> {
    if !app.configured() {
        return Err(error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Google Calendar has not been configured for this workspace.",
        ));
    }
    let mut store = app.store.lock().await;
    let id = checked_session(&app, &headers, &store)?;
    if store.sessions[&id].tokens.is_some() {
        return Err(error(
            StatusCode::CONFLICT,
            "Disconnect your current Google account before connecting another.",
        ));
    }
    let mut candidate = store.clone();
    let oauth = OAuthState {
        state: random_id(),
        verifier: random_id(),
        expires: now() + 600,
    };
    let mut url = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("client_id", app.client_id.as_str()),
        (
            "redirect_uri",
            &format!("{}/api/calendar/oauth/callback", app.origin),
        ),
        ("response_type", "code"),
        ("scope", SCOPES),
        ("access_type", "offline"),
        ("prompt", "consent"),
        ("state", &oauth.state),
        (
            "code_challenge",
            &URL_SAFE_NO_PAD.encode(Sha256::digest(oauth.verifier.as_bytes())),
        ),
        ("code_challenge_method", "S256"),
    ]);
    candidate.sessions.get_mut(&id).unwrap().oauth = Some(oauth);
    persist(&app, &mut store, candidate)?;
    Ok(Json(json!({"url": url.as_str()})))
}
#[derive(Deserialize)]
struct Callback {
    state: Option<String>,
    code: Option<String>,
    error: Option<String>,
}
async fn callback(
    State(app): State<App>,
    headers: HeaderMap,
    Query(query): Query<Callback>,
) -> Result<Redirect, ApiError> {
    let id = session_id(&headers)?;
    let verifier = {
        let mut store = app.store.lock().await;
        let oauth = store
            .sessions
            .get(&id)
            .and_then(|s| s.oauth.as_ref())
            .ok_or_else(|| {
                error(
                    StatusCode::BAD_REQUEST,
                    "Calendar authorization has expired. Connect again.",
                )
            })?;
        if query.state.as_deref() != Some(oauth.state.as_str()) || oauth.expires < now() {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "Calendar authorization could not be verified. Connect again.",
            ));
        }
        let verifier = oauth.verifier.clone();
        let mut candidate = store.clone();
        candidate.sessions.get_mut(&id).unwrap().oauth = None;
        persist(&app, &mut store, candidate)?;
        verifier
    };
    let result = if query.error.is_some() || query.code.is_none() {
        None
    } else {
        Some(
            app.google
                .exchange(
                    &app.client_id,
                    &app.client_secret,
                    query.code.as_deref().unwrap(),
                    &verifier,
                    &format!("{}/api/calendar/oauth/callback", app.origin),
                )
                .await,
        )
    };
    let mut store = app.store.lock().await;
    let mut candidate = store.clone();
    let session = candidate.sessions.get_mut(&id).unwrap();
    match result {
        Some(Ok(tokens)) => {
            session.tokens = Some(tokens);
            session.calendar = None;
            session.connection_error = None;
        }
        _ => {
            session.connection_error = Some("Google connection was not completed. Please connect again and grant calendar access.".into());
        }
    }
    persist(&app, &mut store, candidate)?;
    Ok(Redirect::to(&format!("{}/#/calendar", app.origin)))
}
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
async fn calendars(State(app): State<App>, headers: HeaderMap) -> Result<Json<Value>, ApiError> {
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
struct Selection {
    id: String,
}
async fn selection(
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
#[derive(Deserialize)]
struct Snapshot {
    events: Vec<Event>,
    revision: i64,
}
async fn snapshot(
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
async fn retry(State(app): State<App>, headers: HeaderMap) -> Result<Json<Value>, ApiError> {
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
async fn disconnect(State(app): State<App>, headers: HeaderMap) -> Result<Json<Value>, ApiError> {
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
