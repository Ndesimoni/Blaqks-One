use super::harness::{fixture, request, session};
use axum::http::StatusCode;
use serde_json::{json, Value};
use std::collections::BTreeMap;

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
