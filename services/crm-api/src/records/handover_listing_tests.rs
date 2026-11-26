//! The review's listing allowlist (agreements design §18, amendment 8).
use super::*;
use serde_json::json;

#[test]
fn the_review_never_names_the_owner_or_private_fields() {
    let hidden = [
        "contact_id",
        "notes",
        "viewing_instructions",
        "photos_documents_url",
    ];
    let more = [
        "permit_reference",
        "listing_authorization",
        "record_check",
        "property_id",
    ];
    for field in hidden.iter().chain(more.iter()) {
        assert!(FIELDS.iter().all(|(stored, _)| stored != field), "{field}");
    }
    let file = Uuid::new_v4();
    let payload = json!({"media_photos": [{"name": "a.jpg", "file": file}, {"src": "x"}]});
    let listing = Listing {
        record: Uuid::new_v4(),
        holder: None,
        payload,
    };
    assert_eq!(
        listing.media("media_photos"),
        vec![("a.jpg".into(), file, None)]
    );
}

#[test]
fn a_shared_listing_keeps_only_the_allowlist_and_basic_facts_hide_the_rest() {
    let payload = json!({"property_id": "PR-001", "listing_title": "Villa", "notes": "Zqx",
        "viewing_instructions": "gate 4411", "contact_id": "CT-001", "unit_reference": "U9",
        "media_photos": [], "permit_reference": "P-1"});
    assert_eq!(
        shared(&payload),
        json!({"property_id": "PR-001", "listing_title": "Villa", "unit_reference": "U9",
            "media_photos": []})
    );
    let listing = Listing {
        record: Uuid::new_v4(),
        holder: None,
        payload,
    };
    let facts = |full| -> Vec<(&str, Option<&str>)> {
        let wanted = ["listingTitle", "unitReference"];
        let all = listing.facts(full);
        all.filter(|(name, _)| wanted.contains(name)).collect()
    };
    let basic = vec![("listingTitle", Some("Villa")), ("unitReference", None)];
    assert_eq!(facts(false), basic);
    let full = vec![
        ("listingTitle", Some("Villa")),
        ("unitReference", Some("U9")),
    ];
    assert_eq!(facts(true), full);
}
