//! In-company hand-over terms are built by the server within the §6 allowlist.
use super::{
    handover_terms::{build, display_name, fils, HandoverFacts},
    limits::{NO_LIMIT, OVER_LIMIT},
    model::Kind,
    tests::now,
};
use crate::records::handover_facts::PropertyFacts;
use serde_json::{json, Value};

fn facts(referral: Option<i32>, property: Option<PropertyFacts>) -> HandoverFacts {
    HandoverFacts {
        referral_bp: referral,
        fee_fils: 4_900_000,
        client_name: Some("  Layla   Hassan Al Noor ".into()),
        property,
    }
}

fn villa() -> PropertyFacts {
    PropertyFacts {
        emirate: Some("Abu Dhabi".into()),
        community: Some("Saadiyat".into()),
        property_type: Some("Villa".into()),
        bedrooms: Some("4".into()),
        size_sqft: Some("Studio".into()),
        price_aed: Some("2,450,000.5".into()),
    }
}

#[test]
fn client_names_keep_a_first_name_and_last_initial() {
    assert_eq!(display_name(Some("Layla Hassan Al Noor")), "Layla N.");
    assert_eq!(display_name(Some("Karim")), "Karim");
    assert_eq!(display_name(Some("karim@example.test")), "Client");
    assert_eq!(display_name(Some("+971501234567")), "Client");
    assert_eq!(
        display_name(Some("Synthetic finance client")),
        "Synthetic C."
    );
    assert_eq!(display_name(Some("   ")), "Client");
    assert_eq!(display_name(None), "Client");
}

#[test]
fn asking_prices_become_whole_fils_or_nothing() {
    let parse = |raw: &str| fils(&Some(raw.into()));
    assert_eq!(parse("2450000"), json!(245_000_000));
    assert_eq!(parse("2,450,000.5"), json!(245_000_050));
    assert_eq!(parse("1.25"), json!(125));
    for bad in ["", "AED 5", "1.234", "-5", "0", "1e9"] {
        assert_eq!(parse(bad), Value::Null, "{bad}");
    }
}

#[test]
fn a_full_hand_over_needs_no_limit_and_shares_no_contact() {
    let (kind, built) = build(&facts(None, Some(villa())), 0, now()).expect("full");
    assert_eq!(kind, Kind::Full);
    let terms = &built.value;
    assert_eq!(terms["kind"], "handover_full");
    assert_eq!(terms["money"]["basis"], "agent_commission");
    assert_eq!(terms["money"]["amountFils"], 4_900_000);
    assert_eq!(terms["money"]["recipientShareBp"], 10_000);
    assert_eq!(
        terms["subject"]["client"],
        json!({"displayName": "Layla N.", "contact": null})
    );
    let property = &terms["subject"]["property"];
    assert_eq!(property["area"], "Saadiyat");
    assert_eq!(property["bedrooms"], 4);
    assert_eq!(property["sizeSqft"], Value::Null);
    assert_eq!(property["listingRef"], Value::Null);
    assert_eq!(terms["governingEmirate"], "Abu Dhabi");
}

#[test]
fn a_referral_fits_the_team_limit() {
    let referral = facts(Some(2_000), None);
    let (kind, built) = build(&referral, 2_500, now()).expect("within limit");
    assert_eq!(kind, Kind::Referral);
    assert_eq!(built.value["money"]["senderShareBp"], 2_000);
    assert_eq!(built.value["subject"]["property"], Value::Null);
    assert_eq!(built.value["governingEmirate"], "Dubai");
    let over = build(&referral, 1_500, now()).map(|_| ()).unwrap_err();
    assert_eq!(over.1, OVER_LIMIT);
    let unset = build(&referral, 0, now()).map(|_| ()).unwrap_err();
    assert_eq!(unset.1, NO_LIMIT);
    let zero_fee = HandoverFacts {
        fee_fils: 0,
        ..facts(None, None)
    };
    assert!(build(&zero_fee, 0, now()).is_ok());
}
