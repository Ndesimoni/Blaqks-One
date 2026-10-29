use super::model::{ProfileInput, SiteInput};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};

pub fn host(raw: &str) -> ApiResult<String> {
    let value = raw.trim().to_ascii_lowercase();
    if value.is_empty()
        || value.len() > 253
        || value.starts_with('.')
        || value.ends_with('.')
        || value.contains("..")
        || !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'.' || c == b'-')
    {
        return Err(ApiError::invalid(
            "Enter a valid website hostname without a scheme or port.",
        ));
    }
    Ok(value)
}
pub fn text(value: &str, max: usize) -> bool {
    !value.trim().is_empty()
        && value.chars().count() <= max
        && !value.chars().any(char::is_control)
        && !value.contains('<')
        && !value.contains('>')
}
pub fn site(input: &SiteInput) -> ApiResult<()> {
    if input.version < 0
        || !text(&input.name, 100)
        || !["1", "2", "3", "4"].contains(&input.theme.as_str())
    {
        return Err(ApiError::invalid(
            "Enter a site name, supported theme and current version.",
        ));
    }
    content(&input.content)?;
    Ok(())
}
fn content(value: &Value) -> ApiResult<()> {
    if value.is_null() {
        return Ok(());
    }
    let Some(object) = value.as_object() else {
        return Err(ApiError::invalid(
            "Website content must be structured fields.",
        ));
    };
    for (key, value) in object {
        if ![
            "tagline",
            "about",
            "services",
            "contactText",
            "heroTitle",
            "heroSubtitle",
            "seoTitle",
            "seoDescription",
        ]
        .contains(&key.as_str())
            || !value.as_str().is_some_and(|v| {
                !v.trim().is_empty()
                    && v.chars().count() <= 4000
                    && !v.contains(['<', '>'])
                    && !v
                        .chars()
                        .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
            })
        {
            return Err(ApiError::invalid(
                "Choose supported website content fields containing plain text.",
            ));
        }
    }
    Ok(())
}
pub fn company(value: Option<&Value>, name: &str) -> ApiResult<Value> {
    let empty = json!({});
    let value = value.unwrap_or(&empty);
    let Some(object) = value.as_object() else {
        return Err(ApiError::invalid(
            "Company details must be structured fields.",
        ));
    };
    if object
        .keys()
        .any(|k| !["mark", "area", "note"].contains(&k.as_str()))
    {
        return Err(ApiError::invalid("Choose public company fields only."));
    }
    let get = |key: &str, fallback: &str, max| -> ApiResult<String> {
        let value = value.get(key).and_then(Value::as_str).unwrap_or(fallback);
        if !text(value, max) {
            return Err(ApiError::invalid("Enter valid public company details."));
        }
        Ok(value.to_owned())
    };
    Ok(
        json!({"name":name,"mark":get("mark","CO",6)?,"area":get("area","UAE",80)?,"note":get("note","Property advice for your next move.",500)?}),
    )
}
pub fn profile(input: &ProfileInput) -> ApiResult<()> {
    if input.version < 0 || !text(&input.name, 100) || !text(&input.specialty, 200) {
        return Err(ApiError::invalid(
            "Enter a public name, specialty and current version.",
        ));
    }
    if input
        .public_whats_app
        .as_deref()
        .is_some_and(|v| !crate::auth::identity_rules::phone(v))
        || input
            .public_email
            .as_deref()
            .is_some_and(|v| !crate::auth::identity_rules::email(v) || v.contains(['<', '>']))
    {
        return Err(ApiError::invalid("Enter valid public contact methods."));
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn untrusted_hosts_and_content_are_refused() {
        for value in [
            "https://site.test",
            "site.test:3000",
            "x@site.test",
            "a..test",
        ] {
            assert!(host(value).is_err());
        }
        assert!(content(&json!({"script":"alert(1)"})).is_err());
        assert!(content(&json!({"about":"<script>"})).is_err());
        assert!(content(&json!({"about":"Plain public company story."})).is_ok());
    }
}
