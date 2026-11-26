use super::*;
use serde_json::json;

fn content(value: Value) -> Content {
    serde_json::from_value(value).unwrap()
}

const SID: &str = "HX0123456789abcdef0123456789abcdef";

#[test]
fn approved_text_templates_keep_their_body_and_variable_count() {
    let parsed = parse(&content(json!({
        "sid": SID,
        "friendly_name": " viewing_reminder\u{7} ",
        "language": "en",
        "types": {"twilio/text": {"body": "Hi {{1}}, your viewing is on {{2}}."}},
        "approval_requests": {"category": "UTILITY", "status": "approved"},
    })))
    .unwrap();
    assert_eq!(parsed.name, "viewing_reminder");
    assert_eq!(parsed.language, "en");
    assert_eq!(parsed.category.as_deref(), Some("UTILITY"));
    assert_eq!(parsed.approval, "approved");
    assert_eq!(
        parsed.text,
        Some(("Hi {{1}}, your viewing is on {{2}}.".into(), 2))
    );
    // A single content read nests the request under `whatsapp`.
    let nested = parse(&content(json!({
        "sid": SID, "language": "en_GB",
        "types": {"twilio/text": {"body": "Thank you."}},
        "approval_requests": {"whatsapp": {"status": "paused", "category": "<b>"}},
    })))
    .unwrap();
    assert_eq!(nested.approval, "paused");
    assert_eq!(nested.category, None);
    assert_eq!(nested.name, "Untitled template");
    assert_eq!(nested.language, "en_GB");
    assert_eq!(nested.text, Some(("Thank you.".into(), 0)));
}

#[test]
fn other_types_ids_and_variable_forms_are_never_offered() {
    let card = parse(&content(json!({
        "sid": SID, "language": "english!",
        "types": {"twilio/card": {"title": "Hi"}},
        "approval_requests": {"status": "received"},
    })))
    .unwrap();
    assert_eq!(card.text, None);
    assert_eq!(card.approval, "pending");
    assert_eq!(card.language, "und");
    for sid in ["HX123", "XE0123456789abcdef0123456789abcdef", ""] {
        assert!(parse(&content(json!({"sid": sid}))).is_none(), "{sid}");
    }
    let long = "a".repeat(1025);
    for body in [
        "Hi {{name}}",
        "Hi {{2}}",
        "Hi {{1}} {{3}}",
        "Hi {{ 1 }}",
        "{{11}}",
        &long,
    ] {
        let parsed = parse(&content(json!({
            "sid": SID, "types": {"twilio/text": {"body": body}},
            "approval_requests": {"status": "approved"},
        })))
        .unwrap();
        assert_eq!(parsed.text, None, "{body}");
    }
    assert_eq!(super::approval("something_new"), "other");
}

#[test]
fn placeholders_count_and_fill_in_one_pass() {
    assert_eq!(variable_count("No variables"), Some(0));
    assert_eq!(variable_count("{{1}} and {{1}} again, then {{2}}"), Some(2));
    assert_eq!(variable_count("Open {{1"), None);
    let values = vec!["{{2}}".to_string(), "Saturday".to_string()];
    assert_eq!(
        fill("Hi {{1}}, see you {{2}}. {{3}} {{x}} {{", &values),
        "Hi {{2}}, see you Saturday. {{3}} {{x}} {{"
    );
}
