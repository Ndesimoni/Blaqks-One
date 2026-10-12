use crate::{
    api,
    google::{Google, SCOPES},
    store::{queue_snapshot, random_id, Calendar, Event, Store, Tokens, Vault},
    sync, App,
};
use axum::{
    body::{to_bytes, Body},
    extract::{Form, Path, Query, State},
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;
use tower::ServiceExt;

#[derive(Default)]
struct Mock {
    events: BTreeMap<String, Value>,
    creates: usize,
    deletes: usize,
    refreshes: usize,
    notifications: Vec<String>,
    fail_next: bool,
    revoked: bool,
}
type MockState = Arc<Mutex<Mock>>;
async fn token(
    State(mock): State<MockState>,
    Form(form): Form<BTreeMap<String, String>>,
) -> Json<Value> {
    if form.get("grant_type").map(String::as_str) == Some("refresh_token") {
        mock.lock().await.refreshes += 1;
    }
    Json(
        json!({"access_token": "access-secret", "refresh_token": "refresh-secret", "expires_in": 3600, "scope": SCOPES}),
    )
}
async fn revoke(State(mock): State<MockState>) -> StatusCode {
    mock.lock().await.revoked = true;
    StatusCode::OK
}
async fn calendars() -> Json<Value> {
    Json(json!({"items": [
        {"id": "crm-calendar", "summary": "Keys with Simoni", "accessRole": "owner"},
        {"id": "read-only", "summary": "Read only", "accessRole": "reader"},
    ]}))
}
async fn update(
    State(mock): State<MockState>,
    Path((_, id)): Path<(String, String)>,
    Query(query): Query<BTreeMap<String, String>>,
    Json(body): Json<Value>,
) -> Response {
    let mut mock = mock.lock().await;
    if mock.fail_next {
        mock.fail_next = false;
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }
    if !mock.events.contains_key(&id) {
        return StatusCode::NOT_FOUND.into_response();
    }
    mock.events.insert(id.clone(), body);
    mock.notifications
        .push(query.get("sendUpdates").cloned().unwrap_or_default());
    Json(json!({"id": id, "htmlLink": "https://calendar.google.com/calendar/event?eid=test"}))
        .into_response()
}
async fn insert(
    State(mock): State<MockState>,
    Query(query): Query<BTreeMap<String, String>>,
    Json(body): Json<Value>,
) -> Response {
    let id = body["id"].as_str().unwrap().to_string();
    let mut mock = mock.lock().await;
    if mock.events.contains_key(&id) {
        return StatusCode::CONFLICT.into_response();
    }
    mock.creates += 1;
    mock.events.insert(id.clone(), body);
    mock.notifications
        .push(query.get("sendUpdates").cloned().unwrap_or_default());
    Json(json!({"id": id, "htmlLink": "https://calendar.google.com/calendar/event?eid=test"}))
        .into_response()
}
async fn delete(
    State(mock): State<MockState>,
    Path((_, id)): Path<(String, String)>,
    Query(query): Query<BTreeMap<String, String>>,
) -> StatusCode {
    let mut mock = mock.lock().await;
    mock.deletes += 1;
    mock.events.remove(&id);
    mock.notifications
        .push(query.get("sendUpdates").cloned().unwrap_or_default());
    StatusCode::NO_CONTENT
}
async fn fixture() -> (App, MockState, tokio::task::JoinHandle<()>) {
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
async fn request(
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
async fn session(app: &App) -> (String, String, String) {
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
fn event() -> Event {
    serde_json::from_value(json!({
    "key": "Follow-ups:FU-1", "summary": "Call · Test client", "description": "Record FU-1", "location": "Dubai",
    "start": {"dateTime": "2026-10-09T06:30:00Z", "timeZone": "Asia/Dubai"},
    "end": {"dateTime": "2026-10-09T07:00:00Z", "timeZone": "Asia/Dubai"}, "reminderMinutes": 15, "attendees": [],
})).unwrap()
}
async fn connected_session(app: &App) -> (String, String, String) {
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

#[tokio::test]
async fn oauth_requires_browser_state_and_csrf_and_keeps_credentials_encrypted() {
    let (app, mock, task) = fixture().await;
    let (cookie, csrf, id) = session(&app).await;
    let (status, _, _) = request(
        &app,
        "POST",
        "/api/calendar/connect",
        &cookie,
        "wrong",
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _, body) = request(
        &app,
        "POST",
        "/api/calendar/connect",
        &cookie,
        &csrf,
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let url = url::Url::parse(body["url"].as_str().unwrap()).unwrap();
    let parameters: BTreeMap<_, _> = url.query_pairs().into_owned().collect();
    assert_eq!(parameters["code_challenge_method"], "S256");
    assert_eq!(parameters["access_type"], "offline");
    let (status, _, _) = request(
        &app,
        "GET",
        "/api/calendar/oauth/callback?code=test&state=wrong",
        &cookie,
        &csrf,
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(app.store.lock().await.sessions[&id].oauth.is_some());
    let callback = format!(
        "/api/calendar/oauth/callback?code=test&state={}",
        parameters["state"]
    );
    let (status, _, _) = request(&app, "GET", &callback, &cookie, &csrf, Value::Null).await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    let (_, _, public) = request(
        &app,
        "GET",
        "/api/calendar/status",
        &cookie,
        &csrf,
        Value::Null,
    )
    .await;
    assert_eq!(public["connected"], true);
    assert!(!public.to_string().contains("access-secret"));
    let bytes = std::fs::read(&app.vault.path).unwrap();
    assert!(!bytes
        .windows(b"refresh-secret".len())
        .any(|w| w == b"refresh-secret"));
    assert_eq!(
        app.vault.load().unwrap().sessions[&id]
            .tokens
            .as_ref()
            .unwrap()
            .refresh,
        "refresh-secret"
    );
    let (status, _, _) = request(&app, "GET", &callback, &cookie, &csrf, Value::Null).await;
    assert_eq!(status, StatusCode::BAD_REQUEST); // single-use authorization state
    let (status, _, _) = request(
        &app,
        "PUT",
        "/api/calendar/selection",
        &cookie,
        &csrf,
        json!({"id": "read-only"}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _, _) = request(
        &app,
        "PUT",
        "/api/calendar/selection",
        &cookie,
        &csrf,
        json!({"id": "crm-calendar"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _, body) = request(
        &app,
        "POST",
        "/api/calendar/disconnect",
        &cookie,
        &csrf,
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["connected"], false);
    assert!(mock.lock().await.revoked);
    task.abort();
    std::fs::remove_dir_all(app.vault.path.parent().unwrap()).unwrap();
}

#[tokio::test]
async fn durable_worker_refreshes_tokens_updates_without_duplicates_retries_and_cancels() {
    let (app, mock, task) = fixture().await;
    let (cookie, csrf, id) = connected_session(&app).await;
    let first = event();
    let (status, _, body) = request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 1, "events": [first]}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["items"]["Follow-ups:FU-1"]["state"], "pending");
    // Restore from disk to prove work does not depend on an open browser or in-memory queue.
    *app.store.lock().await = app.vault.load().unwrap();
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.creates, 1);
    assert_eq!(mock.lock().await.refreshes, 1);
    let (_, _, body) = request(
        &app,
        "GET",
        "/api/calendar/status",
        &cookie,
        &csrf,
        Value::Null,
    )
    .await;
    assert_eq!(body["items"]["Follow-ups:FU-1"]["state"], "synced");
    request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 2, "events": [first]}),
    )
    .await;
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.creates, 1);
    let mut edited = first.clone();
    edited.location = "New viewing address".into();
    request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 3, "events": [edited]}),
    )
    .await;
    mock.lock().await.fail_next = true;
    sync::tick(&app).await.unwrap();
    let (_, _, body) = request(
        &app,
        "GET",
        "/api/calendar/status",
        &cookie,
        &csrf,
        Value::Null,
    )
    .await;
    assert_eq!(body["items"]["Follow-ups:FU-1"]["state"], "failed");
    assert!(app.vault.load().unwrap().sessions[&id]
        .jobs
        .values()
        .next()
        .unwrap()
        .pending());
    request(
        &app,
        "POST",
        "/api/calendar/retry",
        &cookie,
        &csrf,
        Value::Null,
    )
    .await;
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.creates, 1);
    assert_eq!(
        mock.lock().await.events.values().next().unwrap()["location"],
        "New viewing address"
    );
    // A stale request cannot delete the latest scheduled activity.
    request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 2, "events": []}),
    )
    .await;
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.deletes, 0);
    request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 4, "events": []}),
    )
    .await;
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.deletes, 1);
    assert!(mock.lock().await.events.is_empty());
    request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 5, "events": [first]}),
    )
    .await;
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.creates, 2);
    assert_eq!(mock.lock().await.events.len(), 1);
    assert!(mock.lock().await.notifications.iter().all(|n| n == "none"));
    task.abort();
    std::fs::remove_dir_all(app.vault.path.parent().unwrap()).unwrap();
}

#[tokio::test]
async fn sessions_are_isolated_and_invalid_or_implicit_invitations_are_rejected() {
    let (app, mock, task) = fixture().await;
    let (cookie, csrf, id) = connected_session(&app).await;
    let (other, other_csrf, _) = session(&app).await;
    let (_, _, body) = request(
        &app,
        "GET",
        "/api/calendar/status",
        &other,
        &other_csrf,
        Value::Null,
    )
    .await;
    assert_eq!(body["connected"], false);
    let (status, _, _) = request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &other,
        &csrf,
        json!({"revision": 1, "events": [event()]}),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let mut invalid = event();
    invalid.end.date_time = Some("2026-10-09T05:00:00Z".into());
    let (status, _, _) = request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 1, "events": [invalid]}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let mut invited = event();
    invited.attendees.push(crate::store::Attendee {
        email: "client@example.test".into(),
    });
    request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 1, "events": [invited]}),
    )
    .await;
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.notifications.last().unwrap(), "all");
    assert_eq!(
        mock.lock().await.events.values().next().unwrap()["attendees"][0]["email"],
        "client@example.test"
    );
    // Disabling sync queues a cancellation only for the CRM-managed event.
    let mut store = app.store.lock().await;
    queue_snapshot(store.sessions.get_mut(&id).unwrap(), vec![]);
    drop(store);
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.notifications.last().unwrap(), "all");
    task.abort();
    std::fs::remove_dir_all(app.vault.path.parent().unwrap()).unwrap();
}

#[tokio::test]
async fn failed_disk_writes_do_not_acknowledge_or_publish_new_work_and_wrong_keys_preserve_storage()
{
    let (mut app, mock, task) = fixture().await;
    let (cookie, csrf, id) = connected_session(&app).await;
    let original_path = app.vault.path.clone();
    let original = std::fs::read(&original_path).unwrap();
    let wrong_key = Vault::new(original_path.clone(), &"02".repeat(32)).unwrap();
    assert!(wrong_key.load().is_err());
    assert_eq!(std::fs::read(&original_path).unwrap(), original);
    let blocked = original_path.parent().unwrap().join("blocked");
    std::fs::write(&blocked, b"not a directory").unwrap();
    app.vault.path = blocked.join("calendar.enc");
    let (status, _, _) = request(
        &app,
        "PUT",
        "/api/calendar/snapshot",
        &cookie,
        &csrf,
        json!({"revision": 1, "events": [event()]}),
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(app.store.lock().await.sessions[&id].jobs.is_empty());
    sync::tick(&app).await.unwrap();
    assert_eq!(mock.lock().await.creates, 0);
    task.abort();
    std::fs::remove_dir_all(original_path.parent().unwrap()).unwrap();
}
