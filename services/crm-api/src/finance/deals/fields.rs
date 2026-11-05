//! Deal field decoders (finance-design §6.2, §13 L-F3): closed option lists, whole fils
//! within the realistic cap, record references and nullable values.
use crate::error::{ApiError, ApiResult};
use serde_json::Value;

pub const MONEY: &str = "Amounts must be whole fils between 0 and AED 10,000,000,000.";
/// §13 L-F3: AED 10bn in fils for agreed values and fixed fees.
pub const MAX_DEAL_FILS: i64 = 1_000_000_000_000;
pub const TYPES: [&str; 3] = ["Sale", "Rental", "Holiday home"];
pub const STAGES: [&str; 10] = [
    "New",
    "Qualified",
    "Viewing",
    "Offer",
    "Negotiation",
    "Documentation",
    "Completed",
    "Lost",
    "Cancelled",
    "On hold",
];
pub fn option(
    value: &Value,
    options: &[&'static str],
    message: &'static str,
) -> ApiResult<&'static str> {
    let text = value.as_str().ok_or(ApiError::invalid(message))?;
    options
        .iter()
        .find(|option| **option == text)
        .copied()
        .ok_or(ApiError::invalid(message))
}

pub fn money(value: &Value) -> ApiResult<i64> {
    value
        .as_i64()
        .filter(|fils| (0..=MAX_DEAL_FILS).contains(fils))
        .ok_or(ApiError::invalid(MONEY))
}

/// A record reference: `null`/absent/empty is none; otherwise 1–128 characters.
pub fn reference(value: Option<&Value>, message: &'static str) -> ApiResult<Option<String>> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) if text.trim().is_empty() => Ok(None),
        Some(Value::String(text)) if text.trim().chars().count() <= 128 => {
            Ok(Some(text.trim().to_string()))
        }
        _ => Err(ApiError::invalid(message)),
    }
}

pub fn nullable<T>(
    value: Option<&Value>,
    parse: impl Fn(&Value) -> ApiResult<T>,
) -> ApiResult<Option<T>> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(value) => parse(value).map(Some),
    }
}
