use super::*;

fn some(value: &str) -> Option<String> {
    Some(value.into())
}

#[test]
fn google_is_optional_and_needs_both_values() {
    let none = google_config(None, None, None, None, "https://crm.test", false);
    assert!(none.unwrap().is_none());
    assert!(google_config(some("id"), None, None, None, "https://crm.test", false).is_err());
}

#[test]
fn the_redirect_is_fixed_and_the_endpoint_is_local_only() {
    let production = |domain| google_config(some("id"), some("s"), domain, None, "x", false);
    assert!(
        production(None).is_err(),
        "production needs the Workspace domain"
    );
    let config = google_config(
        some("id"),
        some("secret"),
        some("keys.example"),
        None,
        "https://crm.test/",
        false,
    )
    .unwrap()
    .unwrap();
    assert_eq!(
        config.redirect_uri,
        "https://crm.test/api/crm/integrations/google/callback"
    );
    assert_eq!(config.token_url, TOKEN);
    let stub = some("http://127.0.0.1:8791");
    assert!(google_config(
        some("id"),
        some("s"),
        None,
        stub.clone(),
        "https://c.test",
        false
    )
    .is_err());
    let local = google_config(
        some("id"),
        some("s"),
        None,
        stub,
        "http://localhost:5175",
        true,
    )
    .unwrap()
    .unwrap();
    assert_eq!(local.token_url, "http://127.0.0.1:8791/token");
}

#[test]
fn the_workspace_domain_is_checked() {
    let bad = google_config(some("i"), some("s"), some("not a domain"), None, "x", true);
    assert!(bad.is_err());
    let good = google_config(some("i"), some("s"), some("Keys.Example"), None, "x", true);
    assert_eq!(
        good.unwrap().unwrap().domain.as_deref(),
        Some("keys.example")
    );
}
