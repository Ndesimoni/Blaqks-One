use super::{cookie, digest, random_token};

#[test]
fn produces_independent_tokens_and_fixed_length_server_hashes() {
    let first = random_token();
    let second = random_token();
    assert_eq!(first.len(), 43);
    assert_ne!(first, second);
    assert_eq!(digest(&first).len(), 64);
    assert_eq!(digest(&first), digest(&first));
    assert_ne!(digest(&first), digest(&second));
    assert_ne!(first, digest(&first));
}

#[test]
fn session_cookie_is_http_only_strict_and_secure_by_default() {
    let secure = cookie("opaque-token", true, false);
    for attribute in [
        "HttpOnly",
        "SameSite=Strict",
        "Secure",
        "Path=/api/crm",
        "Max-Age=28800",
    ] {
        assert!(secure.contains(attribute));
    }
    assert!(!cookie("opaque-token", false, false).contains("Secure"));
    assert!(cookie("", true, true).contains("Max-Age=0"));
}
