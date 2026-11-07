use super::*;

fn body(json: serde_json::Value) -> Body {
    serde_json::from_value(json).expect("valid body")
}

fn message(result: ApiResult<Fields>) -> &'static str {
    result.expect_err("refused").1
}

#[test]
fn a_new_client_needs_a_name_and_a_way_to_reach_them() {
    let made = Fields::fresh()
        .apply(body(serde_json::json!({
            "companyName": "  Synthetic Realty  ",
            "phone": "+971 50 123 4567",
            "email": " Lead@Example.TEST ",
        })))
        .expect("valid");
    assert_eq!(made.company_name.as_deref(), Some("Synthetic Realty"));
    assert_eq!(made.phone.as_deref(), Some("+971501234567"));
    assert_eq!(made.email.as_deref(), Some("lead@example.test"));
    assert_eq!(
        (made.source.as_str(), made.stage.as_str()),
        ("other", "new")
    );
    let nameless = body(serde_json::json!({"contactName": " ", "email": "a@b.test"}));
    assert_eq!(message(Fields::fresh().apply(nameless)), NAMED);
    let unreachable = body(serde_json::json!({"contactName": "Synthetic", "phone": ""}));
    assert_eq!(message(Fields::fresh().apply(unreachable)), REACHABLE);
}

#[test]
fn each_field_keeps_to_its_rule() {
    let base = || serde_json::json!({"contactName": "Synthetic", "email": "a@b.test"});
    let with = |key: &str, value: serde_json::Value| {
        let mut json = base();
        json[key] = value;
        message(Fields::fresh().apply(body(json)))
    };
    assert_eq!(with("phone", "0501234567".into()), PHONE);
    assert_eq!(with("email", "not-an-email".into()), EMAIL);
    assert_eq!(with("companyName", "x".repeat(161).into()), COMPANY);
    assert_eq!(with("contactName", "x".repeat(121).into()), NAME);
    assert_eq!(with("notes", "x".repeat(4001).into()), TEXT);
    assert_eq!(with("nextFollowUp", "05/11/2026".into()), DATE);
    assert_eq!(with("nextFollowUp", "2026-02-30".into()), DATE);
    assert_eq!(with("source", "Website".into()), model::SOURCE);
    assert_eq!(with("stage", "won".into()), model::STAGE);
    let mut json = base();
    json["notes"] = "x".repeat(4000).into();
    json["nextFollowUp"] = "2026-11-30".into();
    let kept = Fields::fresh().apply(body(json)).expect("valid");
    assert_eq!(kept.next_follow_up.as_deref(), Some("2026-11-30"));
}

#[test]
fn an_edit_changes_only_what_it_names_and_null_clears() {
    let current = Fields {
        company_name: Some("Synthetic Realty".into()),
        contact_name: Some("Synthetic Agent".into()),
        phone: Some("+971501234567".into()),
        email: Some("agent@example.test".into()),
        notes: Some("Called once".into()),
        owner_id: Some(Uuid::nil()),
        ..Fields::fresh()
    };
    let edited = current
        .clone()
        .apply(body(serde_json::json!({
            "version": 3, "stage": "contacted", "email": null, "ownerId": null,
        })))
        .expect("valid");
    assert_eq!(edited.stage, "contacted");
    assert_eq!((edited.email, edited.owner_id), (None, None));
    assert_eq!(edited.notes, current.notes);
    let cleared = current.apply(body(serde_json::json!({"phone": null, "email": ""})));
    assert_eq!(message(cleared), REACHABLE);
}

#[test]
fn unknown_fields_are_refused() {
    let parsed = serde_json::from_value::<Body>(serde_json::json!({"listing": "x"}));
    assert!(parsed.is_err());
}
