use crate::error::{ApiError, ApiResult};
use serde_json::Value;

pub fn permit_expired(p: &Value) -> bool {
    let value = p["permit_expiry"].as_str().unwrap_or("").trim();
    if value.is_empty() {
        return false;
    }
    let Ok(format) = time::format_description::parse_borrowed::<2>("[year]-[month]-[day]") else {
        return true;
    };
    let Ok(date) = time::Date::parse(value, &format) else {
        return true;
    };
    let today = time::OffsetDateTime::now_utc()
        .to_offset(time::UtcOffset::from_hms(4, 0, 0).unwrap_or(time::UtcOffset::UTC))
        .date();
    date < today
}

pub fn property_type(raw: &str) -> ApiResult<(&'static str, bool)> {
    let types = [
        "Apartment",
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
        "Building",
        "Other",
    ];
    if raw.eq_ignore_ascii_case("Studio") {
        return Ok(("Apartment", false));
    }
    let value = types
        .into_iter()
        .find(|v| v.eq_ignore_ascii_case(raw))
        .ok_or_else(|| ApiError::invalid("Choose a supported property type before publishing."))?;
    let commercial = [
        "Office",
        "Retail",
        "Shop",
        "Showroom",
        "Warehouse",
        "Industrial",
        "Commercial building",
        "Plot",
        "Land",
        "Building",
    ]
    .contains(&value);
    Ok((value, commercial))
}
pub fn count(p: &Value, key: &str, required: bool) -> ApiResult<f64> {
    let value = p.get(key).filter(|v| !v.is_null());
    let parsed = match value {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) if key == "bedrooms" && s.eq_ignore_ascii_case("Studio") => {
            Some(0.0)
        }
        Some(Value::String(s)) if s.trim().is_empty() && !required => Some(0.0),
        Some(Value::String(s)) => s.trim().parse::<f64>().ok(),
        None if !required => Some(0.0),
        _ => None,
    };
    parsed
        .filter(|n| n.is_finite() && *n >= 0.0 && *n <= 999.0 && n.fract() == 0.0)
        .ok_or_else(|| {
            ApiError::invalid("Complete valid room, parking and holiday capacity details.")
        })
}
pub fn price_basis(p: &Value, purpose: &str) -> ApiResult<()> {
    let basis = p["price_basis"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let expected = match purpose {
        "buy" => "total price",
        "rent" => "annual",
        _ => "nightly",
    };
    if basis != expected && !(basis.is_empty() && purpose != "holiday") {
        return Err(ApiError::invalid(
            "Use Total price for sales, Annual for rent and Nightly for holiday homes.",
        ));
    }
    Ok(())
}
pub fn amenities(p: &Value) -> Vec<String> {
    let values: Vec<&str> = match &p["amenities"] {
        Value::Array(a) => a.iter().filter_map(Value::as_str).collect(),
        Value::String(v) => v.split([',', ';', '|']).collect(),
        _ => Vec::new(),
    };
    let mut output = Vec::new();
    for value in values {
        let key = value.trim().to_ascii_lowercase().replace(' ', "-");
        let key = match key.as_str() {
            "swimming-pool" => "pool",
            "private-garden" => "garden",
            "maid's-room" | "maid’s-room" => "maids-room",
            _ => key.as_str(),
        };
        if ["pool", "garden", "balcony", "gym", "parking", "maids-room"].contains(&key)
            && !output.iter().any(|s| s == key)
        {
            output.push(key.to_owned());
        }
    }
    output
}
