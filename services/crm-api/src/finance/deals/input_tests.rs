use super::*;
use crate::finance::deals::fields::MAX_DEAL_FILS;
use serde_json::json;

fn body() -> Value {
    json!({"clientId": "CL-001", "dealType": "Sale", "stage": "Offer",
        "agreedValueFils": 245_000_000, "feeBasis": "percentage", "feeRateBp": 200,
        "details": {"notes": "Synthetic"}})
}

fn with(changes: Value) -> Value {
    let mut value = body();
    for (key, change) in changes.as_object().unwrap() {
        value[key] = change.clone();
    }
    value
}

fn message(value: &Value, creating: bool) -> &'static str {
    parse(value, creating).unwrap_err().1
}

#[test]
fn a_complete_deal_parses_with_defaults() {
    let input = parse(&body(), true).unwrap();
    assert_eq!(input.client_ref, "CL-001");
    assert_eq!((input.partner_share_bp, input.property_ref), (0, None));
    assert_eq!(
        (input.fee_basis, input.fee_rate_bp),
        ("percentage", Some(200))
    );
    let fixed = with(
        json!({"feeBasis": "fixed", "fixedFeeFils": 1_500_000, "feeRateBp": null,
        "propertyId": " PR-002 ", "partnerName": "  ", "partnerShareBp": 5000}),
    );
    let input = parse(&fixed, true).unwrap();
    assert_eq!(input.fixed_fee_fils, Some(1_500_000));
    assert_eq!(input.property_ref.as_deref(), Some("PR-002"));
    assert_eq!((input.partner_name, input.partner_share_bp), (None, 5000));
}

#[test]
fn ids_split_fields_and_unknown_keys_are_refused() {
    assert_eq!(message(&with(json!({"dealId": "DL-001"})), true), ISSUED);
    let echoed = parse(&with(json!({"dealId": "DL-001"})), false).unwrap();
    assert_eq!(echoed.deal_id.as_deref(), Some("DL-001"));
    for key in SPLIT {
        assert_eq!(
            message(&with(json!({key: null})), false),
            SPLIT_PANEL,
            "{key}"
        );
    }
    assert_eq!(message(&with(json!({"assigneeId": null})), true), INVALID);
    let mut missing = body();
    missing.as_object_mut().unwrap().remove("details");
    assert_eq!(message(&missing, true), INVALID);
    assert_eq!(message(&json!([]), true), INVALID);
}

#[test]
fn money_rates_and_options_are_exact() {
    for value in [
        json!(1.5),
        json!("100"),
        json!(-1),
        json!(MAX_DEAL_FILS + 1),
        json!(1e3),
    ] {
        assert_eq!(
            message(&with(json!({"agreedValueFils": value})), true),
            MONEY
        );
    }
    assert!(parse(&with(json!({"agreedValueFils": MAX_DEAL_FILS})), true).is_ok());
    assert_eq!(
        message(&with(json!({"feeRateBp": 10001})), true),
        wire::PERCENT
    );
    assert_eq!(message(&with(json!({"feeRateBp": null})), true), FEE);
    assert_eq!(message(&with(json!({"feeBasis": "fixed"})), true), FEE);
    let options = [
        ("dealType", "Lease", "Choose a valid deal type."),
        ("stage", "Won", "Choose a valid deal stage."),
        ("feeBasis", "Percentage", "Choose a valid fee basis."),
    ];
    for (key, value, expected) in options {
        assert_eq!(message(&with(json!({key: value})), true), expected);
    }
    for client in [json!(null), json!(""), json!(5), json!("x".repeat(129))] {
        assert_eq!(message(&with(json!({"clientId": client})), true), CLIENT);
    }
    assert_eq!(
        message(&with(json!({"partnerName": "x".repeat(201)})), true),
        INVALID
    );
}
