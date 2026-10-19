use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use serde::Deserialize;

const EMIRATES: [&str; 7] = [
    "abu-dhabi",
    "dubai",
    "sharjah",
    "ajman",
    "umm-al-quwain",
    "ras-al-khaimah",
    "fujairah",
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateRequest {
    pub version: i64,
    pub display_name: String,
    pub emirate: Option<String>,
}

pub(super) fn invalid() -> ApiError {
    ApiError(
        StatusCode::BAD_REQUEST,
        "Provide valid company details.",
        "invalid_company",
    )
}

pub(super) fn prepare(request: &mut UpdateRequest) -> ApiResult<()> {
    request.display_name = request.display_name.trim().to_owned();
    if request.version < 1 || !(1..=120).contains(&request.display_name.chars().count()) {
        return Err(invalid());
    }
    if request
        .emirate
        .as_deref()
        .is_some_and(|value| !EMIRATES.contains(&value))
    {
        return Err(invalid());
    }
    Ok(())
}

pub(super) fn for_company(request: &UpdateRequest) -> ApiResult<()> {
    request
        .emirate
        .as_ref()
        .map_or_else(|| Err(invalid()), |_| Ok(()))
}

#[cfg(test)]
#[path = "validation_tests.rs"]
mod tests;
