//! Every Clients workbook field is repeated on a request or never sent (packet MK2), so a new
//! column fails here until someone decides. The rest of the file checks the forms a stored
//! client value can take.
use super::*;
use crate::records::validation::workbook_fields::CLIENT_FIELDS;
use serde_json::json;

const USED: [&str; 8] = [
    "buy_rent",
    "emirate",
    "preferred_communities",
    "property_type",
    "bedrooms",
    "minimum_budget_aed",
    "maximum_budget_aed",
    "target_date",
];

const NEVER: [&str; 37] = [
    "client_id",
    "full_name",
    "phone",
    "email",
    "preferred_language",
    "client_type",
    "lead_source",
    "lead_stage",
    "payment_method",
    "date_added",
    "notes",
    "duplicate_contact",
    "last_contact_auto",
    "next_follow_up_auto",
    "follow_up_status_auto",
    "priority",
    "lost_reason",
    "campaign_reference",
    "record_check",
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
    "lead_tier_auto",
    "last_qualified_on",
    "relationship_status",
    "referred_by_client_id",
    "re_engage_date",
    "lost_on",
    "recontact_possible",
];

#[test]
fn every_client_field_is_repeated_or_never_sent() {
    for field in CLIENT_FIELDS {
        let used = USED.contains(field);
        let never = NEVER.contains(field);
        assert!(used != never, "{field} must be repeated or never sent");
    }
    for field in USED {
        assert!(
            CLIENT_FIELDS.contains(&field),
            "{field} is not a workbook field"
        );
    }
}

#[test]
fn the_allowlist_reads_the_eight_fields_and_nothing_else() {
    let read = from_payload(&json!({
        "client_id": "CL-001", "full_name": "Layla Haddad", "phone": "050 123 4567",
        "email": "layla@example.test", "notes": "call after six", "lead_source": "Portal",
        "buy_rent": "Rent", "emirate": "Umm Al Quwain",
        "preferred_communities": " Dubai Marina ; JVC ,, JVC\n",
        "property_type": "Apartment", "bedrooms": "2 BR", "minimum_budget_aed": " 90,000 ",
        "maximum_budget_aed": 120000, "target_date": "2026-11-15", "lead_stage": "Qualified",
    }));
    assert_eq!(
        read,
        Requirements {
            purpose: Some("rent".to_owned()),
            emirate: Some("umm-al-quwain".to_owned()),
            communities: vec!["Dubai Marina".to_owned(), "JVC".to_owned()],
            property_type: Some("Apartment".to_owned()),
            bedrooms: Some(2),
            budget_min_aed: Some(90_000),
            budget_max_aed: Some(120_000),
            move_in: Some("2026-11".to_owned()),
        }
    );
    let sent = serde_json::to_string(&read).unwrap();
    for secret in [
        "Layla",
        "050 123",
        "layla@",
        "call after six",
        "Portal",
        "CL-001",
    ] {
        assert!(!sent.contains(secret), "{secret} must never leave");
    }
}

#[test]
fn unknown_and_unsafe_values_are_dropped_rather_than_sent() {
    let read = from_payload(&json!({
        "buy_rent": "Swap", "emirate": "Riyadh", "property_type": "  ",
        "preferred_communities": "wa.me/971501234567, Marina 050 123 4567, A@b, JVC",
        "bedrooms": "Studio", "minimum_budget_aed": "n/a", "maximum_budget_aed": -5,
        "target_date": "15/11/2026",
    }));
    assert_eq!(read.purpose, None);
    assert_eq!(read.emirate, None);
    assert_eq!(read.property_type, None);
    assert_eq!(read.communities, vec!["JVC".to_owned()]);
    assert_eq!(read.bedrooms, None);
    assert_eq!(read.budget_min_aed, None);
    assert_eq!(read.budget_max_aed, None);
    assert_eq!(read.move_in, None);
}

#[test]
fn at_most_twelve_communities_are_kept() {
    let names: Vec<String> = (1..=15).map(|index| format!("Area {index}")).collect();
    let read = from_payload(&json!({ "preferred_communities": names.join(", ") }));
    assert_eq!(read.communities.len(), MAX_COMMUNITIES);
    assert_eq!(read.communities[11], "Area 12");
}
