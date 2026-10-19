//! Agreement term and share rules (docs/agreements-design.md §2–§3).
use super::{
    model::{Kind, Party},
    terms,
};
use serde_json::{json, Value};
use time::{Duration, OffsetDateTime};

pub(super) fn input(sender_bp: i64, expires: Value) -> Value {
    json!({
        "property": {
            "emirate": "Dubai",
            "area": "Dubai Marina",
            "propertyType": "Apartment",
            "bedrooms": 2,
            "sizeSqft": 1_100,
            "askingPriceFils": 210_000_000,
            "listingRef": "AG-1",
        },
        "client": { "displayName": "Synthetic A.", "contact": null },
        "money": {
            "basis": "commission",
            "amountFils": 5_250_000,
            "senderShareBp": sender_bp,
            "paymentExpectation": "on_transfer",
        },
        "expiresAt": expires,
        "governingEmirate": "Dubai",
        "notes": null,
    })
}

pub(super) fn now() -> OffsetDateTime {
    OffsetDateTime::from_unix_timestamp(1_760_000_000).expect("fixed clock")
}

#[test]
fn full_handover_keeps_nothing_for_the_sender() {
    assert_eq!(Kind::Full.shares(0).expect("full"), (0, 10_000));
    assert!(Kind::Full.shares(1).is_err());
}

#[test]
fn referral_and_co_broking_compute_the_other_side() {
    assert_eq!(
        Kind::Referral.shares(2_500).expect("referral"),
        (2_500, 7_500)
    );
    assert!(Kind::Referral.shares(0).is_err());
    assert!(Kind::Referral.shares(5_001).is_err());
    assert_eq!(
        Kind::CoBroking.shares(4_000).expect("co-broking"),
        (4_000, 6_000)
    );
    assert!(Kind::CoBroking.shares(10_000).is_err());
}

#[test]
fn terms_are_canonical_and_record_both_shares() {
    let built = terms::build(Kind::Referral, &input(2_500, Value::Null), now()).expect("valid");
    assert_eq!(built.value["money"]["senderShareBp"], 2_500);
    assert_eq!(built.value["money"]["recipientShareBp"], 7_500);
    assert_eq!(built.subject_digest.len(), 64);
    let again = terms::build(Kind::Referral, &input(2_500, Value::Null), now()).expect("valid");
    assert_eq!(built.value, again.value);
}

#[test]
fn client_contact_changes_the_digest_only_when_present() {
    let mut with_contact = input(0, Value::Null);
    with_contact["client"]["contact"] = json!("client@example.test");
    let plain = terms::build(Kind::Full, &input(0, Value::Null), now()).expect("valid");
    let shared = terms::build(Kind::Full, &with_contact, now()).expect("valid");
    assert_ne!(plain.subject_digest, shared.subject_digest);
}

#[test]
fn expiry_defaults_to_fourteen_days_and_rejects_out_of_range() {
    let built = terms::build(Kind::Full, &input(0, Value::Null), now()).expect("valid");
    assert_eq!(built.expires_at, now() + Duration::days(14));
    let soon = (now() + Duration::minutes(30))
        .format(&time::format_description::well_known::Rfc3339)
        .expect("stamp");
    assert!(terms::build(Kind::Full, &input(0, json!(soon)), now()).is_err());
    let far = (now() + Duration::days(91))
        .format(&time::format_description::well_known::Rfc3339)
        .expect("stamp");
    assert!(terms::build(Kind::Full, &input(0, json!(far)), now()).is_err());
}

#[test]
fn unknown_fields_and_bad_shares_are_refused() {
    let mut extra = input(0, Value::Null);
    extra["accountType"] = json!("brokerage");
    assert!(terms::build(Kind::Full, &extra, now()).is_err());
    assert!(terms::build(Kind::Referral, &input(0, Value::Null), now()).is_err());
    let oversized = input(0, Value::Null);
    let mut notes = oversized.clone();
    notes["notes"] = json!("x".repeat(2_001));
    assert!(terms::build(Kind::Full, &notes, now()).is_err());
}

#[test]
fn parties_alternate_and_kinds_round_trip() {
    assert_eq!(Party::Sender.other(), Party::Recipient);
    for kind in [Kind::Full, Kind::Referral, Kind::CoBroking] {
        assert_eq!(Kind::parse(kind.as_str()).expect("kind"), kind);
    }
    assert!(Kind::parse("partnership").is_err());
}
