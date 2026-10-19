use super::*;
use axum::http::{HeaderMap, HeaderValue};

fn keys(trusted: &str) -> ClientKeys {
    ClientKeys::new(trusted, "cf-connecting-ip", "test-secret").unwrap()
}

fn peer(ip: &str) -> SocketAddr {
    SocketAddr::new(ip.parse().unwrap(), 443)
}

#[test]
fn an_untrusted_peer_ignores_forged_forwarding_headers() {
    let mut headers = HeaderMap::new();
    headers.insert("cf-connecting-ip", HeaderValue::from_static("203.0.113.9"));
    let first = keys("").digest(peer("198.51.100.4"), &headers).unwrap();
    let second = keys("")
        .digest(peer("198.51.100.4"), &HeaderMap::new())
        .unwrap();
    assert_eq!(first, second);
    assert_ne!(
        first,
        keys("").digest(peer("198.51.100.5"), &headers).unwrap()
    );
}

#[test]
fn a_trusted_proxy_supplies_the_canonical_forwarded_address() {
    let mut headers = HeaderMap::new();
    headers.insert("cf-connecting-ip", HeaderValue::from_static("203.0.113.9"));
    let direct = keys("10.0.0.1")
        .digest(peer("10.0.0.1"), &HeaderMap::new())
        .unwrap();
    let forwarded = keys("10.0.0.1").digest(peer("10.0.0.1"), &headers).unwrap();
    assert_ne!(direct, forwarded);
    assert_eq!(
        forwarded,
        keys("10.0.0.1").digest(peer("10.0.0.1"), &headers).unwrap()
    );
}

#[test]
fn duplicate_or_malformed_forwarding_is_refused() {
    let mut duplicate = HeaderMap::new();
    duplicate.append("cf-connecting-ip", HeaderValue::from_static("203.0.113.9"));
    duplicate.append("cf-connecting-ip", HeaderValue::from_static("203.0.113.10"));
    let mut joined = HeaderMap::new();
    joined.insert(
        "cf-connecting-ip",
        HeaderValue::from_static("203.0.113.9, 10.0.0.1"),
    );
    let mut malformed = HeaderMap::new();
    malformed.insert("cf-connecting-ip", HeaderValue::from_static("not-an-ip"));
    for headers in [duplicate, joined, malformed] {
        let error = keys("10.0.0.1")
            .digest(peer("10.0.0.1"), &headers)
            .unwrap_err();
        assert_eq!(error.2, "invalid_request");
    }
}

#[test]
fn the_digest_depends_on_the_secret() {
    let peer = peer("198.51.100.4");
    let first = keys("10.0.0.1").digest(peer, &HeaderMap::new()).unwrap();
    let second = ClientKeys::new("10.0.0.1", "cf-connecting-ip", "other-secret")
        .unwrap()
        .digest(peer, &HeaderMap::new())
        .unwrap();
    assert_ne!(first, second);
    assert_eq!(first.len(), 64);
}
