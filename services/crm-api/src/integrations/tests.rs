//! Unit contracts for X1: credential sealing, channel/provider pairing and the
//! redacted connection view.
use super::{
    crypto,
    model::{Channel, ConnectionRow, Provider, State},
    wire::mask,
};
use serde_json::json;
use uuid::Uuid;

fn key() -> [u8; 32] {
    [9u8; 32]
}

#[test]
fn credentials_round_trip_and_stay_bound_to_their_connection() {
    let aad = crypto::aad("ws-a", "connection-1", "twilio", "whatsapp", 1);
    let sealed = crypto::seal(&key(), &aad, b"synthetic-secret").unwrap();
    assert_ne!(sealed, b"synthetic-secret");
    assert_eq!(
        crypto::open(&key(), &aad, &sealed).unwrap(),
        b"synthetic-secret"
    );
    let other = crypto::aad("ws-b", "connection-1", "twilio", "whatsapp", 1);
    assert!(crypto::open(&key(), &other, &sealed).is_err());
    let next_version = crypto::aad("ws-a", "connection-1", "twilio", "whatsapp", 2);
    assert!(crypto::open(&key(), &next_version, &sealed).is_err());
    let wrong_key = [8u8; 32];
    assert!(crypto::open(&wrong_key, &aad, &sealed).is_err());
    let mut tampered = sealed.clone();
    let last = tampered.len() - 1;
    tampered[last] ^= 1;
    assert!(crypto::open(&key(), &aad, &tampered).is_err());
    assert!(crypto::open(&key(), &aad, b"short").is_err());
}

#[test]
fn only_supported_channel_provider_pairs_are_accepted() {
    assert!(Channel::Whatsapp.allows(Provider::Twilio));
    assert!(!Channel::Whatsapp.allows(Provider::Meta));
    assert!(Channel::Email.allows(Provider::Google));
    assert!(Channel::Email.allows(Provider::Microsoft));
    assert!(Channel::Facebook.allows(Provider::Meta));
    assert!(Channel::Instagram.allows(Provider::Meta));
    assert!(Channel::Tiktok.allows(Provider::Tiktok));
    assert!(!Channel::Tiktok.allows(Provider::Meta));
    assert!(!Channel::Instagram.allows(Provider::Tiktok));
    assert_eq!(State::parse("reconnect_required").health(), "attention");
    assert_eq!(State::parse("disconnected").health(), "off");
    assert_eq!(State::parse("connected").health(), "healthy");
}

#[test]
fn views_mask_the_account_and_never_expose_credentials() {
    let row = ConnectionRow {
        id: Uuid::new_v4(),
        workspace_id: "ws-a".into(),
        channel: "whatsapp".into(),
        provider: "twilio".into(),
        external_account_id: "+971500001234".into(),
        display_label: "Studio line".into(),
        owner_member_id: None,
        state: "connected".into(),
        credential_key_version: Some(1),
        credential_updated_at: Some("2026-10-20T10:00:00Z".into()),
        version: 3,
        created_at: "2026-10-20T10:00:00Z".into(),
        updated_at: "2026-10-20T10:00:00Z".into(),
    };
    let view = row.view();
    assert_eq!(view["accountHint"], "••••1234");
    assert_eq!(view["health"], "healthy");
    assert_eq!(view["version"], 3);
    let text = serde_json::to_string(&json!({ "connection": view })).unwrap();
    assert!(!text.contains("+971500001234"));
    assert!(!text.contains("credential_key"));
    assert!(!text.contains("sealed"));
    assert_eq!(mask("ab"), "••••");
    assert_eq!(mask("a@b.com"), "••••");
    assert_eq!(mask("+971500001234"), "••••1234");
}
