use crate::google::SCOPES;
use axum::{
    extract::{Form, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::Arc};
use tokio::sync::Mutex;

#[derive(Default)]
pub(super) struct Mock {
    pub(super) events: BTreeMap<String, Value>,
    pub(super) creates: usize,
    pub(super) deletes: usize,
    pub(super) refreshes: usize,
    pub(super) notifications: Vec<String>,
    pub(super) fail_next: bool,
    pub(super) revoked: bool,
}
pub(super) type MockState = Arc<Mutex<Mock>>;
pub(super) async fn token(
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
pub(super) async fn revoke(State(mock): State<MockState>) -> StatusCode {
    mock.lock().await.revoked = true;
    StatusCode::OK
}
pub(super) async fn calendars() -> Json<Value> {
    Json(json!({"items": [
        {"id": "crm-calendar", "summary": "Keys with Simoni", "accessRole": "owner"},
        {"id": "read-only", "summary": "Read only", "accessRole": "reader"},
    ]}))
}
pub(super) async fn update(
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
pub(super) async fn insert(
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
pub(super) async fn delete(
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
