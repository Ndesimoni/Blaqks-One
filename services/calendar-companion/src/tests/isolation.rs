use super::harness::{connected_session, event, fixture, request, session};
use crate::{
    store::{queue_snapshot, Vault},
    sync,
};
use axum::http::StatusCode;
use serde_json::{json, Value};

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
