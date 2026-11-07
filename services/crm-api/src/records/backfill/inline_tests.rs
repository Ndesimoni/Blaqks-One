use super::*;
use crate::records::validation::media::validate;
use serde_json::json;

const JPEG: &str = "data:image/jpeg;base64,/9j/4AAQ";

fn reason(asset: Value) -> Option<Reason> {
    match classify(&asset) {
        Entry::Left(reason) => Some(reason),
        _ => None,
    }
}

#[test]
fn stored_entries_and_foreign_shapes_are_kept_as_they_are() {
    let id = "11111111-1111-4111-8111-111111111111";
    for asset in [
        json!({"name": "front.jpg", "file": id, "thumb": id, "type": "image/jpeg"}),
        json!({"name": "plan.pdf", "file": id}),
        json!("not an object"),
        json!(null),
    ] {
        assert!(matches!(classify(&asset), Entry::Keep), "{asset}");
    }
}

#[test]
fn inline_entries_are_recognised_with_their_name_and_added_date() {
    let asset = json!({"name": "Front", "src": JPEG, "type": "image/png", "added": "2026-01-02"});
    let Entry::Inline(inline) = classify(&asset) else {
        panic!("an inline photo is recognised");
    };
    assert_eq!(inline.name, "Front");
    assert_eq!(inline.encoded, "/9j/4AAQ");
    assert_eq!(inline.added, Some("2026-01-02"));
    let bare = json!({"name": "Plan", "src": "data:application/pdf;base64,JVBERi0="});
    assert!(matches!(
        classify(&bare),
        Entry::Inline(Inline { added: None, .. })
    ));
}

#[test]
fn labelled_or_unusual_inline_entries_stay_with_a_reason() {
    let demo = json!({"name": "Demo villa exterior.jpg", "src": JPEG, "type": "image/jpeg",
        "demo": true, "source": "generated-demo"});
    assert_eq!(
        reason(demo),
        Some(Reason::OtherFields),
        "demo labels stay visible"
    );
    let long_added = json!({"name": "a", "src": JPEG, "added": "x".repeat(41)});
    assert_eq!(reason(long_added), Some(Reason::OtherFields));
    assert_eq!(
        reason(json!({"name": "a", "src": JPEG, "added": 7})),
        Some(Reason::OtherFields)
    );
    for src in [
        json!("/demo/villa-exterior.jpg"),
        json!("https://images.example.test/a.jpg"),
        json!("data:image/jpeg,raw"),
        json!(42),
    ] {
        assert_eq!(
            reason(json!({"name": "a", "src": src})),
            Some(Reason::Unsupported)
        );
    }
    assert_eq!(
        reason(json!({"src": JPEG})),
        Some(Reason::Unsupported),
        "no name"
    );
}

#[test]
fn base64_with_line_breaks_or_without_padding_decodes() {
    assert_eq!(decode("SGVs\nbG8g\r\nd29y bGQ=").unwrap(), b"Hello world");
    assert_eq!(decode("SGVsbG8").unwrap(), b"Hello");
    assert_eq!(decode("SGV*bG8="), Err(Reason::Unreadable));
    assert_eq!(decode(&"A".repeat(MAX_ENCODED + 4)), Err(Reason::TooLarge));
}

#[test]
fn the_stored_entry_has_the_f2_shape_and_passes_records_validation() {
    let file = Uuid::new_v4();
    let photo = stored_entry("Front.jpg", file, "image/jpeg", Some("2026-01-02"));
    assert_eq!(
        photo,
        json!({"name": "Front.jpg", "file": file, "type": "image/jpeg", "added": "2026-01-02"})
    );
    let plan = stored_entry("Plan.pdf", file, "application/pdf", None);
    assert_eq!(
        plan,
        json!({"name": "Plan.pdf", "file": file, "type": "application/pdf"})
    );
    validate(&json!({"media_photos": [photo], "media_floorplans": [plan]})).unwrap();
}
