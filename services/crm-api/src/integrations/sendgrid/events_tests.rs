//! Unit tests for `events.rs`: signatures over the timestamp and raw body, freshness and
//! parsing. Keys are generated per run; no SendGrid fixture is used.
use super::*;
use ring::{
    rand::SystemRandom,
    signature::{EcdsaKeyPair, KeyPair, ECDSA_P256_SHA256_ASN1_SIGNING},
};

fn key_pair() -> (EcdsaKeyPair, String) {
    let rng = SystemRandom::new();
    let pkcs8 = EcdsaKeyPair::generate_pkcs8(&ECDSA_P256_SHA256_ASN1_SIGNING, &rng).unwrap();
    let pair =
        EcdsaKeyPair::from_pkcs8(&ECDSA_P256_SHA256_ASN1_SIGNING, pkcs8.as_ref(), &rng).unwrap();
    let mut spki = P256_SPKI.to_vec();
    spki.extend_from_slice(pair.public_key().as_ref());
    (pair, STANDARD.encode(spki))
}

fn sign(pair: &EcdsaKeyPair, timestamp: &str, body: &[u8]) -> String {
    let mut signed = timestamp.as_bytes().to_vec();
    signed.extend_from_slice(body);
    let signature = pair.sign(&SystemRandom::new(), &signed).unwrap();
    STANDARD.encode(signature.as_ref())
}

#[test]
fn only_the_connection_key_over_timestamp_and_body_verifies() {
    let (pair, public) = key_pair();
    let (_, other) = key_pair();
    let body = br#"[{"event":"delivered"}]"#;
    let signature = sign(&pair, "1760000000", body);
    assert!(verified(&public, "1760000000", &signature, body));
    assert!(
        !verified(&other, "1760000000", &signature, body),
        "another key"
    );
    assert!(
        !verified(&public, "1760000001", &signature, body),
        "another time"
    );
    assert!(
        !verified(&public, "1760000000", &signature, b"[]"),
        "another body"
    );
    assert!(!verified(&public, "1760000000", "not base64!", body));
    assert!(
        !verified("AAAA", "1760000000", &signature, body),
        "not a P-256 key"
    );
}

#[test]
fn timestamps_must_be_within_five_minutes() {
    assert!(fresh("1000", 1000));
    assert!(fresh("1300", 1000));
    assert!(fresh("700", 1000));
    assert!(!fresh("1301", 1000));
    assert!(!fresh("699", 1000));
    for bad in ["", "-5", "12a", "9999999999999"] {
        assert!(!fresh(bad, 1000), "{bad}");
    }
}

#[test]
fn only_known_kinds_with_a_message_uuid_are_kept() {
    let id = Uuid::new_v4();
    let body = format!(
        r#"[{{"event":"delivered","inbox_message":"{id}","sg_message_id":"abc.filter1"}},
            {{"event":"bounce","inbox_message":"{id}"}},
            {{"event":"open","inbox_message":"{id}"}},
            {{"event":"delivered","inbox_message":"not-a-uuid"}},
            {{"event":"dropped"}}, 42]"#
    );
    let events = parse(body.as_bytes()).unwrap();
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].kind, Kind::Delivered);
    assert_eq!(events[0].provider_id.as_deref(), Some("abc.filter1"));
    assert_eq!(events[1].kind, Kind::Bounced);
    assert!(parse(b"{}").is_none());
    let many = format!("[{}]", vec!["{}"; MAX_EVENTS + 1].join(","));
    assert!(parse(many.as_bytes()).is_none());
}
