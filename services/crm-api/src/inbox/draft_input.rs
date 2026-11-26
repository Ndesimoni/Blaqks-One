//! The body of a draft save (docs/saved-replies-drafts.md §4): exactly `{body, baseRevision}`,
//! text of up to 20,000 characters (the reply limit) and a revision of 0 or more.
use crate::error::{ApiError, ApiResult};
use serde_json::Value;

pub const DRAFT: &str = "Write a reply of up to 20,000 characters.";

/// `{body, baseRevision}`: blank text clears the draft.
pub fn input(body: Value) -> ApiResult<(Option<String>, i64)> {
    let Value::Object(map) = body else {
        return Err(ApiError::invalid(DRAFT));
    };
    let text = map.get("body").and_then(Value::as_str);
    let base = map.get("baseRevision").and_then(Value::as_i64);
    match (map.len(), text, base) {
        // A NUL cannot be stored in PostgreSQL text: refused here, not a server error.
        (2, Some(text), Some(base))
            if base >= 0 && text.chars().count() <= 20000 && !text.contains('\0') =>
        {
            Ok(((!text.trim().is_empty()).then(|| text.to_owned()), base))
        }
        _ => Err(ApiError::invalid(DRAFT)),
    }
}

#[cfg(test)]
mod tests {
    use super::input;
    use serde_json::json;

    #[test]
    fn drafts_are_bounded_text_on_a_known_revision() {
        let saved = input(json!({"body": " Hello\n", "baseRevision": 2})).unwrap();
        assert_eq!(saved, (Some(" Hello\n".to_owned()), 2));
        assert_eq!(
            input(json!({"body": "  ", "baseRevision": 0})).unwrap(),
            (None, 0)
        );
        for bad in [
            json!({"body": "x", "baseRevision": -1}),
            json!({"body": "x".repeat(20001), "baseRevision": 0}),
            json!({"body": "x", "baseRevision": 0, "send": true}),
            json!({"body": 5, "baseRevision": 0}),
            json!("x"),
            json!({"body": "a\u{0}b", "baseRevision": 0}),
        ] {
            assert!(input(bad).is_err());
        }
    }
}
