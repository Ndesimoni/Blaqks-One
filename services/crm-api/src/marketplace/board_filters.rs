//! The board's query string and the filters it may carry (packet MK2). An unknown choice is
//! refused rather than silently ignored, so a mistyped link never shows the whole board.
use super::{bands, profile::EMIRATES, request, requests};
use crate::error::{ApiError, ApiResult};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Board {
    #[serde(default)]
    pub purpose: Option<String>,
    #[serde(default)]
    pub emirate: Option<String>,
    #[serde(default)]
    pub property_type: Option<String>,
    #[serde(default)]
    pub bedrooms: Option<i16>,
    #[serde(default)]
    pub band: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
}

pub fn filters(query: &Board) -> ApiResult<requests::Filters> {
    let choice = |value: &Option<String>, allowed: &[&str]| -> ApiResult<Option<String>> {
        match value {
            None => Ok(None),
            Some(text) if allowed.contains(&text.as_str()) => Ok(Some(text.clone())),
            Some(_) => Err(ApiError::invalid(request::INVALID)),
        }
    };
    if query
        .bedrooms
        .is_some_and(|count| !(0..=20).contains(&count))
    {
        return Err(ApiError::invalid(request::INVALID));
    }
    let band = match &query.band {
        None => None,
        Some(name) if bands::known(name) => Some(name.clone()),
        Some(_) => return Err(ApiError::invalid(request::INVALID)),
    };
    Ok(requests::Filters {
        purpose: choice(&query.purpose, &request::PURPOSES)?,
        emirate: choice(&query.emirate, &EMIRATES)?,
        property_type: choice(&query.property_type, &request::PROPERTY_TYPES)?,
        bedrooms: query.bedrooms,
        band,
    })
}
