use crate::error::{ApiError, ApiResult};
use serde_json::Value;
use url::Url;

pub const MAP_LINK_MESSAGE: &str = "Enter a complete http:// or https:// map link.";
pub const MAX_MAP_LINK_LENGTH: usize = 2048;

/// Contact map links must be absolute web URLs; absent, null or blank values are allowed.
pub fn validate(collection: &str, payload: &Value) -> ApiResult<()> {
    if collection != "Contacts" {
        return Ok(());
    }
    match payload.get("map_link") {
        None | Some(Value::Null) => Ok(()),
        Some(Value::String(link)) if link.trim().is_empty() => Ok(()),
        Some(Value::String(link)) if valid(link.trim()) => Ok(()),
        _ => Err(ApiError::invalid(MAP_LINK_MESSAGE)),
    }
}

fn valid(link: &str) -> bool {
    if link.len() > MAX_MAP_LINK_LENGTH || !link.contains("://") {
        return false;
    }
    Url::parse(link).is_ok_and(|url| {
        matches!(url.scheme(), "http" | "https")
            && url.host_str().is_some_and(|host| !host.is_empty())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn check(link: Value) -> ApiResult<()> {
        validate("Contacts", &json!({"contact_id":"CT-1","map_link":link}))
    }

    #[test]
    fn accepts_absolute_web_links_and_blank_values() {
        for link in [
            json!("https://maps.google.com/?q=25.08,55.14"),
            json!(" http://maps.app.goo.gl/abc "),
            json!(""),
            json!("   "),
            json!(null),
        ] {
            assert!(check(link).is_ok());
        }
        assert!(validate("Contacts", &json!({"contact_id":"CT-1"})).is_ok());
    }

    #[test]
    fn rejects_unsafe_relative_schemeless_and_oversized_links() {
        let long = format!(
            "https://maps.google.com/?q={}",
            "a".repeat(MAX_MAP_LINK_LENGTH)
        );
        for link in [
            json!("javascript:alert(1)"),
            json!("data:text/html;base64,PHNjcmlwdD4="),
            json!("www.google.com/maps"),
            json!("/maps/place"),
            json!("http:maps.google.com"),
            json!("ftp://maps.google.com"),
            json!("https://"),
            json!(long),
            json!(["https://maps.google.com"]),
            json!({"href":"https://maps.google.com"}),
            json!(7),
        ] {
            let error = check(link).unwrap_err();
            assert_eq!(error.1, MAP_LINK_MESSAGE);
        }
    }

    #[test]
    fn leaves_other_collections_unchanged() {
        let payload = json!({"property_id":"PR-1","map_link":"not a link"});
        assert!(validate("Properties", &payload).is_ok());
    }
}
