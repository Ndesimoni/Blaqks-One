use super::{places, records, Calendar, LABEL, NOTE};
use crate::records::{collections, ids, validation};
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
fn every_record_validates_and_uses_the_reserved_sample_id_range() {
    let counts = [
        ("Contacts", 8),
        ("Clients", 10),
        ("Properties", 12),
        ("Follow-ups", 6),
        ("Viewings", 4),
        ("Shortlist", 5),
        ("Interaction log", 4),
        ("Client care", 3),
    ];
    for (collection, count) in counts {
        let rows = rows(collection);
        assert_eq!(rows.len(), count, "{collection}");
        let prefix = format!("{}-S", ids::prefix(collection).unwrap());
        for row in rows {
            let record = validation::validate(collection, row).unwrap();
            assert!(
                record.legacy_id.starts_with(&prefix),
                "{}",
                record.legacy_id
            );
            // Issued IDs are `PREFIX-<digits>`; the `S` keeps sample IDs out of `ids::issue`.
            assert!(!record.legacy_id[3..].starts_with(|c: char| c.is_ascii_digit()));
        }
    }
    assert!(records(&CALENDAR).normalize().is_ok());
}

#[test]
fn every_link_resolves_inside_the_sample_set() {
    let all = records(&CALENDAR);
    let mut known = HashSet::new();
    for (collection, rows) in all.collections() {
        let key = collections::find(collection).unwrap().id_key;
        known.extend(
            rows.iter()
                .map(|row| (collection, text(row, key).to_owned())),
        );
    }
    let mut linked = 0;
    for (collection, rows) in all.collections() {
        for link in collections::find(collection).unwrap().links {
            for row in rows.iter().filter(|row| row.get(link.field).is_some()) {
                assert!(known.contains(&(link.target, text(row, link.field).to_owned())));
                linked += 1;
            }
        }
    }
    assert!(linked > 40);
    let referred = rows("Clients");
    assert_eq!(text(&referred[9], "referred_by_client_id"), "CL-S07");
}

#[test]
fn people_and_listings_are_labelled_and_unreachable() {
    for collection in ["Clients", "Contacts"] {
        for row in rows(collection) {
            assert!(text(&row, "full_name").starts_with(LABEL));
            assert!(text(&row, "phone").starts_with("+971 50 000 0"));
            assert!(text(&row, "email").starts_with("sample."));
            assert!(text(&row, "email").ends_with("@example.test"));
            assert_eq!(text(&row, "notes"), NOTE);
            let company = text(&row, "company");
            assert!(
                company.is_empty() || company.starts_with("Sample "),
                "{company}"
            );
        }
    }
    let clients = rows("Clients");
    assert!(clients
        .iter()
        .all(|row| text(row, "contact_permission") == "No"));
    for row in rows("Properties") {
        assert!(text(&row, "listing_title").starts_with(LABEL));
        assert!(places::find(text(&row, "building_project")).is_some());
        assert!(text(&row, "map_link").starts_with("https://www.google.com/maps/search/"));
        assert!(!text(&row, "unit_reference").is_empty() && !text(&row, "address").is_empty());
    }
}
