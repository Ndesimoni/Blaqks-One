//! Strict finance request decoding (finance-design §6.2): exact key sets, integers only
//! for rates and money, ISO dates. Floats, strings and out-of-range values are refused
//! with the same message, never coerced.
use super::calc::MAX_BP;
use crate::error::{ApiError, ApiResult};
use serde_json::{Map, Value};
use uuid::Uuid;

pub const PERCENT: &str = "Percentages must be between 0 and 100 with up to two decimals.";
pub const DATE: &str = "Enter a valid date (YYYY-MM-DD).";

/// The body must be an object holding exactly `keys`; otherwise `message` (400).
pub fn exact(body: Value, keys: &[&str], message: &'static str) -> ApiResult<Map<String, Value>> {
    let Value::Object(map) = body else {
        return Err(ApiError::invalid(message));
    };
    let complete = map.len() == keys.len() && keys.iter().all(|key| map.contains_key(*key));
    complete.then_some(map).ok_or(ApiError::invalid(message))
}

/// A share in basis points: a JSON integer from 0 to 10000 (100.00%).
pub fn bp(value: &Value) -> ApiResult<i32> {
    value
        .as_i64()
        .filter(|bp| (0..=i64::from(MAX_BP)).contains(bp))
        .and_then(|bp| i32::try_from(bp).ok())
        .ok_or(ApiError::invalid(PERCENT))
}

pub fn boolean(value: &Value, message: &'static str) -> ApiResult<bool> {
    value.as_bool().ok_or(ApiError::invalid(message))
}

pub fn uuid(value: &Value, message: &'static str) -> ApiResult<Uuid> {
    value
        .as_str()
        .and_then(|text| Uuid::parse_str(text).ok())
        .ok_or(ApiError::invalid(message))
}

/// A calendar date `YYYY-MM-DD` between 2000 and 2099 (realistic bounds, §13 L-F3).
pub fn date(value: &Value) -> ApiResult<String> {
    let text = value.as_str().ok_or(ApiError::invalid(DATE))?;
    valid_date(text)
        .then(|| text.to_string())
        .ok_or(ApiError::invalid(DATE))
}

pub fn valid_date(text: &str) -> bool {
    let bytes = text.as_bytes();
    let digits = |range: std::ops::Range<usize>| {
        bytes[range.clone()].iter().all(u8::is_ascii_digit) && text[range].parse::<u32>().is_ok()
    };
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    if !(digits(0..4) && digits(5..7) && digits(8..10)) {
        return false;
    }
    let number = |range: std::ops::Range<usize>| text[range].parse::<u32>().unwrap_or(0);
    let (year, month, day) = (number(0..4), number(5..7), number(8..10));
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    (2000..=2099).contains(&year) && (1..=days).contains(&day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rates_are_integers_and_dates_are_real_calendar_days() {
        assert_eq!(bp(&json!(6000)).unwrap(), 6000);
        for refused in [
            json!(60.5),
            json!(6000.0),
            json!("6000"),
            json!(-1),
            json!(10001),
        ] {
            assert_eq!(bp(&refused).unwrap_err().1, PERCENT, "{refused}");
        }
        for good in ["2026-01-31", "2028-02-29", "2000-02-29", "2099-12-31"] {
            assert!(valid_date(good), "{good}");
        }
        for bad in [
            "2026-02-29",
            "2100-02-29",
            "1999-12-31",
            "2026-13-01",
            "2026-1-01",
        ] {
            assert!(!valid_date(bad), "{bad}");
        }
        assert!(!valid_date("2026-04-31") && !valid_date("+026-04-01") && !valid_date("２"));
        let body = json!({"a": 1, "b": 2});
        assert!(exact(body.clone(), &["a", "b"], "x").is_ok());
        assert!(exact(body.clone(), &["a"], "x").is_err());
        assert!(exact(body, &["a", "b", "c"], "x").is_err());
        assert!(exact(json!([1]), &[], "x").is_err());
    }
}
