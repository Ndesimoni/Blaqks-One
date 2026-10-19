use super::{cookie_policy, signup_mode, turnstile_config, worker_enabled, SignupMode};

#[test]
fn requires_https_unless_insecure_loopback_is_explicitly_enabled() {
    let local = "127.0.0.1:8788".parse().unwrap();
    assert_eq!(
        cookie_policy("https://crm.example.test", false, local),
        Ok(true)
    );
    assert!(cookie_policy("http://localhost:5175", false, local).is_err());
    assert_eq!(
        cookie_policy("http://localhost:5175", true, local),
        Ok(false)
    );
    assert!(cookie_policy("http://crm.example.test", true, local).is_err());
    assert!(cookie_policy("https://crm.example.test", true, local).is_err());
    assert!(cookie_policy(
        "http://localhost:5175",
        true,
        "0.0.0.0:8788".parse().unwrap()
    )
    .is_err());
}

#[test]
fn rejects_origins_with_paths_credentials_query_or_fragment() {
    let local = "127.0.0.1:8788".parse().unwrap();
    for origin in [
        "https://crm.example.test/",
        "https://crm.example.test/login",
        "https://user:secret@crm.example.test",
        "https://crm.example.test?query=1",
        "https://crm.example.test#fragment",
        "javascript:example",
    ] {
        assert!(cookie_policy(origin, false, local).is_err());
    }
}

#[test]
fn signup_is_off_by_default_and_local_needs_insecure_loopback() {
    assert_eq!(signup_mode(None, true), Ok(SignupMode::Off));
    assert_eq!(signup_mode(Some("off"), false), Ok(SignupMode::Off));
    assert_eq!(signup_mode(Some("local"), false), Ok(SignupMode::Local));
    assert!(signup_mode(Some("local"), true).is_err());
    assert!(signup_mode(Some("live"), false).is_err());
    assert!(signup_mode(Some("invalid"), false).is_err());
}

#[test]
fn the_delivery_worker_defaults_on_and_refuses_unknown_values() {
    assert_eq!(worker_enabled(None), Ok(true));
    assert_eq!(worker_enabled(Some("on")), Ok(true));
    assert_eq!(worker_enabled(Some("off")), Ok(false));
    assert!(worker_enabled(Some("auto")).is_err());
}

#[test]
fn turnstile_needs_all_three_public_and_secret_values() {
    let none = turnstile_config(None, None, None, None).unwrap();
    assert!(none.is_none());
    let full = turnstile_config(
        Some("secret".into()),
        Some("site".into()),
        Some("crm.example.test".into()),
        None,
    )
    .unwrap()
    .unwrap();
    assert_eq!(full.site_key, "site");
    assert_eq!(full.hostname, "crm.example.test");
    assert!(full
        .endpoint
        .starts_with("https://challenges.cloudflare.com/"));
    assert!(turnstile_config(Some("secret".into()), None, None, None).is_err());
    assert!(turnstile_config(None, Some("site".into()), None, None).is_err());
    assert!(turnstile_config(None, None, Some("host".into()), None).is_err());
}
