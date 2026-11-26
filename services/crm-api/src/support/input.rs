//! What a help request and a reply accept, checked before anything is stored.
use crate::error::{ApiError, ApiResult};
use serde::Deserialize;
use uuid::Uuid;

pub(super) const CATEGORIES: [&str; 6] =
    ["account", "billing", "problem", "how_to", "idea", "other"];
pub(super) const STATES: [&str; 3] = ["open", "waiting", "solved"];

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct NewRequest {
    pub category: String,
    pub subject: String,
    pub message: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Reply {
    pub body: String,
}

/// The Blaqks One side's change: solve or reopen, and assign ("" unassigns).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Change {
    pub version: i64,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
}

pub(super) fn category(raw: &str) -> ApiResult<&'static str> {
    CATEGORIES
        .into_iter()
        .find(|known| *known == raw)
        .ok_or(ApiError::invalid("Choose what your request is about."))
}

pub(super) fn subject(raw: &str) -> ApiResult<String> {
    let text = raw.trim();
    if text.is_empty() || text.chars().count() > 160 {
        return Err(ApiError::invalid(
            "Give your request a subject of up to 160 characters.",
        ));
    }
    Ok(text.to_owned())
}

pub(super) fn body(raw: &str) -> ApiResult<String> {
    let text = raw.trim();
    if text.is_empty() || text.chars().count() > 4000 {
        return Err(ApiError::invalid(
            "Write a message of up to 4,000 characters.",
        ));
    }
    Ok(text.to_owned())
}

/// A request ID from the path; anything else is not found.
pub(super) fn id(raw: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(raw).map_err(|_| ApiError::missing())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_and_replies_are_checked() {
        assert_eq!(category("problem").unwrap(), "problem");
        assert!(category("billing ").is_err());
        assert_eq!(subject("  Cannot sign in ").unwrap(), "Cannot sign in");
        assert!(subject(&"x".repeat(161)).is_err());
        assert!(body("   ").is_err());
        assert!(body(&"y".repeat(4001)).is_err());
        assert!(id("not-a-uuid").is_err());
    }
}
