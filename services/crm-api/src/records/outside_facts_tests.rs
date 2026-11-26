//! Every Properties workbook field is sent, location or never sent (R2), so a new column
//! fails here until someone decides.
use super::*;
use crate::records::validation::workbook_fields::PROPERTY_FIELDS;
use serde_json::json;

const NEVER: [&str; 12] = [
    "property_id",
    "contact_id",
    "notes",
    "viewing_instructions",
    "photos_documents_url",
    "permit_reference",
    "permit_expiry",
    "listing_authorization",
    "record_check",
    "last_verified",
    "availability_review",
    "permit_date_alert",
];

#[test]
fn every_property_field_is_sorted() {
    for field in PROPERTY_FIELDS {
        let sent = FIELDS.iter().any(|(stored, _)| stored == field);
        let never = NEVER.contains(field);
        assert!(sent != never, "{field} must be sent or never sent");
    }
    for field in LOCATION {
        assert!(FIELDS.iter().any(|(stored, _)| *stored == field), "{field}");
    }
    for field in NEVER {
        assert!(
            PROPERTY_FIELDS.contains(&field),
            "{field} is not a workbook field"
        );
    }
}

#[test]
fn the_location_is_kept_apart_and_private_fields_never_appear() {
    let file = Uuid::new_v4();
    let payload = json!({
        "property_id": "PR-001", "listing_title": " Marina view ", "contact_id": "CT-001",
        "notes": "owner 0501234567", "unit_reference": "U-9", "address": "", "map_link": "x",
        "viewing_instructions": "gate", "permit_reference": "P-1", "bedrooms": "2",
        "media_photos": [{"name": "a.jpg", "file": file}, {"name": "old", "src": "data:x"}],
    });
    let outside = read(&payload);
    assert_eq!(
        Value::Object(outside.facts.clone()),
        json!({"listingTitle": "Marina view", "bedrooms": "2"})
    );
    assert_eq!(
        Value::Object(outside.location.clone()),
        json!({"unitReference": "U-9", "mapLink": "x"})
    );
    assert_eq!(outside.photos, vec![Asset { file, thumb: None }]);
    assert_eq!((outside.inline, outside.over), (1, 0));
}

#[test]
fn snapshots_carry_at_most_forty_photos() {
    let photos: Vec<Value> = (0..45)
        .map(|_| json!({"name": "p", "file": Uuid::new_v4()}))
        .collect();
    let outside = read(&json!({ "media_photos": photos }));
    assert_eq!((outside.photos.len(), outside.over), (MAX_PHOTOS, 5));
}
