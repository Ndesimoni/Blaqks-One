use crate::{
    auth::{identity_rules, session::digest},
    error::{ApiError, ApiResult},
};
use axum::http::HeaderMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    pub listing_id: Option<Uuid>,
    pub agent_id: Option<Uuid>,
    pub company_id: Option<Uuid>,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub message: String,
    pub contact_preference: Option<String>,
    pub privacy_acknowledged: bool,
}

fn clean(value: &mut Option<String>) {
    *value = value
        .take()
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty());
}

pub fn prepare(mut value: Input) -> ApiResult<Input> {
    value.name = value.name.trim().to_owned();
    value.message = value.message.trim().to_owned();
    clean(&mut value.email);
    clean(&mut value.phone);
    clean(&mut value.contact_preference);
    if let Some(email) = &mut value.email {
        email.make_ascii_lowercase();
    }
    if !identity_rules::name(&value.name) || value.name.chars().any(char::is_control) {
        return Err(ApiError::invalid(
            "Provide your name, up to 100 characters.",
        ));
    }
    if value.email.is_none() && value.phone.is_none() {
        return Err(ApiError::invalid(
            "Provide an email address or international phone number.",
        ));
    }
    if value
        .email
        .as_deref()
        .is_some_and(|v| !identity_rules::email(v))
        || value
            .phone
            .as_deref()
            .is_some_and(|v| !identity_rules::phone(v))
    {
        return Err(ApiError::invalid("Provide valid contact details."));
    }
    if value.message.is_empty()
        || value.message.chars().count() > 4000
        || value
            .message
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    {
        return Err(ApiError::invalid(
            "Provide a message, up to 4000 characters.",
        ));
    }
    if !value.privacy_acknowledged {
        return Err(ApiError::invalid(
            "Acknowledge the privacy notice before submitting.",
        ));
    }
    if value
        .contact_preference
        .as_deref()
        .is_some_and(|v| !matches!(v, "email" | "phone" | "whatsapp"))
    {
        return Err(ApiError::invalid("Choose a valid contact preference."));
    }
    if (value.contact_preference.as_deref() == Some("email") && value.email.is_none())
        || (matches!(
            value.contact_preference.as_deref(),
            Some("phone" | "whatsapp")
        ) && value.phone.is_none())
    {
        return Err(ApiError::invalid(
            "Provide contact details for your preferred channel.",
        ));
    }
    Ok(value)
}

pub fn key(headers: &HeaderMap) -> ApiResult<String> {
    let mut values = headers.get_all("idempotency-key").iter();
    let value = values.next().and_then(|v| v.to_str().ok()).unwrap_or("");
    if values.next().is_some()
        || !(16..=128).contains(&value.len())
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
    {
        return Err(ApiError::invalid(
            "Provide a valid Idempotency-Key of 16 to 128 characters.",
        ));
    }
    Ok(digest(value))
}

pub fn payload_hash(value: &Input) -> ApiResult<String> {
    serde_json::to_string(value)
        .map(|value| digest(&value))
        .map_err(|_| ApiError::invalid("Invalid enquiry."))
}

#[cfg(test)]
#[path = "input_tests.rs"]
mod tests;
