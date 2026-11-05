use super::*;
use serde_json::json;

fn body(changes: Value) -> Value {
    let mut body = json!({"month": "2026-10", "memberId": null, "metric": "fees",
        "value": 500_000, "version": null});
    for (key, value) in changes.as_object().unwrap() {
        body[key] = value.clone();
    }
    body
}

fn message(result: ApiResult<TargetInput>) -> &'static str {
    result.expect_err("refused").1
}

#[test]
fn months_are_strict() {
    assert_eq!(month("2026-10").unwrap(), "2026-10");
    for bad in [
        "2026-13",
        "2026-00",
        "1999-12",
        "2101-01",
        "26-10",
        "2026-1",
        "2026/10",
        "２０２６-10",
    ] {
        assert_eq!(month(bad).map_err(|e| e.1), Err(MONTH), "{bad}");
    }
}

#[test]
fn bodies_need_exact_keys_and_ranges() {
    let parsed = parse(body(json!({}))).unwrap();
    assert_eq!(
        (parsed.metric, parsed.value, parsed.version),
        (Metric::Fees, Some(500_000), None)
    );
    let member = Uuid::new_v4();
    let parsed = parse(body(
        json!({"memberId": member.to_string(), "value": null, "version": 3}),
    ));
    let parsed = parsed.unwrap();
    assert_eq!(
        (parsed.member, parsed.value, parsed.version),
        (Some(member), None, Some(3))
    );
    assert_eq!(message(parse(json!([]))), INVALID);
    let mut missing = body(json!({}));
    missing.as_object_mut().unwrap().remove("version");
    assert_eq!(message(parse(missing)), INVALID);
    assert_eq!(message(parse(body(json!({"extra": 1})))), INVALID);
    assert_eq!(message(parse(body(json!({"memberId": "nope"})))), INVALID);
    assert_eq!(message(parse(body(json!({"metric": "calls"})))), METRIC);
    assert_eq!(message(parse(body(json!({"month": 202610})))), MONTH);
    assert_eq!(message(parse(body(json!({"value": -1})))), VALUE);
    assert_eq!(message(parse(body(json!({"value": 1.5})))), VALUE);
    assert_eq!(message(parse(body(json!({"value": "10"})))), VALUE);
    let counts = json!({"metric": "viewings", "value": 1_000_001});
    assert_eq!(message(parse(body(counts))), VALUE);
    assert!(parse(body(json!({"value": 1_000_000_000_000_i64}))).is_ok());
    assert_eq!(message(parse(body(json!({"version": 0})))), INVALID);
}
