//! `GET /api/crm/integrations/google/callback`, the one redirect URI registered with
//! Google. The session cookie is `SameSite=Strict`, so it is absent on this cross-site
//! redirect and this handler proves nothing itself: it hands `state` and `code` to the
//! app in the URL fragment, which browsers never send to a server, and the app posts them
//! to `/mailbox/google/finish` with its session and CSRF token.
use super::grant::token_shaped;
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use std::collections::HashMap;
use url::form_urlencoded;

pub async fn callback(
    State(state): State<AppState>,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    let mut fragment = form_urlencoded::Serializer::new(String::new());
    let returned = |name: &str, max: usize| {
        query
            .get(name)
            .filter(|value| token_shaped(value, max))
            .cloned()
    };
    match (returned("state", 128), returned("code", 1024)) {
        (Some(returned_state), Some(code)) if !query.contains_key("error") => {
            fragment
                .append_pair("state", &returned_state)
                .append_pair("code", &code);
        }
        _ => {
            // Google's own error text is never echoed; the app shows a fixed message.
            let denied = query.get("error").map(String::as_str) == Some("access_denied");
            fragment.append_pair("error", if denied { "denied" } else { "failed" });
        }
    }
    let location = format!(
        "{}/#/oauth/google?{}",
        state.config.origin.trim_end_matches('/'),
        fragment.finish()
    );
    let Ok(location) = HeaderValue::from_str(&location) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    (
        StatusCode::SEE_OTHER,
        [
            (header::LOCATION, location),
            (header::CACHE_CONTROL, HeaderValue::from_static("no-store")),
            (
                header::REFERRER_POLICY,
                HeaderValue::from_static("no-referrer"),
            ),
        ],
    )
        .into_response()
}
