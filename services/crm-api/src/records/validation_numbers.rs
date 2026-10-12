use crate::error::{ApiError, ApiResult};
use serde_json::Value;

pub fn validate(collection: &str, payload: &Value) -> ApiResult<()> {
    let fields: &[&str] = match collection {
        "Clients" => &[
            "bedrooms",
            "minimum_budget_aed",
            "maximum_budget_aed",
            "lead_quality_score_100",
        ],
        "Properties" => &[
            "bedrooms",
            "area_sq_ft",
            "price_annual_rent_aed",
            "rental_cheques",
            "deposit_aed",
            "minimum_stay_nights",
            "maximum_guests",
            "bathrooms",
            "parking_spaces",
        ],
        _ => &[],
    };
    for field in fields {
        if let Some(value) = number(payload.get(field))? {
            if value < 0.0 || (*field == "lead_quality_score_100" && value > 100.0) {
                return Err(ApiError::invalid(
                    "Numeric fields must be non-negative and within range.",
                ));
            }
        }
    }
    if collection == "Clients" {
        if let (Some(minimum), Some(maximum)) = (
            number(payload.get("minimum_budget_aed"))?,
            number(payload.get("maximum_budget_aed"))?,
        ) {
            if minimum > maximum {
                return Err(ApiError::invalid(
                    "Maximum budget must be at least the minimum budget.",
                ));
            }
        }
    }
    Ok(())
}

fn number(value: Option<&Value>) -> ApiResult<Option<f64>> {
    let parsed = match value {
        None | Some(Value::Null) => return Ok(None),
        Some(Value::String(value)) if value.trim().is_empty() => return Ok(None),
        Some(Value::String(value)) => value.trim().parse::<f64>().ok(),
        Some(Value::Number(value)) => value.as_f64(),
        _ => None,
    };
    parsed
        .filter(|value| value.is_finite())
        .map(Some)
        .ok_or_else(|| ApiError::invalid("Enter valid numeric field values."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn accepts_workbook_numeric_strings_but_rejects_invalid_types_and_ranges() {
        assert!(validate("Properties", &json!({"price_annual_rent_aed":"123.45"})).is_ok());
        for value in [json!(true), json!([]), json!("NaN"), json!(-1)] {
            assert!(validate("Properties", &json!({"price_annual_rent_aed": value})).is_err());
        }
        assert!(validate("Clients", &json!({"lead_quality_score_100":101})).is_err());
        assert!(validate(
            "Clients",
            &json!({"minimum_budget_aed":300,"maximum_budget_aed":200})
        )
        .is_err());
    }
}
