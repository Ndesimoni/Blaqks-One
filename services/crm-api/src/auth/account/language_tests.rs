use super::*;

#[test]
fn only_english_and_arabic_are_allowed() {
    assert_eq!(allowed("en"), Some("en"));
    assert_eq!(allowed("ar"), Some("ar"));
    for refused in [
        "", "fr", "EN", "Ar", " ar", "ar ", "ar-AE", "en-GB", "arabic", "e",
    ] {
        assert_eq!(allowed(refused), None, "{refused:?}");
    }
}

#[test]
fn english_is_the_default_for_unknown_stored_values() {
    assert_eq!(LANGUAGES[0], "en");
    assert_eq!(code("ar"), "ar");
    assert_eq!(code("en"), "en");
    assert_eq!(code(""), "en");
    assert_eq!(code("fr"), "en");
}

#[test]
fn the_request_refuses_unknown_fields() {
    let parsed: LanguageRequest = serde_json::from_str(r#"{"language":"ar"}"#).unwrap();
    assert_eq!(parsed.language, "ar");
    for body in [
        r#"{"language":"ar","userId":"00000000-0000-0000-0000-000000000000"}"#,
        r#"{"language":"ar","version":1}"#,
        r#"{"language":1}"#,
        r#"{}"#,
    ] {
        assert!(
            serde_json::from_str::<LanguageRequest>(body).is_err(),
            "{body}"
        );
    }
}
