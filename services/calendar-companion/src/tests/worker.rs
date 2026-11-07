use super::harness::{connected_session, event, fixture, request};
use crate::sync;
use axum::http::StatusCode;
use serde_json::{json, Value};

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
