//! The pure WhatsApp sending rules (design §5): the 24-hour window with ten minutes'
//! margin, measured by the server clock; free text of 1–4,096 characters; and template
//! variables of 1–200 characters without line breaks, tabs or four spaces in a row, which
//! WhatsApp refuses. Values are plain text; the adapter builds the JSON.
use crate::error::{ApiError, ApiResult};
use serde_json::Value;

/// Free text is allowed while the client's last message is under 23 h 50 min old.
pub const WINDOW_SECONDS: i64 = 23 * 3600 + 50 * 60;
pub const TEXT: &str = "Write a WhatsApp message of up to 4,096 characters.";
pub const VARIABLES: &str =
    "Fill in each template variable: 1 to 200 characters, without line breaks, tabs or four spaces in a row.";
pub const TEMPLATE: &str = "Choose an approved WhatsApp template.";

/// When the window closes, while it is open at `now` (Unix seconds); else `None`.
pub fn window(last_inbound: Option<i64>, now: i64) -> Option<i64> {
    let end = last_inbound?.checked_add(WINDOW_SECONDS)?;
    (now < end).then_some(end)
}

/// The window's end as the API shows it.
pub fn until(end: i64) -> Option<String> {
    let at = time::OffsetDateTime::from_unix_timestamp(end).ok()?;
    at.format(&time::format_description::well_known::Rfc3339)
        .ok()
}

/// A free-text message, trimmed at the ends.
pub fn text(value: &str) -> ApiResult<String> {
    let text = value.trim();
    let ok = (1..=4096).contains(&text.chars().count()) && !text.contains('\0');
    ok.then(|| text.to_owned()).ok_or(ApiError::invalid(TEXT))
}

/// One variable, trimmed at the ends.
pub fn variable(value: &str) -> Option<String> {
    let value = value.trim();
    let ok = (1..=200).contains(&value.chars().count())
        && !value.chars().any(char::is_control)
        && !value.contains("    ");
    ok.then(|| value.to_owned())
}

/// The template choice `{id, variables}`: an `HX` ID and at most ten valid values.
pub fn template(value: &Value) -> ApiResult<(String, Vec<String>)> {
    let map = value
        .as_object()
        .filter(|map| map.len() == 2 && map.contains_key("id") && map.contains_key("variables"));
    let Some(map) = map else {
        return Err(ApiError::invalid(TEMPLATE));
    };
    let id = map["id"]
        .as_str()
        .filter(|id| id.len() == 34 && id.starts_with("HX"))
        .ok_or(ApiError::invalid(TEMPLATE))?;
    let values = map["variables"]
        .as_array()
        .filter(|values| values.len() <= 10)
        .ok_or(ApiError::invalid(VARIABLES))?;
    let variables: Option<Vec<String>> = values
        .iter()
        .map(|value| value.as_str().and_then(variable))
        .collect();
    Ok((
        id.to_owned(),
        variables.ok_or(ApiError::invalid(VARIABLES))?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_window_closes_ten_minutes_before_whatsapps() {
        let last = 1_000_000;
        assert_eq!(window(None, last), None);
        assert_eq!(window(Some(last), last), Some(last + WINDOW_SECONDS));
        assert!(window(Some(last), last + WINDOW_SECONDS - 1).is_some());
        assert_eq!(window(Some(last), last + WINDOW_SECONDS), None);
        assert_eq!(window(Some(last), last + 24 * 3600), None);
        assert_eq!(window(Some(i64::MAX), 0), None);
        assert_eq!(until(0).as_deref(), Some("1970-01-01T00:00:00Z"));
    }

    #[test]
    fn free_text_is_one_to_4096_characters() {
        assert_eq!(text("  Hello  ").unwrap(), "Hello");
        assert!(text(&"é".repeat(4096)).is_ok());
        for refused in ["", "   ", "a\0b"] {
            assert!(text(refused).is_err(), "{refused:?}");
        }
        assert!(text(&"a".repeat(4097)).is_err());
    }

    #[test]
    fn variables_follow_whatsapps_whitespace_rules() {
        assert_eq!(variable(" Sara ").as_deref(), Some("Sara"));
        assert_eq!(
            variable("Two  or three   spaces").as_deref(),
            Some("Two  or three   spaces")
        );
        assert!(variable(&"a".repeat(200)).is_some());
        let long = "a".repeat(201);
        for refused in [
            "",
            "  ",
            "line\nbreak",
            "car\rriage",
            "tab\there",
            "four    spaces",
            &long,
        ] {
            assert!(variable(refused).is_none(), "{refused:?}");
        }
        let sid = format!("HX{}", "0".repeat(32));
        let (id, values) = template(&json!({"id": sid, "variables": ["Sara", " 5 pm "]})).unwrap();
        assert_eq!(
            (id.as_str(), values),
            (sid.as_str(), vec!["Sara".into(), "5 pm".into()])
        );
        assert_eq!(
            template(&json!({"id": sid, "variables": []}))
                .unwrap()
                .1
                .len(),
            0
        );
        for refused in [
            json!({"id": "HX1", "variables": []}),
            json!({"id": sid, "variables": ["ok", 5]}),
            json!({"id": sid, "variables": ["a\tb"]}),
            json!({"id": sid, "variables": vec!["a"; 11]}),
            json!({"id": sid}),
            json!({"id": sid, "variables": [], "language": "en"}),
            json!("HX"),
        ] {
            assert!(template(&refused).is_err(), "{refused}");
        }
    }
}
