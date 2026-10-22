//! Strict request bodies for saved replies (docs/saved-replies-drafts.md §4): exact keys,
//! a trimmed title of 1–80 characters on one line and plain text of 1–5,000 characters.
use crate::error::{ApiError, ApiResult};
use serde_json::{Map, Value};

pub const INVALID: &str =
    "Give the saved reply a title of up to 80 characters and text of up to 5,000.";

#[derive(Debug, PartialEq)]
pub enum Scope {
    Company,
    Mine,
}

#[derive(Debug, PartialEq)]
pub struct Text {
    pub title: String,
    pub body: String,
}

fn exact(body: Value, keys: &[&str]) -> ApiResult<Map<String, Value>> {
    match body {
        Value::Object(map)
            if map.len() == keys.len() && keys.iter().all(|k| map.contains_key(*k)) =>
        {
            Ok(map)
        }
        _ => Err(ApiError::invalid(INVALID)),
    }
}

/// Zero-width and text-direction marks that could disguise saved text (review L3).
fn invisible(c: char) -> bool {
    matches!(
        c,
        '\u{00AD}' | '\u{061C}' | '\u{180E}' | '\u{200B}'..='\u{200F}' | '\u{2028}'..='\u{202E}'
            | '\u{2060}'..='\u{2069}' | '\u{FEFF}' | '\u{E0000}'..='\u{E007F}'
    )
}

fn bounded(value: &Value, max: usize, one_line: bool) -> ApiResult<String> {
    let raw = value.as_str().unwrap_or_default().replace("\r\n", "\n");
    let text = raw.trim();
    let allowed =
        |c: char| !invisible(c) && (!c.is_control() || (!one_line && (c == '\n' || c == '\t')));
    let count = text.chars().count();
    if count == 0 || count > max || !text.chars().all(allowed) {
        return Err(ApiError::invalid(INVALID));
    }
    Ok(text.to_owned())
}

fn text(map: &Map<String, Value>) -> ApiResult<Text> {
    Ok(Text {
        title: bounded(&map["title"], 80, true)?,
        body: bounded(&map["body"], 5000, false)?,
    })
}

pub fn version(map: &Map<String, Value>) -> ApiResult<i32> {
    map["expectedVersion"]
        .as_i64()
        .and_then(|v| i32::try_from(v).ok())
        .filter(|v| *v > 0)
        .ok_or(ApiError::invalid(INVALID))
}

/// `{scope, title, body}` for a new saved reply.
pub fn create(body: Value) -> ApiResult<(Scope, Text)> {
    let map = exact(body, &["scope", "title", "body"])?;
    let scope = match map["scope"].as_str() {
        Some("company") => Scope::Company,
        Some("mine") => Scope::Mine,
        _ => return Err(ApiError::invalid(INVALID)),
    };
    Ok((scope, text(&map)?))
}

/// `{expectedVersion, title, body}` for an edit.
pub fn update(body: Value) -> ApiResult<(i32, Text)> {
    let map = exact(body, &["expectedVersion", "title", "body"])?;
    Ok((version(&map)?, text(&map)?))
}

/// `{expectedVersion}` for a removal.
pub fn remove(body: Value) -> ApiResult<i32> {
    version(&exact(body, &["expectedVersion"])?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn saved_replies_are_exact_bounded_plain_text() {
        let (scope, text) = create(
            json!({"scope": "mine", "title": "  Viewing ", "body": "Hi {client name},\r\nSee you"}),
        )
        .unwrap();
        assert_eq!(scope, Scope::Mine);
        assert_eq!(text.title, "Viewing");
        assert_eq!(text.body, "Hi {client name},\nSee you");
        for bad in [
            json!({"scope": "team", "title": "A", "body": "B"}),
            json!({"scope": "mine", "title": "", "body": "B"}),
            json!({"scope": "mine", "title": "A\nB", "body": "B"}),
            json!({"scope": "mine", "title": "x".repeat(81), "body": "B"}),
            json!({"scope": "mine", "title": "A", "body": "x".repeat(5001)}),
            json!({"scope": "mine", "title": "A", "body": "bell\u{7}"}),
            json!({"scope": "mine", "title": "A", "body": "pay \u{202E}NABI"}),
            json!({"scope": "mine", "title": "A", "body": "B", "owner": "x"}),
        ] {
            assert!(create(bad).is_err());
        }
        assert_eq!(
            update(json!({"expectedVersion": 2, "title": "A", "body": "B"}))
                .unwrap()
                .0,
            2
        );
        assert!(update(json!({"expectedVersion": 0, "title": "A", "body": "B"})).is_err());
        assert_eq!(remove(json!({"expectedVersion": 3})).unwrap(), 3);
        assert!(remove(json!({"expectedVersion": "3"})).is_err());
    }
}
