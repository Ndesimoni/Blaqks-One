use super::{matching::checklist, profile::Community, requests::Row};
use serde_json::json;
use sqlx::types::Json;
use uuid::Uuid;

fn request() -> Row {
    Row {
        id: Uuid::nil(),
        workspace_id: "a".into(),
        member_id: Uuid::nil(),
        purpose: "rent".into(),
        emirate: "dubai".into(),
        communities: Json(vec![Community {
            name: "Dubai Marina".into(),
            key: "dubai marina".into(),
        }]),
        open_to_other_areas: false,
        property_type: "Apartment".into(),
        bedrooms: Some(2),
        budget_min_aed: Some(90000),
        budget_max_aed: 120000,
        budget_band: "rent_150k".into(),
        ready: "ready".into(),
        furnishing: "furnished".into(),
        cheques: Some(6),
        building_age: "under_5".into(),
        move_in: Some("2026-11".into()),
        version: 1,
        created_at: "".into(),
        cursor_at: "".into(),
        expires_at: "".into(),
        closed_at: None,
        close_reason: None,
        expired: false,
        renewable: true,
        paused_at: None,
    }
}
fn facts() -> serde_json::Map<String, serde_json::Value> {
    json!({"saleRental":"Rental","emirate":"Dubai","community":"Dubai Marina",
        "propertyType":"Apartment","bedrooms":"2","priceAed":"120000","listingStatus":"Available"})
    .as_object()
    .unwrap()
    .clone()
}
#[test]
fn rejects_missing_or_mismatched_required_facts() {
    for field in [
        "saleRental",
        "emirate",
        "propertyType",
        "bedrooms",
        "priceAed",
        "listingStatus",
        "community",
    ] {
        let mut value = facts();
        value.remove(field);
        assert_eq!(checklist(&request(), &value)["matches"], false, "{field}");
    }
}
#[test]
fn ten_percent_budget_boundary_and_unknown_preferences_are_explicit() {
    let mut value = facts();
    value.insert("priceAed".into(), json!("132000"));
    let result = checklist(&request(), &value);
    assert_eq!(result["matches"], true);
    assert_eq!(result["overBudget"], true);
    assert!(result["preferences"]["buildingAge"].is_null());
    value.insert("priceAed".into(), json!("132001"));
    assert_eq!(checklist(&request(), &value)["matches"], false);
    value.insert("priceAed".into(), json!("89999"));
    assert_eq!(checklist(&request(), &value)["matches"], false);
}
#[test]
fn optional_preferences_never_block_required_matches() {
    let mut value = facts();
    value.insert("furnishing".into(), json!("Unfurnished"));
    let result = checklist(&request(), &value);
    assert_eq!(result["matches"], true);
    assert_eq!(result["preferences"]["furnishing"], false);
    value.insert("rentalCheques".into(), json!(2));
    assert_eq!(
        checklist(&request(), &value)["preferences"]["cheques"],
        false
    );
    value.insert("rentalCheques".into(), json!(12));
    assert_eq!(
        checklist(&request(), &value)["preferences"]["cheques"],
        true
    );
}
