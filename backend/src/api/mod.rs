mod calendars;
mod oauth;
mod queue;
mod session;

pub use session::persist;

use crate::{error, App};
use axum::{
    extract::DefaultBodyLimit,
    http::{header, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Router,
};
use calendars::{calendars, selection};
use oauth::{callback, connect};
use queue::{disconnect, retry, snapshot};
use session::status;

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
