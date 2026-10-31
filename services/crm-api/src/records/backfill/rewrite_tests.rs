use super::*;
use crate::records::backfill::plan::{plan, PLANS};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::json;

/// A tiny synthetic JPEG: JFIF header, one scan, end marker.
const JPEG: &[u8] = &[
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x07, b'J', b'F', b'I', b'F', 0, 0xFF, 0xDA, 0x00, 0x02, 0x11,
    0x22, 0xFF, 0xD9,
];

fn inline(name: &str) -> Value {
    let src = format!("data:image/jpeg;base64,{}", STANDARD.encode(JPEG));
    json!({ "name": name, "src": src })
}

fn record(photos: Value, plans: Option<Value>) -> Current {
    Current {
        id: Uuid::new_v4(),
        version: 3,
        photos: Some(photos),
        plans,
    }
}

fn rewritten(record: &Current) -> Option<Rewrite> {
    let mut headroom = i64::MAX;
    rewrite(record, &plan(&record.fields(), &mut headroom))
}

#[test]
fn only_changed_fields_are_rewritten_with_the_chosen_ids() {
    let stored = json!({"name": "kept.jpg", "file": "11111111-1111-4111-8111-111111111111"});
    let current = record(json!([stored, inline("Front")]), Some(json!([])));
    let done = rewritten(&current).expect("a valid rewrite");
    assert_eq!(done.ids.len(), 1);
    let photos = done.fields[PHOTOS].as_array().unwrap();
    assert_eq!(photos[0], stored, "the stored photo is untouched");
    assert_eq!(photos[1]["file"], json!(done.ids[0]));
    assert!(
        done.fields.get(PLANS).is_none(),
        "unchanged fields are not rewritten"
    );
}

#[test]
fn a_record_that_would_fail_validation_is_left_alone() {
    let many: Vec<Value> = (0..21).map(|n| inline(&format!("p{n}"))).collect();
    assert!(
        rewritten(&record(json!(many), None)).is_none(),
        "over 20 entries"
    );
    let foreign = json!({"name": "linked", "src": "/demo/villa-exterior.jpg"});
    let current = record(json!([inline("Front"), foreign]), None);
    assert!(
        rewritten(&current).is_none(),
        "a non-data-URL entry fails validation"
    );
}
