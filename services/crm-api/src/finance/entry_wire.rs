//! Strict payment and expense fields (finance-design §6.2, §13 L-F3, L-F5): whole fils
//! from 1 to the AED 10bn cap, trimmed free text with length limits, https receipt links
//! and dates no later than today in Asia/Dubai.
use super::{deals::fields::MAX_DEAL_FILS, errors::FUTURE_ENTRY};
use crate::error::{ApiError, ApiResult};
use serde_json::{Map, Value};

pub const MONEY: &str = "Amounts must be whole fils between AED 0.01 and AED 10,000,000,000.";
pub const RECEIPT: &str = "Enter a valid HTTPS receipt link.";
pub const ISSUED: &str = "Record IDs are issued by the server.";

/// The entry object holds only `allowed` keys and every `required` key.
pub fn keys<'a>(
    value: &'a Value,
    required: &[&str],
    allowed: &[&str],
    message: &'static str,
) -> ApiResult<&'a Map<String, Value>> {
    let Value::Object(map) = value else {
        return Err(ApiError::invalid(message));
    };
    let known = map
        .keys()
        .all(|key| required.contains(&key.as_str()) || allowed.contains(&key.as_str()));
    let complete = required.iter().all(|key| map.contains_key(*key));
    (known && complete)
        .then_some(map)
        .ok_or(ApiError::invalid(message))
}

pub fn amount(value: &Value) -> ApiResult<i64> {
    value
        .as_i64()
        .filter(|fils| (1..=MAX_DEAL_FILS).contains(fils))
        .ok_or(ApiError::invalid(MONEY))
}

/// Optional free text: absent, `null` or blank is none; otherwise trimmed, ≤ `max` chars.
pub fn text(value: Option<&Value>, max: usize, message: &'static str) -> ApiResult<Option<String>> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) if text.trim().is_empty() => Ok(None),
        Some(Value::String(text)) if text.trim().chars().count() <= max => {
            Ok(Some(text.trim().to_string()))
        }
        _ => Err(ApiError::invalid(message)),
    }
}

/// §13 L-F5: `https://host/…` only, ≤ 2048 characters, no credentials, spaces or quotes.
pub fn receipt_url(value: Option<&Value>) -> ApiResult<Option<String>> {
    let Some(url) = text(value, 2048, RECEIPT)? else {
        return Ok(None);
    };
    let rest = url.strip_prefix("https://").unwrap_or("");
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host_ok = host
        .chars()
        .next()
        .is_some_and(|first| first.is_ascii_alphanumeric())
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':'));
    let safe = url
        .chars()
        .all(|c| !c.is_whitespace() && !c.is_control() && !matches!(c, '"' | '<' | '>' | '\\'));
    (host_ok && safe)
        .then_some(Some(url))
        .ok_or(ApiError::invalid(RECEIPT))
}

pub fn not_future(date: &str, today: &str) -> ApiResult<()> {
    (date <= today)
        .then_some(())
        .ok_or(ApiError::invalid(FUTURE_ENTRY))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn amounts_are_whole_positive_fils_within_the_cap() {
        assert_eq!(amount(&json!(1)).unwrap(), 1);
        assert_eq!(amount(&json!(MAX_DEAL_FILS)).unwrap(), MAX_DEAL_FILS);
        for bad in [
            json!(0),
            json!(-5),
            json!(1.5),
            json!("100"),
            json!(MAX_DEAL_FILS + 1),
        ] {
            assert_eq!(amount(&bad).unwrap_err().1, MONEY, "{bad}");
        }
    }

    #[test]
    fn receipt_links_are_https_only() {
        let ok = |url: &str| receipt_url(Some(&json!(url))).unwrap();
        assert!(ok("https://files.example.test/r/1.pdf?x=1").is_some());
        assert_eq!(ok("  "), None);
        assert_eq!(receipt_url(None).unwrap(), None);
        for bad in [
            "http://files.example.test/r.pdf",
            "javascript:alert(1)",
            "https://",
            "https://user:pw@files.example.test/r.pdf",
            "https://files.example.test/a b",
            "https://files.example.test/\"x",
            "ftp://files.example.test",
        ] {
            assert_eq!(
                receipt_url(Some(&json!(bad))).unwrap_err().1,
                RECEIPT,
                "{bad}"
            );
        }
        let long = format!("https://a.test/{}", "x".repeat(2040));
        assert!(receipt_url(Some(&json!(long))).is_err());
    }

    #[test]
    fn text_keys_and_dates_are_strict() {
        assert_eq!(
            text(Some(&json!("  a ")), 3, "m").unwrap(),
            Some("a".into())
        );
        assert!(text(Some(&json!("abcd")), 3, "m").is_err());
        assert!(text(Some(&json!(5)), 3, "m").is_err());
        let body = json!({"a": 1, "b": 2});
        assert!(keys(&body, &["a"], &["b"], "m").is_ok());
        assert!(keys(&body, &["a", "c"], &["b"], "m").is_err());
        assert!(keys(&body, &["a"], &[], "m").is_err());
        assert!(not_future("2026-10-14", "2026-10-14").is_ok());
        assert_eq!(
            not_future("2026-10-15", "2026-10-14").unwrap_err().1,
            FUTURE_ENTRY
        );
    }
}
