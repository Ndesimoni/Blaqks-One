//! Strict target inputs: a `YYYY-MM` month, a closed list of measures, whole numbers within
//! each measure's range (fees in fils) and exact request keys.
use super::errors::{INVALID, METRIC, MONTH, VALUE};
use crate::error::{ApiError, ApiResult};
use serde_json::Value;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Metric {
    Enquiries,
    Viewings,
    Deals,
    Fees,
}

impl Metric {
    pub const ALL: [Self; 4] = [Self::Enquiries, Self::Viewings, Self::Deals, Self::Fees];

    pub fn key(self) -> &'static str {
        match self {
            Self::Enquiries => "enquiries",
            Self::Viewings => "viewings",
            Self::Deals => "deals",
            Self::Fees => "fees",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|metric| metric.key() == text)
    }

    /// Fees are fils up to AED 10bn; counts up to one million (matches the table CHECK).
    pub fn max(self) -> i64 {
        match self {
            Self::Fees => 1_000_000_000_000,
            _ => 1_000_000,
        }
    }
}

/// A `YYYY-MM` month between 2000 and 2100.
pub fn month(text: &str) -> ApiResult<String> {
    let bytes = text.as_bytes();
    let digits = |range: std::ops::Range<usize>| bytes[range].iter().all(u8::is_ascii_digit);
    let valid = bytes.len() == 7 && bytes[4] == b'-' && digits(0..4) && digits(5..7);
    let year: u32 = if valid {
        text[..4].parse().unwrap_or(0)
    } else {
        0
    };
    let number: u32 = if valid {
        text[5..].parse().unwrap_or(0)
    } else {
        0
    };
    if !(2000..=2100).contains(&year) || !(1..=12).contains(&number) {
        return Err(ApiError::invalid(MONTH));
    }
    Ok(text.to_string())
}

/// A validated `PUT /performance/targets` body. `value: None` clears the target and
/// `version: None` means the caller has no saved target.
#[derive(Debug, PartialEq, Eq)]
pub struct TargetInput {
    pub month: String,
    pub member: Option<Uuid>,
    pub metric: Metric,
    pub value: Option<i64>,
    pub version: Option<i64>,
}

const KEYS: [&str; 5] = ["month", "memberId", "metric", "value", "version"];

pub fn parse(body: Value) -> ApiResult<TargetInput> {
    let Value::Object(map) = body else {
        return Err(ApiError::invalid(INVALID));
    };
    if map.len() != KEYS.len() || !KEYS.iter().all(|key| map.contains_key(*key)) {
        return Err(ApiError::invalid(INVALID));
    }
    let month = month(map["month"].as_str().ok_or(ApiError::invalid(MONTH))?)?;
    let member = match &map["memberId"] {
        Value::Null => None,
        Value::String(text) => Some(Uuid::parse_str(text).map_err(|_| ApiError::invalid(INVALID))?),
        _ => return Err(ApiError::invalid(INVALID)),
    };
    let metric = map["metric"]
        .as_str()
        .and_then(Metric::parse)
        .ok_or(ApiError::invalid(METRIC))?;
    let value = match &map["value"] {
        Value::Null => None,
        value => Some(
            value
                .as_i64()
                .filter(|number| (0..=metric.max()).contains(number))
                .ok_or(ApiError::invalid(VALUE))?,
        ),
    };
    let version = match &map["version"] {
        Value::Null => None,
        value => Some(
            value
                .as_i64()
                .filter(|v| *v > 0)
                .ok_or(ApiError::invalid(INVALID))?,
        ),
    };
    Ok(TargetInput {
        month,
        member,
        metric,
        value,
        version,
    })
}

#[cfg(test)]
#[path = "input_tests.rs"]
mod tests;
