use super::super::model::FREE_MEMBER_LIMIT;
use super::*;
use crate::workspaces::company::{NewCompany, Origin};

fn request(name: &str, emirate: Option<&str>) -> UpdateRequest {
    UpdateRequest {
        version: 1,
        display_name: name.into(),
        emirate: emirate.map(str::to_owned),
        trade_licence: None,
        office_phone: None,
        office_address: None,
    }
}

#[test]
fn names_are_trimmed_and_counted_in_unicode_characters() {
    let mut value = request(&format!("  {}  ", "ع".repeat(120)), Some("dubai"));
    prepare(&mut value).unwrap();
    assert_eq!(value.display_name, "ع".repeat(120));
    for name in ["".into(), " \t ".into(), "ع".repeat(121)] {
        assert_eq!(
            prepare(&mut request(&name, None)).unwrap_err().2,
            "invalid_company"
        );
    }
    let mut value = request("Synthetic", None);
    value.version = 0;
    assert!(prepare(&mut value).is_err());
}

#[test]
fn every_company_requires_an_allowlisted_emirate() {
    for emirate in EMIRATES {
        let mut value = request("Synthetic", Some(emirate));
        prepare(&mut value).unwrap();
        assert!(for_company(&value).is_ok());
    }
    let value = request("Synthetic", None);
    assert!(for_company(&value).is_err());
    for emirate in ["", "Dubai", " dubai", "dubai ", "unknown"] {
        assert!(prepare(&mut request("Synthetic", Some(emirate))).is_err());
    }
}

#[test]
fn request_denies_unowned_fields_and_wrong_shapes() {
    let base = serde_json::json!({"version":1,"displayName":"Synthetic","emirate":"dubai"});
    assert!(serde_json::from_value::<UpdateRequest>(base.clone()).is_ok());
    for (key, value) in [
        ("accountType", serde_json::json!("individual")),
        ("memberLimit", serde_json::json!(1)),
        ("origin", serde_json::json!("signup")),
        ("actorId", serde_json::json!("other")),
        ("version", serde_json::json!("1")),
        ("displayName", serde_json::Value::Null),
    ] {
        let mut body = base.clone();
        body[key] = value;
        assert!(
            serde_json::from_value::<UpdateRequest>(body).is_err(),
            "{key}"
        );
    }
}

#[test]
fn office_details_are_kept_when_left_out_cleared_when_empty_and_checked_when_sent() {
    let base = serde_json::json!({"version":1,"displayName":"Synthetic","emirate":"dubai"});
    let left_out: UpdateRequest = serde_json::from_value(base.clone()).unwrap();
    assert!(left_out.trade_licence.is_none() && left_out.office_phone.is_none());
    let mut body = base.clone();
    body["tradeLicence"] = serde_json::json!("  DED 1043378 ");
    body["officePhone"] = serde_json::json!("+971 4 (555) 2210");
    body["officeAddress"] = serde_json::Value::Null;
    let mut sent: UpdateRequest = serde_json::from_value(body).unwrap();
    prepare(&mut sent).unwrap();
    assert_eq!(sent.trade_licence, Some(Some("DED 1043378".into())));
    assert_eq!(sent.office_phone, Some(Some("+97145552210".into())));
    assert_eq!(sent.office_address, Some(None));
    for (key, value) in [
        ("tradeLicence", "L".repeat(41)),
        ("officeAddress", "A".repeat(201)),
        ("officeAddress", "Line one\nline two".into()),
        ("officePhone", "045552210".into()),
        ("officePhone", "+971 4 555 22 10 ext 3".into()),
    ] {
        let mut body = base.clone();
        body[key] = serde_json::json!(value);
        let mut request: UpdateRequest = serde_json::from_value(body).unwrap();
        assert!(prepare(&mut request).is_err(), "{key}: {value}");
    }
    let mut cleared = base.clone();
    cleared["tradeLicence"] = serde_json::json!("   ");
    let mut request: UpdateRequest = serde_json::from_value(cleared).unwrap();
    prepare(&mut request).unwrap();
    assert_eq!(request.trade_licence, Some(None));
}

#[test]
fn trusted_creation_uses_the_universal_free_company_limit() {
    let brokerage = NewCompany::OPERATOR_BROKERAGE;
    assert_eq!(brokerage.account_type.name(), "brokerage");
    assert_eq!(
        brokerage.account_type.member_limit(),
        Some(FREE_MEMBER_LIMIT)
    );
    assert_eq!(brokerage.origin.name(), "operator");
    assert_eq!(Origin::Signup.name(), "signup");
}
