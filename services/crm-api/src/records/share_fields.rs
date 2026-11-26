//! What a colleague's view-only copy carries (docs/record-sharing.md R1, amendment 4 and
//! the owner's answer: no notes). Properties carry exactly the shared-listing allowlist;
//! clients everything a colleague needs to read except notes, links to other records,
//! checks and the screen-computed fields; contacts their name, type, company, phone, email
//! and location. Media entries of a property travel with it.
use super::listing_fields;
use serde_json::{Map, Value};

/// Client fields a copy carries; every other workbook field is withheld (see the test).
pub const CLIENT_SHARED: [&str; 37] = [
    "client_id",
    "full_name",
    "phone",
    "email",
    "preferred_language",
    "client_type",
    "lead_source",
    "lead_stage",
    "buy_rent",
    "emirate",
    "preferred_communities",
    "property_type",
    "bedrooms",
    "minimum_budget_aed",
    "maximum_budget_aed",
    "payment_method",
    "target_date",
    "date_added",
    "priority",
    "lost_reason",
    "campaign_reference",
    "purchase_rental_purpose",
    "finance_type",
    "mortgage_stage",
    "funds_confirmed",
    "decision_maker",
    "buying_moving_urgency",
    "must_have_criteria",
    "primary_objection",
    "preferred_channel",
    "contact_permission",
    "lead_quality_score_100",
    "last_qualified_on",
    "relationship_status",
    "re_engage_date",
    "lost_on",
    "recontact_possible",
];

/// Client fields a copy never carries.
pub const CLIENT_WITHHELD: [&str; 8] = [
    "notes",
    "referred_by_client_id",
    "record_check",
    "duplicate_contact",
    "last_contact_auto",
    "next_follow_up_auto",
    "follow_up_status_auto",
    "lead_tier_auto",
];

/// Contact fields a copy carries.
pub const CONTACT_SHARED: [&str; 11] = [
    "contact_id",
    "full_name",
    "contact_type",
    "company",
    "phone",
    "email",
    "building_project",
    "community",
    "emirate",
    "address",
    "map_link",
];

fn only(fields: &Map<String, Value>, keys: &[&str]) -> Value {
    let kept = fields
        .iter()
        .filter(|(key, _)| keys.contains(&key.as_str()));
    Value::Object(
        kept.map(|(key, value)| (key.clone(), value.clone()))
            .collect(),
    )
}

/// The copy of `payload` a colleague reads.
pub fn copy(collection: &str, payload: &Value) -> Value {
    let Value::Object(fields) = payload else {
        return Value::Object(Map::new());
    };
    match collection {
        "Properties" => listing_fields::shared(payload),
        "Clients" => only(fields, &CLIENT_SHARED),
        "Contacts" => only(fields, &CONTACT_SHARED),
        _ => Value::Object(Map::new()),
    }
}

#[cfg(test)]
#[path = "share_fields_tests.rs"]
mod tests;
