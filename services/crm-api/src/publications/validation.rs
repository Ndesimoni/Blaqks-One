use super::model::PublishInput;
use crate::error::{ApiError, ApiResult};
use std::collections::HashSet;

pub fn input(value: &PublishInput) -> ApiResult<()> {
    if value
        .market
        .as_deref()
        .is_some_and(|v| !["primary", "resale"].contains(&v))
    {
        return Err(ApiError::invalid("Choose Primary sale or Resale."));
    }
    if !value.developer.is_empty() && !crate::catalogue::known_developer(&value.developer) {
        return Err(ApiError::invalid("Choose a known public developer."));
    }
    if value.version < 0
        || value.record_version < 1
        || !["general_and_company", "company_only"].contains(&value.destination.as_str())
        || !crate::sites::validation::text(&value.permit_reference, 100)
    {
        return Err(ApiError::invalid(
            "Choose a destination, permit reference and current versions.",
        ));
    }
    if value.photos.is_empty() || value.photos.len() > 20 || value.floor_plans.len() > 3 {
        return Err(ApiError::invalid(
            "Choose 1–20 photos and up to three floor plans.",
        ));
    }
    let ids: Vec<_> = value.photos.iter().chain(&value.floor_plans).collect();
    if ids.iter().copied().collect::<HashSet<_>>().len() != ids.len() {
        return Err(ApiError::invalid("Select each public media file once."));
    }
    if value.developer.len() > 100
        || !value
            .developer
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
    {
        return Err(ApiError::invalid("Choose a valid developer identifier."));
    }
    Ok(())
}
