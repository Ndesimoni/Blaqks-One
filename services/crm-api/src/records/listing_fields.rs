//! The listing fields a hand-over may show (agreements design §17–§18): the allowlist for
//! the review, the twelve basic facts H2 showed, and the shape of a listing shared read-only
//! with a receiver. Never the owner contact, notes, viewing instructions, the documents
//! link, permits, authorisation, checks or record IDs other than the listing's own.
use serde_json::Value;

/// Stored field → the name the review uses.
pub const FIELDS: [(&str, &str); 29] = [
    ("listing_title", "listingTitle"),
    ("sale_rental", "saleRental"),
    ("emirate", "emirate"),
    ("community", "community"),
    ("building_project", "building"),
    ("unit_reference", "unitReference"),
    ("property_type", "propertyType"),
    ("bedrooms", "bedrooms"),
    ("bathrooms", "bathrooms"),
    ("area_sq_ft", "sizeSqft"),
    ("price_annual_rent_aed", "priceAed"),
    ("price_basis", "priceBasis"),
    ("listing_status", "listingStatus"),
    ("ready_off_plan", "readyOffPlan"),
    ("furnishing", "furnishing"),
    ("available_from", "availableFrom"),
    ("rental_cheques", "rentalCheques"),
    ("deposit_aed", "depositAed"),
    ("minimum_stay_nights", "minimumStayNights"),
    ("maximum_guests", "maximumGuests"),
    ("parking_spaces", "parkingSpaces"),
    ("amenities", "amenities"),
    ("property_description", "description"),
    ("key_selling_points", "keySellingPoints"),
    ("address", "address"),
    ("map_link", "mapLink"),
    ("listing_url", "listingUrl"),
    ("virtual_tour_url", "virtualTourUrl"),
    ("floor_plan_url", "floorPlanUrl"),
];

/// The twelve facts H2 showed; the rest of the listing shows only when the sender holds it.
pub const BASIC: [&str; 12] = [
    "listing_title",
    "sale_rental",
    "emirate",
    "community",
    "building_project",
    "property_type",
    "bedrooms",
    "bathrooms",
    "area_sq_ft",
    "price_annual_rent_aed",
    "ready_off_plan",
    "furnishing",
];

/// A listing shared read-only with a receiver who never held it (review M1): the
/// allowlisted fields, its photos and floor plans and its ID, nothing else it stores.
pub fn shared(payload: &Value) -> Value {
    let keep = FIELDS.iter().map(|(stored, _)| *stored);
    let keep = keep.chain(["property_id", "media_photos", "media_floorplans"]);
    let kept = keep.filter_map(|key| Some((key.to_owned(), payload.get(key)?.clone())));
    Value::Object(kept.collect())
}
