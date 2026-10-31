//! Request validation (packet MK2): fixed choices, a budget that adds up, rent-only cheques, a
//! real move-in month, and communities that carry no contact. Values arrive as JSON, as they do
//! over the wire, so the deserialiser is part of what is tested.
use crate::marketplace::request::{validate, Input};
use serde_json::{from_value, json};

fn input(overrides: serde_json::Value) -> Input {
    let mut base = json!({
        "purpose": "rent", "emirate": "dubai", "communities": ["Dubai Marina", "JVC"],
        "openToOtherAreas": true, "propertyType": "Apartment", "bedrooms": 2,
        "budgetMinAed": 90000, "budgetMaxAed": 120000, "ready": "ready",
        "furnishing": "furnished", "cheques": 6, "buildingAge": "under_5",
        "moveIn": "2026-11",
    });
    for (key, value) in overrides.as_object().unwrap() {
        base[key] = value.clone();
    }
    from_value(base).unwrap()
}

#[test]
fn a_rental_is_stored_with_its_band_and_normalised_communities() {
    let valid = validate(input(
        json!({ "communities": ["  Dubai   Marina ", "JVC"] }),
    ))
    .unwrap();
    assert_eq!(valid.band, "rent_150k");
    assert_eq!(valid.cheques, Some(6));
    assert_eq!(valid.budget_min_aed, Some(90_000));
    assert_eq!(valid.move_in.as_deref(), Some("2026-11"));
    let names: Vec<&str> = valid
        .communities
        .iter()
        .map(|one| one.name.as_str())
        .collect();
    assert_eq!(names, ["Dubai Marina", "JVC"]);
    assert_eq!(valid.communities[0].key, "dubai marina");
    assert!(valid.open_to_other_areas);
}

#[test]
fn a_purchase_has_no_cheques_and_an_unknown_choice_is_refused() {
    let purchase = validate(input(json!({
        "purpose": "buy", "cheques": null, "budgetMaxAed": 2500000,
    })))
    .unwrap();
    assert_eq!(purchase.band, "buy_3m");
    assert_eq!(purchase.cheques, None);
    for overrides in [
        json!({ "purpose": "buy", "cheques": 4 }),
        json!({ "purpose": "swap" }),
        json!({ "emirate": "riyadh" }),
        json!({ "propertyType": "Castle" }),
        json!({ "ready": "later" }),
        json!({ "furnishing": "bare" }),
        json!({ "buildingAge": "ancient" }),
        json!({ "cheques": 5 }),
    ] {
        assert!(validate(input(overrides.clone())).is_err(), "{overrides}");
    }
}

#[test]
fn the_budget_must_make_sense() {
    for overrides in [
        json!({ "budgetMaxAed": 0 }),
        json!({ "budgetMinAed": -1 }),
        json!({ "budgetMinAed": 130000 }),
        json!({ "bedrooms": 21 }),
        json!({ "bedrooms": -1 }),
    ] {
        let error = validate(input(overrides.clone())).unwrap_err();
        assert_eq!(
            (error.0.as_u16(), error.2),
            (400, "invalid_request"),
            "{overrides}"
        );
    }
    let no_minimum = validate(input(json!({ "budgetMinAed": null }))).unwrap();
    assert_eq!(no_minimum.budget_min_aed, None);
    let studio = validate(input(json!({ "bedrooms": 0 }))).unwrap();
    assert_eq!(studio.bedrooms, Some(0));
}

#[test]
fn the_move_in_is_a_real_month() {
    assert!(validate(input(json!({ "moveIn": null })))
        .unwrap()
        .move_in
        .is_none());
    for value in [
        "2026-13", "2026-00", "1999-05", "2026-1", "26-11", "2026/11", "",
    ] {
        assert!(
            validate(input(json!({ "moveIn": value }))).is_err(),
            "{value}"
        );
    }
}

#[test]
fn communities_may_not_carry_contact_or_repeat() {
    for overrides in [
        json!({ "communities": ["Dubai Marina", "dubai marina"] }),
        json!({ "communities": ["Marina 050 123 4567"] }),
        json!({ "communities": ["Dubai Hills", "www simoni ae"] }),
        json!({ "communities": ["Villa 12. Dubai"] }),
        json!({ "communities": (1..=13).map(|i| format!("Area {i}")).collect::<Vec<_>>() }),
    ] {
        assert!(validate(input(overrides.clone())).is_err(), "{overrides}");
    }
    assert!(validate(input(json!({ "communities": [] }))).is_ok());
}
