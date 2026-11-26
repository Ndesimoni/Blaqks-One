use super::*;

#[test]
fn a_marked_source_creates_the_lead() {
    let rules = Rules::defaults();
    for source in [Source::Ad, Source::Listing, Source::Form, Source::Portal] {
        assert_eq!(decide(&rules, Some(source), "Hi"), Decision::Create);
    }
    let mut narrow = Rules::defaults();
    narrow.auto_sources = vec!["portal".into()];
    assert_eq!(decide(&narrow, Some(Source::Ad), "Hi"), Decision::Nothing);
}

#[test]
fn two_property_words_suggest_and_one_does_nothing() {
    let rules = Rules::defaults();
    let two = "Looking to RENT a 2 bedroom apartment";
    assert_eq!(decide(&rules, None, two), Decision::Suggest);
    assert_eq!(
        decide(&rules, None, "Is the villa ready?"),
        Decision::Nothing
    );
    assert_eq!(
        decide(&rules, None, "Hello, how are you"),
        Decision::Nothing
    );
    let mut create = Rules::defaults();
    create.lead_mode = "create".into();
    assert_eq!(decide(&create, None, two), Decision::Create);
}

#[test]
fn arabic_words_and_phrases_count() {
    let rules = Rules::defaults();
    assert_eq!(
        decide(&rules, None, "أبحث عن شقة للإيجار، ما السعر؟"),
        Decision::Suggest
    );
    assert_eq!(decide(&rules, None, "مرحبا، كيف حالك؟"), Decision::Nothing);
    assert_eq!(words_found(&rules, "والسعر بالإيجار"), 2);
    assert_eq!(
        decide(&rules, None, "أريد شقة، ما سعر الإيجار"),
        Decision::Suggest
    );
    assert_eq!(words_found(&rules, "تاون هاوس في دبي، ميزانية جيدة"), 2);
}

#[test]
fn words_match_whole_tokens_only_and_count_once() {
    let rules = Rules::defaults();
    assert_eq!(words_found(&rules, "unity and rental"), 0);
    assert_eq!(words_found(&rules, "villa villa VILLA"), 1);
    assert_eq!(words_found(&rules, "off-plan studio"), 2);
}
