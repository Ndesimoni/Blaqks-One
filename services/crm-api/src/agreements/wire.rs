//! Strict agreement request decoding: exact key sets, integers for money and
//! shares, and no coercion of strings or floats.
use crate::error::{ApiError, ApiResult};
use serde_json::{Map, Value};
use uuid::Uuid;

pub const INVALID: &str = "Provide valid agreement details.";
pub const VERSION: &str = "A positive agreement version is required.";

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

pub fn optional_text(value: &Value, max: usize) -> ApiResult<Option<String>> {
    match value {
        Value::Null => Ok(None),
        other => text(other, max).map(Some),
    }
}

pub fn amount(value: &Value) -> ApiResult<i64> {
    value
        .as_i64()
        .filter(|amount| (1..=10_000_000_000_000).contains(amount))
        .ok_or(ApiError::invalid(INVALID))
}

pub fn count(value: &Value, max: i64) -> ApiResult<i64> {
    value
        .as_i64()
        .filter(|count| (0..=max).contains(count))
        .ok_or(ApiError::invalid(INVALID))
}

pub fn uuid(value: &Value) -> ApiResult<Uuid> {
    value
        .as_str()
        .and_then(|text| Uuid::parse_str(text).ok())
        .ok_or(ApiError::invalid(INVALID))
}

pub fn one_of<'a>(value: &Value, allowed: &[&'a str]) -> ApiResult<&'a str> {
    let text = value.as_str().ok_or(ApiError::invalid(INVALID))?;
    allowed
        .iter()
        .find(|candidate| **candidate == text)
        .copied()
        .ok_or(ApiError::invalid(INVALID))
}
