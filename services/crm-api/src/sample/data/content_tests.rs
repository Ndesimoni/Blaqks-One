//! Workbook dropdown values and shared buildings in the sample content.
use super::{records, Calendar};
use serde_json::Value;
use std::collections::HashSet;

const CALENDAR: Calendar = Calendar { today: 20_740 };

fn rows(collection: &str) -> Vec<Value> {
    records(&CALENDAR).rows(collection).to_vec()
}

fn text<'a>(row: &'a Value, key: &str) -> &'a str {
    row[key].as_str().unwrap_or_default()
}

#[test]
fn building_staff_share_buildings_with_listings() {
    let buildings: HashSet<String> = rows("Properties")
        .iter()
        .map(|row| text(row, "building_project").to_owned())
        .collect();
    let staff: Vec<Value> = rows("Contacts")
        .into_iter()
        .filter(|row| {
            matches!(
                text(row, "contact_type"),
                "Security guard" | "Building manager"
            )
        })
        .collect();
    assert_eq!(staff.len(), 3);
    assert!(staff
        .iter()
        .all(|row| buildings.contains(text(row, "building_project"))));
}

#[test]
fn option_values_match_the_workbook_dropdowns() {
    let checks: [(&str, &str, &[&str]); 7] = [
        (
            "Clients",
            "lead_stage",
            &[
                "New",
                "Contacted",
                "Qualified",
                "Viewing",
                "Negotiation",
                "Documentation",
                "Closed",
                "Lost",
                "On hold",
            ],
        ),
        ("Clients", "priority", &["High", "Medium", "Low"]),
        (
            "Properties",
            "listing_status",
            &["Available", "Under offer", "Rented", "Sold"],
        ),
        (
            "Properties",
            "sale_rental",
            &["Sale", "Rental", "Holiday home"],
        ),
        (
            "Viewings",
            "viewing_status",
            &["Scheduled", "Confirmed", "Completed", "Cancelled"],
        ),
        (
            "Shortlist",
            "client_response",
            &[
                "Interested",
                "Pending",
                "Not interested",
                "Viewing requested",
                "Negotiating",
            ],
        ),
        (
            "Follow-ups",
            "task_status",
            &["Open", "In progress", "Completed", "Cancelled"],
        ),
    ];
    for (collection, field, options) in checks {
        for row in rows(collection) {
            assert!(options.contains(&text(&row, field)), "{collection} {field}");
        }
    }
    let stages: HashSet<String> = rows("Clients")
        .iter()
        .map(|row| text(row, "lead_stage").to_owned())
        .collect();
    assert!(["Negotiation", "Closed", "Lost", "New"]
        .iter()
        .all(|stage| stages.contains(*stage)));
}
