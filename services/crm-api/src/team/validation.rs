use crate::error::{ApiError, ApiResult};

pub fn phone(value: &str) -> bool {
    value.starts_with('+')
        && (8..=16).contains(&value.len())
        && value[1..]
            .chars()
            .all(|character| character.is_ascii_digit())
}

pub fn identity(name: &str, email: &str, number: &str) -> ApiResult<()> {
    let valid_email = email.split_once('@').is_some_and(|(local, host)| {
        !local.is_empty() && host.contains('.') && !host.contains('@')
    });
    if name.trim().is_empty()
        || name.len() > 100
        || email.len() > 254
        || !valid_email
        || email.chars().any(char::is_whitespace)
        || !phone(number)
    {
        return Err(ApiError::invalid(
            "Provide a name, valid email and international phone.",
        ));
    }
    Ok(())
}
