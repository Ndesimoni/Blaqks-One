use super::query::PublicQuery;
use serde_json::Value;

pub fn matches(p: &Value, q: &PublicQuery) -> bool {
    for key in [
        "purpose",
        "emirate",
        "area",
        "type",
        "category",
        "company",
        "agent",
        "developer",
        "ready",
        "furnishing",
        "market",
    ] {
        if !q.get(key).is_empty() && p[key].as_str() != Some(q.get(key)) {
            return false;
        }
    }
    for (field, property, minimum) in [
        ("minPrice", "price", true),
        ("maxPrice", "price", false),
        ("minSize", "size", true),
        ("maxSize", "size", false),
    ] {
        if let Some(n) = q.number(field) {
            let Some(value) = p[property].as_f64() else {
                return false;
            };
            if (minimum && value < n) || (!minimum && value > n) {
                return false;
            }
        }
    }
    if !q.get("bedrooms").is_empty() {
        let beds = p["bedrooms"].as_f64();
        if p["category"] == "commercial"
            || match q.get("bedrooms") {
                "studio" => beds != Some(0.0),
                "5plus" => beds.is_none_or(|v| v < 5.0),
                value => beds != value.parse::<f64>().ok(),
            }
        {
            return false;
        }
    }
    for field in ["bathrooms", "parking", "guests"] {
        if q.number(field)
            .is_some_and(|n| p[field].as_f64().is_none_or(|v| v < n))
        {
            return false;
        }
    }
    if q.number("nights")
        .is_some_and(|n| p["minimumStay"].as_f64().is_none_or(|v| v > n))
    {
        return false;
    }
    if q.amenities.iter().any(|wanted| {
        !p["amenities"]
            .as_array()
            .is_some_and(|list| list.iter().any(|v| v.as_str() == Some(wanted)))
    }) {
        return false;
    }
    q.get("q").is_empty()
        || p["title"]
            .as_str()
            .unwrap_or("")
            .to_lowercase()
            .contains(&q.get("q").trim().to_lowercase())
}
