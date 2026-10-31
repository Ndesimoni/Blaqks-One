//! Every workbook field is either shared or withheld on purpose (R1 amendment 4), so a new
//! column fails here until someone decides.
use super::*;
use crate::records::validation::workbook_fields::{CLIENT_FIELDS, CONTACT_FIELDS, PROPERTY_FIELDS};
use serde_json::json;

const PROPERTY_WITHHELD: [&str; 11] = [
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

fn sorted(fields: &[&str], shared: &[&str], withheld: &[&str]) {
    for field in fields {
        let (yes, no) = (shared.contains(field), withheld.contains(field));
        assert!(yes != no, "{field} must be either shared or withheld");
    }
    for field in shared.iter().chain(withheld) {
        assert!(fields.contains(field), "{field} is not a workbook field");
    }
}

#[test]
fn every_workbook_field_is_sorted() {
    sorted(CLIENT_FIELDS, &CLIENT_SHARED, &CLIENT_WITHHELD);
    let withheld: Vec<&str> = CONTACT_FIELDS
        .iter()
        .copied()
        .filter(|field| !CONTACT_SHARED.contains(field))
        .collect();
    assert_eq!(withheld, ["notes", "record_check"]);
    // A listing copy carries the review's allowlist plus its own ID.
    let mut listing: Vec<&str> = listing_fields::FIELDS
        .iter()
        .map(|(stored, _)| *stored)
        .collect();
    listing.push("property_id");
    sorted(PROPERTY_FIELDS, &listing, &PROPERTY_WITHHELD);
}

#[test]
fn copies_keep_only_their_fields() {
    let client = json!({"client_id": "CL-1", "phone": "+9715", "notes": "Zqx", "x": 1});
    assert_eq!(
        copy("Clients", &client),
        json!({"client_id": "CL-1", "phone": "+9715"})
    );
    let contact = json!({"contact_id": "CT-1", "email": "a@b.test", "record_check": "ok"});
    assert_eq!(
        copy("Contacts", &contact),
        json!({"contact_id": "CT-1", "email": "a@b.test"})
    );
    let property = json!({"property_id": "PR-1", "contact_id": "CT-1", "notes": "Zqx"});
    assert_eq!(
        copy("Properties", &property),
        json!({"property_id": "PR-1"})
    );
    assert_eq!(copy("Deals", &client), json!({}));
}
