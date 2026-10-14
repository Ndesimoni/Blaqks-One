use super::session::{checked_session, persist, session_id};
use crate::{
    error,
    google::SCOPES,
    store::{now, random_id, OAuthState},
    ApiError, App,
};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Redirect,
    Json,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub(super) async fn connect(
    State(app): State<App>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
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
pub(super) struct Callback {
    state: Option<String>,
    code: Option<String>,
    error: Option<String>,
}
pub(super) async fn callback(
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
