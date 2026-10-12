use crate::error::{ApiError, ApiResult};
use serde_json::Value;

pub fn reject(value: &Value) -> ApiResult<()> {
    match value {
        Value::Object(fields) => {
            for (key, value) in fields {
                let normalized: String = key
                    .chars()
                    .filter(char::is_ascii_alphanumeric)
                    .flat_map(char::to_lowercase)
                    .collect();
                if matches!(
                    normalized.as_str(),
                    "password"
                        | "passwordhash"
                        | "accesstoken"
                        | "refreshtoken"
                        | "providertoken"
                        | "csrftoken"
                        | "sessiontoken"
                ) {
                    return Err(ApiError::invalid(
                        "Credentials and provider tokens cannot be imported.",
                    ));
                }
                reject(value)?;
            }
        }
        Value::Array(values) => {
            for value in values {
                reject(value)?;
            }
        }
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rejects_nested_credentials_but_preserves_business_metadata() {
        for key in [
            "password",
            "passwordHash",
            "password_hash",
            "access_token",
            "refresh_token",
            "provider_token",
            "csrfToken",
            "sessionToken",
        ] {
            assert!(reject(&json!({"extra":[{key:"do-not-import"}]})).is_err());
        }
        assert!(reject(&json!({"extra":{"business_code":"keep", "private_note":"keep"}})).is_ok());
    }
}
