//! Clearly fictional, UAE-realistic sample records using the workbook field keys and
//! option values of `src/data/schemas` and `src/config/fields`. Every ID uses the
//! `-S` range (for example `CL-S01`), which never matches a server-issued ID.
pub mod clients;
pub mod contacts;
pub mod places;
pub mod properties;
pub mod relations;
pub mod schedule;

use super::dates::Calendar;
use crate::imports::model::ImportRecords;
use serde_json::Value;

pub const LABEL: &str = "Sample · ";
pub const NOTE: &str = "Fictional sample record for local testing. \
     Remove all sample data with npm run crm:clear-sample.";

/// A labelled display name, for example `Sample · Omar Haddad`.
pub fn name(person: &str) -> String {
    format!("{LABEL}{person}")
}

/// An obviously placeholder `+971 50 000 0xxx` number, like the demo's. The UAE has no
/// official fictional range, so these are never dialled or messaged.
pub fn phone(number: u16) -> String {
    format!("+971 50 000 {:04}", number % 1000)
}

/// `sample.first.last@example.test` (`.test` is reserved and never delivers mail).
pub fn email(person: &str) -> String {
    let local: String = person
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '.'
            }
        })
        .collect();
    let local: Vec<&str> = local.split('.').filter(|part| !part.is_empty()).collect();
    format!("sample.{}@example.test", local.join("."))
}

/// `base` with every field of `extra` added or replaced.
pub fn merge(mut base: Value, extra: Value) -> Value {
    if let (Some(base), Value::Object(extra)) = (base.as_object_mut(), extra) {
        base.extend(extra);
    }
    base
}

/// Every sample record, in the import insertion order.
pub fn records(calendar: &Calendar) -> ImportRecords {
    let mut records = ImportRecords::default();
    let collections = [
        ("Contacts", contacts::rows()),
        ("Clients", clients::rows(calendar)),
        ("Properties", properties::rows(calendar)),
        ("Follow-ups", schedule::follow_ups(calendar)),
        ("Viewings", schedule::viewings(calendar)),
        ("Shortlist", relations::shortlist(calendar)),
        ("Interaction log", relations::interactions(calendar)),
        ("Client care", relations::care(calendar)),
    ];
    for (collection, rows) in collections {
        for row in rows {
            records.push(collection, row);
        }
    }
    records
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;

#[cfg(test)]
#[path = "content_tests.rs"]
mod content_tests;
