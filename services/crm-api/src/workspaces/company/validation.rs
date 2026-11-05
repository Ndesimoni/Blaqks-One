use crate::auth::identity_rules;
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use serde::{Deserialize, Deserializer};

const EMIRATES: [&str; 7] = [
    "abu-dhabi",
    "dubai",
    "sharjah",
    "ajman",
    "umm-al-quwain",
    "ras-al-khaimah",
    "fujairah",
];

/// An office detail the request named: `None` when left out (kept as saved), `Some(None)`
/// when sent empty or null (cleared), `Some(Some(text))` otherwise.
fn present<'de, D: Deserializer<'de>>(input: D) -> Result<Option<Option<String>>, D::Error> {
    Option::<String>::deserialize(input).map(Some)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateRequest {
    pub version: i64,
    pub display_name: String,
    pub emirate: Option<String>,
    #[serde(default, deserialize_with = "present")]
    pub trade_licence: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub office_phone: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub office_address: Option<Option<String>>,
}

pub(super) fn invalid() -> ApiError {
    ApiError(
        StatusCode::BAD_REQUEST,
        "Provide valid company details.",
        "invalid_company",
    )
}

/// Trims a sent detail; empty text clears it. Text over `limit` characters or with control
/// characters is refused.
fn tidy(value: &mut Option<Option<String>>, limit: usize) -> ApiResult<()> {
    if let Some(sent) = value {
        let text = sent.as_deref().unwrap_or("").trim().to_owned();
        if text.chars().count() > limit || text.chars().any(char::is_control) {
            return Err(invalid());
        }
        *sent = (!text.is_empty()).then_some(text);
    }
    Ok(())
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
    tidy(&mut request.trade_licence, 40)?;
    tidy(&mut request.office_address, 200)?;
    tidy(&mut request.office_phone, 40)?;
    // The office phone is stored as the account phones are: `+` and digits only.
    if let Some(Some(phone)) = &mut request.office_phone {
        phone.retain(|character| !matches!(character, ' ' | '-' | '(' | ')'));
        if !identity_rules::phone(phone) {
            return Err(invalid());
        }
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
