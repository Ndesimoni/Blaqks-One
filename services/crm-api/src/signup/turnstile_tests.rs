use super::*;
use crate::config::TurnstileConfig;
use axum::{extract::Form, routing::post, Router};
use serde::Deserialize;
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};

#[derive(Deserialize)]
struct Siteverify {
    response: String,
}

async fn stub(Form(form): Form<Siteverify>) -> (axum::http::StatusCode, String) {
    let now = OffsetDateTime::now_utc();
    let body = match form.response.as_str() {
        "ok" => format!(
            r#"{{"success":true,"action":"signup_start","hostname":"crm.example.test","challenge_ts":"{}"}}"#,
            now.format(&Rfc3339).unwrap()
        ),
        "old" => format!(
            r#"{{"success":true,"action":"signup_start","hostname":"crm.example.test","challenge_ts":"{}"}}"#,
            (now - Duration::minutes(10)).format(&Rfc3339).unwrap()
        ),
        "wrong-action" => format!(
            r#"{{"success":true,"action":"signup_resend","hostname":"crm.example.test","challenge_ts":"{}"}}"#,
            now.format(&Rfc3339).unwrap()
        ),
        "wrong-host" => format!(
            r#"{{"success":true,"action":"signup_start","hostname":"evil.example.test","challenge_ts":"{}"}}"#,
            now.format(&Rfc3339).unwrap()
        ),
        "duplicate" => r#"{"success":false,"error-codes":["timeout-or-duplicate"]}"#.into(),
        "malformed" => "not-json".into(),
        _ => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, String::new()),
    };
    (axum::http::StatusCode::OK, body)
}

async fn adapter() -> (Turnstile, tokio::task::JoinHandle<()>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        axum::serve(listener, Router::new().route("/siteverify", post(stub)))
            .await
            .unwrap();
    });
    let config = TurnstileConfig {
        secret: "secret".into(),
        site_key: "site".into(),
        hostname: "crm.example.test".into(),
        endpoint: format!("http://{address}/siteverify"),
    };
    (Turnstile::new(&config).unwrap(), server)
}

#[tokio::test]
async fn a_fresh_exact_challenge_passes_and_mismatches_fail_closed() {
    let (turnstile, server) = adapter().await;
    assert_eq!(turnstile.check("ok", "signup_start").await, Outcome::Pass);
    for token in ["old", "wrong-action", "wrong-host", "duplicate"] {
        assert_eq!(
            turnstile.check(token, "signup_start").await,
            Outcome::Fail,
            "{token}"
        );
    }
    for token in ["malformed", "500"] {
        assert_eq!(
            turnstile.check(token, "signup_start").await,
            Outcome::Unavailable,
            "{token}"
        );
    }
    server.abort();
}

#[tokio::test]
async fn an_unreachable_provider_is_unavailable() {
    let config = TurnstileConfig {
        secret: "secret".into(),
        site_key: "site".into(),
        hostname: "crm.example.test".into(),
        endpoint: "http://127.0.0.1:9/siteverify".into(),
    };
    let turnstile = Turnstile::new(&config).unwrap();
    assert_eq!(
        turnstile.check("ok", "signup_start").await,
        Outcome::Unavailable
    );
}
