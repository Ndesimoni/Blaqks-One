use super::*;

fn body(changes: Value) -> Value {
    let mut base = json!({"expectedVersion": 0, "leadMode": "create",
        "autoSources": ["portal", "ad"], "wordsEn": [" Villa ", "villa", "rent"],
        "wordsAr": ["شقة"]});
    for (key, value) in changes.as_object().unwrap() {
        base[key] = value.clone();
    }
    base
}

#[test]
fn rules_are_normalised_and_strict() {
    let (version, rules) = parse(body(json!({}))).unwrap();
    assert_eq!(version, 0);
    assert_eq!(rules.lead_mode, "create");
    assert_eq!(rules.auto_sources, vec!["ad", "portal"]);
    assert_eq!(rules.words_en, vec!["rent", "villa"]);
    for bad in [
        json!({"leadMode": "auto"}),
        json!({"autoSources": ["tv"]}),
        json!({"wordsEn": [""]}),
        json!({"wordsEn": ["x".repeat(61)]}),
        json!({"wordsAr": [5]}),
        json!({"expectedVersion": -1}),
        json!({"extra": true}),
    ] {
        assert!(parse(body(bad.clone())).is_err(), "{bad}");
    }
    let many: Vec<String> = (0..101).map(|n| format!("word{n}")).collect();
    assert!(parse(body(json!({"wordsEn": many}))).is_err());
    let mut missing = body(json!({}));
    missing.as_object_mut().unwrap().remove("wordsAr");
    assert!(parse(missing).is_err());
}
