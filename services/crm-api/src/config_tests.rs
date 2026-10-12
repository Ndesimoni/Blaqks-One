use super::cookie_policy;

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
