use super::*;
use serde_json::json;

fn input() -> Input {
    serde_json::from_value(
        json!({"name":"Fictional Visitor","email":"visitor@example.test",
        "message":"A synthetic enquiry.","privacyAcknowledged":true}),
    )
    .unwrap()
}

#[test]
fn contact_and_privacy_are_required_without_marketing_consent() {
    assert!(prepare(input()).is_ok());
    let mut value = input();
    value.privacy_acknowledged = false;
    assert!(prepare(value).is_err());
    let mut value = input();
    value.email = None;
    assert!(prepare(value).is_err());
    let mut value = input();
    value.contact_preference = Some("whatsapp".into());
    assert!(prepare(value).is_err());
}

#[test]
fn trimmed_equivalent_inputs_share_a_fingerprint() {
    let canonical = prepare(input()).unwrap();
    let mut padded = input();
    padded.name = " Fictional Visitor ".into();
    padded.email = Some(" VISITOR@EXAMPLE.TEST ".into());
    assert_eq!(
        payload_hash(&canonical).unwrap(),
        payload_hash(&prepare(padded).unwrap()).unwrap()
    );
    let mut changed = input();
    changed.message = "Different enquiry".into();
    assert_ne!(
        payload_hash(&canonical).unwrap(),
        payload_hash(&changed).unwrap()
    );
}

#[test]
fn keys_and_payloads_cannot_smuggle_routing_or_private_ids() {
    let mut headers = HeaderMap::new();
    assert!(key(&headers).is_err());
    headers.insert("idempotency-key", "synthetic-enquiry-0001".parse().unwrap());
    assert!(key(&headers).is_ok());
    headers.append("idempotency-key", "synthetic-enquiry-0002".parse().unwrap());
    assert!(key(&headers).is_err());
    let mut raw = serde_json::to_value(input()).unwrap();
    raw["workspaceId"] = json!("another-company");
    assert!(serde_json::from_value::<Input>(raw).is_err());
}
