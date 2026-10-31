//! What a client is looking for, as a request may repeat it (docs/broker-marketplace.md §3,
//! packet MK2): the allowlist of Clients fields a request may carry, and nothing else. The client's
//! name, phone, email, notes and record ID never leave this module; its reads are beside it.
use super::market_requirements_communities as names;
use serde::Serialize;
use serde_json::{Map, Value};

pub use super::market_requirements_read::{read, still_held};

pub const MAX_COMMUNITIES: usize = 12;
const EMIRATES: [&str; 7] = [
    "dubai",
    "abu-dhabi",
    "sharjah",
    "ajman",
    "umm-al-quwain",
    "ras-al-khaimah",
    "fujairah",
];

/// The allowlisted requirements of one client, pre-filled into a marketplace request.
#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Requirements {
    pub purpose: Option<String>,
    pub emirate: Option<String>,
    pub communities: Vec<String>,
    pub property_type: Option<String>,
    pub bedrooms: Option<i16>,
    pub budget_min_aed: Option<i64>,
    pub budget_max_aed: Option<i64>,
    pub move_in: Option<String>,
}

fn text<'a>(payload: &'a Map<String, Value>, field: &str) -> Option<&'a str> {
    let value = payload.get(field)?.as_str()?.trim();
    (!value.is_empty()).then_some(value)
}

fn purpose(payload: &Map<String, Value>) -> Option<String> {
    match text(payload, "buy_rent")? {
        "Buy" => Some("buy".to_owned()),
        "Rent" => Some("rent".to_owned()),
        _ => None,
    }
}

/// A stored Emirate label as its MK1 slug (`Abu Dhabi` → `abu-dhabi`), when it is one.
fn emirate(payload: &Map<String, Value>) -> Option<String> {
    let label = text(payload, "emirate")?;
    let slug = label.to_lowercase().replace(' ', "-");
    EMIRATES.contains(&slug.as_str()).then_some(slug)
}

/// A whole bedroom count; `Studio` is none of them (0 is stored on the request itself).
fn bedrooms(payload: &Map<String, Value>) -> Option<i16> {
    let stored = payload.get("bedrooms")?;
    let digits: String = stored
        .as_str()
        .map(str::to_owned)
        .or_else(|| stored.as_i64().map(|value| value.to_string()))?;
    let count: i16 = digits
        .chars()
        .take_while(char::is_ascii_digit)
        .collect::<String>()
        .parse()
        .ok()?;
    (count <= 20).then_some(count)
}

/// A budget as a whole number of dirhams: a JSON number, or a numeric string with separators
/// whose fils (anything after the decimal point) are dropped.
fn money(payload: &Map<String, Value>, field: &str) -> Option<i64> {
    let stored = payload.get(field)?;
    if let Some(value) = stored.as_i64() {
        return (value >= 0).then_some(value);
    }
    if let Some(value) = stored.as_f64() {
        return (0.0..1e15).contains(&value).then_some(value.trunc() as i64);
    }
    let text = stored.as_str()?.trim();
    if text.starts_with('-') {
        return None;
    }
    let whole = text.split('.').next().unwrap_or_default();
    let digits: String = whole.chars().filter(char::is_ascii_digit).collect();
    digits.parse().ok()
}

/// A stored target date as the month a move-in is asked for, `YYYY-MM`.
fn move_in(payload: &Map<String, Value>) -> Option<String> {
    let stored = text(payload, "target_date")?;
    let month = stored.get(..7)?;
    let (year, suffix) = (month.get(..4)?, month.get(4..)?);
    let ok = suffix
        .strip_prefix('-')
        .is_some_and(|part| part.len() == 2 && matches!(part.parse::<u8>(), Ok(1..=12)));
    (ok && year.chars().all(|c| c.is_ascii_digit())).then(|| month.to_owned())
}

/// The allowlist applied to a stored Clients payload. Only the fields named here are read.
pub fn from_payload(payload: &Value) -> Requirements {
    let Some(map) = payload.as_object() else {
        return Requirements::default();
    };
    Requirements {
        purpose: purpose(map),
        emirate: emirate(map),
        communities: names::communities(text(map, "preferred_communities")),
        property_type: text(map, "property_type").map(str::to_owned),
        bedrooms: bedrooms(map),
        budget_min_aed: money(map, "minimum_budget_aed"),
        budget_max_aed: money(map, "maximum_budget_aed"),
        move_in: move_in(map),
    }
}

#[cfg(test)]
#[path = "market_requirements_tests.rs"]
mod tests;
