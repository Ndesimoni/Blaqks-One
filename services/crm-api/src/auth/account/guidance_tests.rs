use super::*;

#[test]
fn the_request_accepts_only_an_explicit_boolean() {
    let parsed: GuidanceRequest = serde_json::from_str(r#"{"enabled":false}"#).unwrap();
    assert!(!parsed.enabled);
    let parsed: GuidanceRequest = serde_json::from_str(r#"{"enabled":true}"#).unwrap();
    assert!(parsed.enabled);
    for body in [
        r#"{"enabled":"true"}"#,
        r#"{"enabled":1}"#,
        r#"{"enabled":null}"#,
        r#"{"guidanceEnabled":true}"#,
        r#"{"enabled":true,"userId":"00000000-0000-0000-0000-000000000000"}"#,
        r#"{"enabled":true,"version":1}"#,
        r#"{}"#,
    ] {
        assert!(
            serde_json::from_str::<GuidanceRequest>(body).is_err(),
            "{body}"
        );
    }
}
