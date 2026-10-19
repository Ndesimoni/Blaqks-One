use super::model::StartRequest;
use crate::{
    auth::{account::language, consents, identity_rules, password_policy},
    error::{ApiError, ApiResult},
};
use axum::http::StatusCode;

pub struct Prepared {
    pub name: String,
    pub email: String,
    pub phone: String,
    pub password: String,
    pub terms: String,
    pub privacy: String,
    pub language: &'static str,
    pub bot_token: String,
}

fn invalid(message: &'static str, code: &'static str) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, message, code)
}

pub fn start(request: StartRequest) -> ApiResult<Prepared> {
    let name = request.name.trim().to_owned();
    if !identity_rules::name(&name) {
        return Err(invalid("Provide your full name.", "invalid_name"));
    }
    let raw_email = request.email.trim();
    let email = raw_email.to_ascii_lowercase();
    if !raw_email.is_ascii() || !identity_rules::email(&email) {
        return Err(invalid("Provide a valid email address.", "invalid_email"));
    }
    let phone = request.phone.trim().to_owned();
    if !identity_rules::phone(&phone) {
        return Err(invalid(
            "Provide a phone number including country code.",
            "invalid_phone",
        ));
    }
    password_policy::check(&request.password, None, &email)?;
    consents::validate(&request.terms_version, &request.privacy_version)?;
    let language = language::allowed(&request.language)
        .ok_or_else(|| invalid("Choose English or Arabic.", "invalid_language"))?;
    Ok(Prepared {
        name,
        email,
        phone,
        password: request.password,
        terms: request.terms_version,
        privacy: request.privacy_version,
        language,
        bot_token: request.bot_token,
    })
}
