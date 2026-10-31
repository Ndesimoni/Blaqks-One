use super::mock::{calendars, delete, insert, revoke, token, update, Mock, MockState};
use crate::{
    api,
    google::Google,
    store::{random_id, Calendar, Event, Store, Tokens, Vault},
    App,
};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceExt;

pub(super) async fn fixture() -> (App, MockState, tokio::task::JoinHandle<()>) {
    let mock = Arc::new(Mutex::new(Mock::default()));
    let router = Router::new()
        .route("/token", post(token))
        .route("/revoke", post(revoke))
        .route("/users/me/calendarList", get(calendars))
        .route("/calendars/{calendar}/events", post(insert))
        .route(
            "/calendars/{calendar}/events/{id}",
            axum::routing::put(update).delete(delete),
        )
        .with_state(mock.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    let mut google = Google::new();
    google.api_url = base.clone();
    google.token_url = format!("{base}/token");
    google.revoke_url = format!("{base}/revoke");
    let directory = std::env::temp_dir().join(format!("kws-calendar-test-{}", random_id()));
    let vault = Vault::new(directory.join("calendar.enc"), &"01".repeat(32)).unwrap();
    let app = App {
        origin: "http://localhost:5174".into(),
        client_id: "test-client".into(),
        client_secret: "test-secret".into(),
        vault,
        store: Arc::new(Mutex::new(Store::default())),
        google,
        sync_gate: Arc::new(Mutex::new(())),
    };
    (app, mock, task)
}
pub(super) async fn request(
    app: &App,
    method: &str,
    path: &str,
    cookie: &str,
    csrf: &str,
    body: Value,
) -> (StatusCode, axum::http::HeaderMap, Value) {
    let request = Request::builder()
        .method(method)
        .uri(path)
        .header("Host", "localhost:5174")
        .header("Origin", &app.origin)
        .header("Cookie", cookie)
        .header("X-Calendar-CSRF", csrf)
        .header("Content-Type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let response = api::router(app.clone()).oneshot(request).await.unwrap();
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = to_bytes(response.into_body(), 2 * 1024 * 1024)
        .await
        .unwrap();
    (
        status,
        headers,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
pub(super) async fn session(app: &App) -> (String, String, String) {
    let (status, headers, body) =
        request(app, "GET", "/api/calendar/status", "", "", Value::Null).await;
    assert_eq!(status, StatusCode::OK);
    let cookie = headers["set-cookie"]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();
    (
        cookie.clone(),
        body["csrf"].as_str().unwrap().into(),
        cookie.strip_prefix("kws_calendar=").unwrap().into(),
    )
}
pub(super) fn event() -> Event {
    serde_json::from_value(json!({
    "key": "Follow-ups:FU-1", "summary": "Call · Test client", "description": "Record FU-1", "location": "Dubai",
    "start": {"dateTime": "2026-10-09T06:30:00Z", "timeZone": "Asia/Dubai"},
    "end": {"dateTime": "2026-10-09T07:00:00Z", "timeZone": "Asia/Dubai"}, "reminderMinutes": 15, "attendees": [],
})).unwrap()
}
pub(super) async fn connected_session(app: &App) -> (String, String, String) {
    let (cookie, csrf, id) = session(app).await;
    let mut store = app.store.lock().await;
    let session = store.sessions.get_mut(&id).unwrap();
    session.tokens = Some(Tokens {
        access: "access-secret".into(),
        refresh: "refresh-secret".into(),
        expires: 0,
    });
    session.calendar = Some(Calendar {
        id: "crm-calendar".into(),
        summary: "Keys with Simoni".into(),
    });
    (cookie, csrf, id)
}
