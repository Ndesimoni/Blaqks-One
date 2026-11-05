use super::*;
use serde_json::json;
#[test]
fn physical_identity_is_normalized_and_never_contains_private_values() {
    let a = physical_key("Dubai", "Dubai Marina", "Tower A", "Unit-21").unwrap();
    assert_eq!(
        a,
        physical_key(" dubai ", "Dubai-Marina", "Tower-A", "UNIT 21").unwrap()
    );
    assert_ne!(
        a,
        physical_key("Dubai", "Dubai Hills", "Tower A", "Unit-21").unwrap()
    );
    assert_eq!(a.len(), 64);
    assert!(!a.contains("Tower"));
    assert!(physical_key("Dubai", "Dubai Marina", "Tower A", "").is_err());
}
#[test]
fn closed_status_is_case_insensitive() {
    assert!(closed(&json!({"listing_status":" Sold "})));
    assert!(!closed(&json!({"listing_status":" UNDER OFFER "})));
    assert!(closed(&json!({"listing_status":"Inactive"})));
    assert!(closed(
        &json!({"listing_status":"Available","permit_expiry":"2000-01-01"})
    ));
    assert!(closed(
        &json!({"listing_status":"Available","permit_expiry":"invalid"})
    ));
    assert!(!closed(
        &json!({"listing_status":"Available","permit_expiry":"9999-12-31"})
    ));
}

#[test]
fn publication_options_preserve_workbook_values_and_price_units() {
    use super::super::publication_source_options as options;
    assert_eq!(
        options::amenities(&json!({"amenities":"Swimming pool, Gym; pool|Private garden"})),
        vec!["pool", "gym", "garden"]
    );
    assert_eq!(
        options::count(&json!({"bedrooms":"Studio"}), "bedrooms", true).unwrap(),
        0.0
    );
    assert!(options::count(&json!({"bedrooms":1.5}), "bedrooms", true).is_err());
    assert!(options::price_basis(&json!({"price_basis":"Annual"}), "rent").is_ok());
    assert!(options::price_basis(&json!({"price_basis":"Monthly"}), "rent").is_err());
    assert!(options::price_basis(&json!({}), "holiday").is_err());
}
