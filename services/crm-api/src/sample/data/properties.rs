//! Sample listings for sale, rent and holiday stays in real UAE communities. Each
//! links to a sample landlord or owner in the same building or portfolio.
use super::{merge, name, places, Calendar, NOTE};
use serde_json::{json, Value};

/// Shared listing defaults, the location of its `building_project`, a labelled title
/// and the listing's own fields.
fn listing(calendar: &Calendar, fields: Value) -> Value {
    let building = fields["building_project"].as_str().unwrap_or_default();
    let location = places::find(building).map(places::Place::fields);
    let title = name(fields["listing_title"].as_str().unwrap_or_default());
    let base = merge(
        json!({
            "property_type": "Apartment",
            "ready_off_plan": "Ready",
            "listing_status": "Available",
            "listing_authorization": "Verified",
            "last_verified": calendar.day(-3),
            "price_basis": "Total price",
            "bathrooms": 2,
            "parking_spaces": 1,
            "notes": NOTE,
        }),
        location.unwrap_or_else(|| json!({})),
    );
    let mut row = merge(base, fields);
    row["listing_title"] = json!(title);
    row
}

pub fn rows(calendar: &Calendar) -> Vec<Value> {
    let rows = [
        json!({"property_id": "PR-S01", "building_project": "Marina Gate 1",
            "listing_title": "Marina Gate 1 · Marina view 2BR", "contact_id": "CT-S01",
            "sale_rental": "Sale", "unit_reference": "2304", "bedrooms": 2, "area_sq_ft": 1_350,
            "price_annual_rent_aed": 2_450_000, "parking_spaces": 2,
            "amenities": "Pool, gym, concierge", "key_selling_points": "Full marina view"}),
        json!({"property_id": "PR-S02", "building_project": "Princess Tower",
            "listing_title": "Princess Tower · Furnished 1BR", "contact_id": "CT-S01",
            "sale_rental": "Rental", "unit_reference": "4108", "bedrooms": 1, "bathrooms": 1,
            "area_sq_ft": 820, "price_annual_rent_aed": 95_000, "price_basis": "Annual",
            "furnishing": "Furnished", "rental_cheques": 4, "deposit_aed": 4_750,
            "available_from": calendar.day(10)}),
        json!({"property_id": "PR-S03", "building_project": "Bloom Towers",
            "listing_title": "Bloom Towers · Studio", "contact_id": "CT-S02",
            "sale_rental": "Rental", "unit_reference": "B-1207", "property_type": "Studio",
            "bedrooms": 0, "bathrooms": 1, "area_sq_ft": 430, "price_annual_rent_aed": 48_000,
            "price_basis": "Annual", "furnishing": "Unfurnished", "rental_cheques": 2,
            "viewing_instructions": "Collect keys from the building manager"}),
        json!({"property_id": "PR-S04", "building_project": "Belgravia Heights 1",
            "listing_title": "Belgravia Heights · 1BR with terrace", "contact_id": "CT-S02",
            "sale_rental": "Sale", "unit_reference": "609", "bedrooms": 1, "bathrooms": 1,
            "area_sq_ft": 780, "price_annual_rent_aed": 850_000, "listing_status": "Under offer"}),
        json!({"property_id": "PR-S05", "building_project": "Burj Royale",
            "listing_title": "Burj Royale · Burj view 2BR", "contact_id": "CT-S03",
            "sale_rental": "Sale", "unit_reference": "3501", "bedrooms": 2, "area_sq_ft": 1_180,
            "price_annual_rent_aed": 3_200_000, "key_selling_points": "Burj Khalifa view"}),
        json!({"property_id": "PR-S06", "building_project": "Boulevard Point",
            "listing_title": "Boulevard Point · Holiday 1BR", "contact_id": "CT-S03",
            "sale_rental": "Holiday home", "unit_reference": "1902",
            "property_type": "Serviced apartment", "bedrooms": 1, "bathrooms": 1,
            "area_sq_ft": 870, "price_annual_rent_aed": 850, "price_basis": "Nightly",
            "minimum_stay_nights": 2, "maximum_guests": 3, "furnishing": "Furnished"}),
        json!({"property_id": "PR-S07", "building_project": "Executive Towers",
            "listing_title": "Executive Towers · Canal 2BR", "contact_id": "CT-S04",
            "sale_rental": "Rental", "unit_reference": "J-2210", "bedrooms": 2,
            "area_sq_ft": 1_250, "price_annual_rent_aed": 140_000, "price_basis": "Annual",
            "listing_status": "Rented", "furnishing": "Part-furnished", "rental_cheques": 2}),
        json!({"property_id": "PR-S08", "building_project": "Bay Square",
            "listing_title": "Bay Square · Fitted office", "contact_id": "CT-S04",
            "sale_rental": "Rental", "unit_reference": "Building 7, Office 304",
            "property_type": "Office", "bedrooms": 0, "bathrooms": 1, "area_sq_ft": 1_450,
            "price_annual_rent_aed": 180_000, "price_basis": "Annual", "rental_cheques": 4}),
        json!({"property_id": "PR-S09", "building_project": "Sun Tower",
            "listing_title": "Sun Tower · Sea view 2BR", "contact_id": "CT-S05",
            "sale_rental": "Sale", "unit_reference": "2802", "bedrooms": 2, "area_sq_ft": 1_290,
            "price_annual_rent_aed": 1_650_000}),
        json!({"property_id": "PR-S10", "building_project": "The Gate Tower 2",
            "listing_title": "The Gate Tower 2 · 3BR family home", "contact_id": "CT-S05",
            "sale_rental": "Rental", "unit_reference": "1605", "bedrooms": 3, "bathrooms": 3,
            "area_sq_ft": 1_760, "price_annual_rent_aed": 160_000, "price_basis": "Annual",
            "furnishing": "Unfurnished", "rental_cheques": 4}),
        json!({"property_id": "PR-S11", "building_project": "Park Ridge",
            "listing_title": "Park Ridge · Off-plan 2BR", "contact_id": "CT-S03",
            "sale_rental": "Sale", "unit_reference": "Tower C, 1104", "bedrooms": 2,
            "ready_off_plan": "Off-plan", "area_sq_ft": 1_050, "price_annual_rent_aed": 2_100_000}),
        json!({"property_id": "PR-S12", "building_project": "Shoreline Apartments",
            "listing_title": "Shoreline · Beach access 3BR", "contact_id": "CT-S01",
            "sale_rental": "Sale", "unit_reference": "Al Habool 502", "bedrooms": 3,
            "bathrooms": 3, "area_sq_ft": 1_950, "price_annual_rent_aed": 4_800_000,
            "listing_status": "Sold"}),
    ];
    rows.into_iter()
        .map(|fields| listing(calendar, fields))
        .collect()
}
