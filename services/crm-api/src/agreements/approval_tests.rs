//! H2 evidence values and the offer preview's kind and share (design §17).
use super::{
    handover_approval::Approver,
    handover_read::offer_kind,
    model::{Verification, UNKNOWN_EVIDENCE},
};
use serde_json::{json, Value};

fn terms(kind: &str, share: Value) -> Value {
    json!({ "kind": kind, "money": { "amountFils": 4_900_000, "senderShareBp": share } })
}

#[test]
fn each_approver_is_recorded_as_its_own_verification() {
    assert_eq!(Approver::Admin.verification(), Verification::AdminDecision);
    assert_eq!(
        Approver::Chosen.verification().as_str(),
        "approver_decision"
    );
}

#[test]
fn verification_readers_refuse_unknown_values() {
    for value in [
        "member",
        "contact_verified",
        "admin_decision",
        "approver_decision",
    ] {
        let parsed = Verification::parse(value).expect("known verification");
        assert_eq!(parsed.as_str(), value);
    }
    for value in ["", "admin", "Approver_decision", "approved"] {
        let error = Verification::parse(value).unwrap_err();
        assert_eq!(
            (error.0.as_u16(), error.1),
            (409, UNKNOWN_EVIDENCE),
            "{value}"
        );
    }
}

#[test]
fn a_full_hand_over_has_no_referral_share() {
    let full = terms("handover_full", json!(0));
    assert_eq!(offer_kind("handover_full", &full), Some(("full", None)));
    let with_share = terms("handover_full", json!(2_000));
    assert_eq!(offer_kind("handover_full", &with_share), None);
}

#[test]
fn a_referral_keeps_the_sender_share() {
    let referral = terms("handover_referral", json!(2_000));
    let expected = Some(("referral", Some(2_000)));
    assert_eq!(offer_kind("handover_referral", &referral), expected);
    for share in [json!(0), json!(10_000), json!(null), json!("2000")] {
        let odd = terms("handover_referral", share.clone());
        assert_eq!(offer_kind("handover_referral", &odd), None, "{share}");
    }
}

#[test]
fn the_stored_kind_and_the_frozen_terms_must_agree() {
    let referral = terms("handover_referral", json!(2_000));
    assert_eq!(offer_kind("handover_full", &referral), None);
    let co_broking = terms("co_broking", json!(5_000));
    assert_eq!(offer_kind("co_broking", &co_broking), None);
    assert_eq!(offer_kind("handover_full", &json!({})), None);
}
