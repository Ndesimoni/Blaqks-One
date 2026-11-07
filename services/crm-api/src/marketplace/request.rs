//! A client request's fields (docs/broker-marketplace.md §3, packet MK2): fixed choices only,
//! an emirate slug, up to twelve community names under the MK1 free-text rules, a budget that
//! makes sense and the rental-only preferences. Every value is validated here, before SQL sees
//! it, and the band is computed here rather than trusted from the client.
use super::{
    bands,
    profile::{Community, EMIRATES},
    request_rules,
};
use crate::error::{ApiError, ApiResult};
use serde::Deserialize;

pub const INVALID: &str = "Provide valid client request details.";
pub const COMMUNITY: &str = "Community names use English letters, digits, spaces and ' - & only.";
pub const CONTACT: &str = "Remove phone numbers, email addresses and links.";
pub const CHEQUES: &str = "A cheque count belongs to a rental only.";
pub const BUDGET: &str = "Check the budget: the minimum cannot be above the maximum.";
pub const MOVE_IN: &str = "Choose a move-in month as YYYY-MM.";

pub const PURPOSES: [&str; 2] = ["buy", "rent"];
pub const READY: [&str; 3] = ["ready", "off_plan", "any"];
pub const FURNISHING: [&str; 4] = ["furnished", "unfurnished", "part_furnished", "any"];
pub const AGES: [&str; 5] = ["new", "under_5", "5_to_10", "over_10", "any"];
pub const CHEQUE_COUNTS: [i16; 6] = [1, 2, 3, 4, 6, 12];
/// The Property type options, stored as their label (src/config/fields/stageAndListingOptions.js).
pub const PROPERTY_TYPES: [&str; 20] = [
    "Apartment",
    "Studio",
    "Villa",
    "Townhouse",
    "Penthouse",
    "Duplex",
    "Loft",
    "Serviced apartment",
    "Hotel apartment",
    "Office",
    "Retail",
    "Shop",
    "Showroom",
    "Warehouse",
    "Industrial",
    "Commercial building",
    "Residential building",
    "Plot",
    "Land",
    "Other",
];

/// What the poster sends, once: posting and editing share it.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    pub purpose: String,
    pub emirate: String,
    #[serde(default)]
    pub communities: Vec<String>,
    #[serde(default)]
    pub open_to_other_areas: bool,
    pub property_type: String,
    #[serde(default)]
    pub bedrooms: Option<i16>,
    #[serde(default)]
    pub budget_min_aed: Option<i64>,
    pub budget_max_aed: i64,
    pub ready: String,
    pub furnishing: String,
    #[serde(default)]
    pub cheques: Option<i16>,
    pub building_age: String,
    #[serde(default)]
    pub move_in: Option<String>,
}

/// The request as the database stores it.
#[derive(Clone, Debug)]
pub struct Valid {
    pub purpose: String,
    pub emirate: String,
    pub communities: Vec<Community>,
    pub open_to_other_areas: bool,
    pub property_type: String,
    pub bedrooms: Option<i16>,
    pub budget_min_aed: Option<i64>,
    pub budget_max_aed: i64,
    pub band: String,
    pub ready: String,
    pub furnishing: String,
    pub cheques: Option<i16>,
    pub building_age: String,
    pub move_in: Option<String>,
}

pub fn validate(input: Input) -> ApiResult<Valid> {
    let purpose = request_rules::listed(&input.purpose, &PURPOSES)?;
    let emirate = request_rules::listed(&input.emirate, &EMIRATES)?;
    let property_type = request_rules::listed(&input.property_type, &PROPERTY_TYPES)?;
    let ready = request_rules::listed(&input.ready, &READY)?;
    let furnishing = request_rules::listed(&input.furnishing, &FURNISHING)?;
    let building_age = request_rules::listed(&input.building_age, &AGES)?;
    if input.budget_max_aed <= 0 || input.budget_min_aed.is_some_and(|least| least < 0) {
        return Err(ApiError::invalid(BUDGET));
    }
    if input
        .budget_min_aed
        .is_some_and(|least| least > input.budget_max_aed)
    {
        return Err(ApiError::invalid(BUDGET));
    }
    if input
        .bedrooms
        .is_some_and(|count| !(0..=20).contains(&count))
    {
        return Err(ApiError::invalid(INVALID));
    }
    let cheques = match (purpose.as_str(), input.cheques) {
        ("rent", Some(count)) if CHEQUE_COUNTS.contains(&count) => Some(count),
        ("rent", None) => None,
        ("rent", Some(_)) => return Err(ApiError::invalid(INVALID)),
        (_, None) => None,
        (_, Some(_)) => return Err(ApiError::invalid(CHEQUES)),
    };
    let move_in = input
        .move_in
        .as_deref()
        .map(request_rules::move_in)
        .transpose()?;
    Ok(Valid {
        band: bands::band(&purpose, input.budget_max_aed).to_owned(),
        purpose,
        emirate,
        communities: request_rules::communities(&input.communities)?,
        open_to_other_areas: input.open_to_other_areas,
        property_type,
        bedrooms: input.bedrooms,
        budget_min_aed: input.budget_min_aed,
        budget_max_aed: input.budget_max_aed,
        ready,
        furnishing,
        cheques,
        building_age,
        move_in,
    })
}
