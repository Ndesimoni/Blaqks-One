//! Strict connection request decoding (exact key sets, bounded text, no coercion) and
//! the masked account hint returned in responses.
use crate::error::{ApiError, ApiResult};
use serde_json::{Map, Value};

pub const INVALID: &str = "Provide valid connection details.";
pub const CREDENTIAL: &str = "Enter the credential without spaces at the start or end.";
pub const VERSION: &str = "A positive connection version is required.";

pub fn exact(body: Value, keys: &[&str], message: &'static str) -> ApiResult<Map<String, Value>> {
    let Value::Object(map) = body else {
        return Err(ApiError::invalid(message));
    };
    let complete = map.len() == keys.len() && keys.iter().all(|key| map.contains_key(*key));
    complete.then_some(map).ok_or(ApiError::invalid(message))
}

pub fn version(map: &Map<String, Value>) -> ApiResult<i64> {
    map.get("expectedVersion")
        .and_then(Value::as_i64)
        .filter(|value| *value > 0)
        .ok_or(ApiError::invalid(VERSION))
}

pub fn node<'a>(map: &'a Map<String, Value>, key: &str) -> ApiResult<&'a Value> {
    map.get(key).ok_or(ApiError::invalid(INVALID))
}

pub fn text(value: &Value, max: usize) -> ApiResult<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty() && text.chars().count() <= max)
        .map(str::to_owned)
        .ok_or(ApiError::invalid(INVALID))
}

/// A secret is sealed exactly as typed: surrounding spaces are refused, never trimmed.
pub fn secret(value: &Value, max: usize) -> ApiResult<String> {
    value
        .as_str()
        .filter(|text| !text.is_empty() && text.trim() == *text && text.chars().count() <= max)
        .map(str::to_owned)
        .ok_or(ApiError::invalid(CREDENTIAL))
}

/// Shows the last four characters only when at least eight exist.
pub fn mask(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() < 8 {
        return "••••".into();
    }
    format!(
        "••••{}",
        chars[chars.len() - 4..].iter().collect::<String>()
    )
}
