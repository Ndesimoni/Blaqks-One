//! Text rules shared by the client fields, the timeline and the public intake.
use super::input::DATE;
use crate::error::{ApiError, ApiResult};

/// Trimmed text up to `limit` characters; empty text is no value.
pub fn text(
    value: Option<String>,
    limit: usize,
    message: &'static str,
) -> ApiResult<Option<String>> {
    let Some(trimmed) = value.map(|value| value.trim().to_string()) else {
        return Ok(None);
    };
    if trimmed.chars().count() > limit {
        return Err(ApiError::invalid(message));
    }
    Ok((!trimmed.is_empty()).then_some(trimmed))
}

/// A calendar day written YYYY-MM-DD.
pub fn day(value: Option<String>) -> ApiResult<Option<String>> {
    let Some(day) = text(value, 10, DATE)? else {
        return Ok(None);
    };
    let format = time::format_description::parse_borrowed::<2>("[year]-[month]-[day]")
        .map_err(|_| ApiError::invalid(DATE))?;
    match time::Date::parse(&day, &format) {
        Ok(_) if day.len() == 10 => Ok(Some(day)),
        _ => Err(ApiError::invalid(DATE)),
    }
}
