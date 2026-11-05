use super::query::PublicQuery;
use serde_json::Value;

use super::options::{AMENITIES, EMIRATES, TYPES};

fn decimal(text: &str) -> bool {
    let mut pieces = text.split('.');
    let whole = pieces.next().unwrap_or("");
    let fraction = pieces.next();
    !whole.is_empty()
        && whole.bytes().all(|c| c.is_ascii_digit())
        && fraction
            .is_none_or(|v| !v.is_empty() && v.len() <= 2 && v.bytes().all(|c| c.is_ascii_digit()))
        && pieces.next().is_none()
        && text.parse::<f64>().is_ok_and(f64::is_finite)
}
pub fn errors(q: &PublicQuery, catalogue: &Value) -> Vec<String> {
    let mut errors = Vec::new();
    for (min, max, label) in [
        ("minPrice", "maxPrice", "budget"),
        ("minSize", "maxSize", "size"),
    ] {
        if [q.get(min), q.get(max)]
            .iter()
            .any(|v| !v.is_empty() && !decimal(v))
        {
            errors.push(format!("Enter a valid, non-negative {label}."));
        }
        if q.number(min).zip(q.number(max)).is_some_and(|(a, b)| a > b) {
            errors.push(format!("Maximum {label} must be at least the minimum."));
        }
    }
    if q.get("purpose").is_empty()
        && (!q.get("minPrice").is_empty()
            || !q.get("maxPrice").is_empty()
            || q.get("sort").starts_with("price-"))
    {
        errors.push("Choose Buy, Rent or Holiday homes before a budget or price sort.".into());
    }
    for (key, choices) in [
        ("purpose", &["buy", "rent", "holiday"][..]),
        ("emirate", EMIRATES),
        ("type", TYPES),
        ("category", &["residential", "commercial"][..]),
        ("ready", &["ready", "off-plan"][..]),
        ("market", &["primary", "resale"][..]),
        (
            "furnishing",
            &["furnished", "unfurnished", "part-furnished"][..],
        ),
        ("bedrooms", &["studio", "1", "2", "3", "4", "5plus"][..]),
        (
            "sort",
            &[
                "newest",
                "name",
                "price-asc",
                "price-desc",
                "size-asc",
                "size-desc",
            ][..],
        ),
    ] {
        if !q.get(key).is_empty() && !choices.contains(&q.get(key)) {
            errors.push(format!("Choose a valid {key}."));
        }
    }
    for field in ["bathrooms", "parking", "guests", "nights"] {
        let text = q.get(field);
        if !text.is_empty()
            && (!text.bytes().all(|c| c.is_ascii_digit())
                || !text.parse::<u8>().is_ok_and(|n| (1..=99).contains(&n)))
        {
            errors.push(format!("Enter a valid {field} value."));
        }
    }
    if !q.get("market").is_empty() && q.get("purpose") != "buy" {
        errors.push("Sale market applies only to properties for sale.".into());
    }
    if (!q.get("guests").is_empty() || !q.get("nights").is_empty()) && q.get("purpose") != "holiday"
    {
        errors.push("Guests and stay length apply only to holiday homes.".into());
    }
    if q.amenities.iter().any(|v| !AMENITIES.contains(&v.as_str())) {
        errors.push("Choose an available amenity.".into());
    }
    for (field, collection) in [
        ("company", "companies"),
        ("agent", "agents"),
        ("developer", "developers"),
        ("area", "areas"),
    ] {
        if q.get(field).is_empty() {
            continue;
        }
        let found = catalogue[collection]
            .as_array()
            .and_then(|a| a.iter().find(|v| v["id"].as_str() == Some(q.get(field))));
        if found.is_none() {
            errors.push(format!("Choose an available {field}."));
        }
        if field == "area"
            && !q.get("emirate").is_empty()
            && found.is_some_and(|v| v["emirate"].as_str() != Some(q.get("emirate")))
        {
            errors.push("Choose a community in the selected emirate.".into());
        }
    }
    errors
}
