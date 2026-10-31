//! Deal `details` (§13 L-F6): the workbook's free-text Deals columns that have no typed
//! column, as strings only, within ~16 KB. Everything else is refused.
use crate::error::{ApiError, ApiResult};
use serde_json::{Map, Value};

pub const DETAILS: &str = "Provide valid deal details.";
pub const MAX_DETAILS_BYTES: usize = 16 * 1024;
const MAX_TEXT_CHARS: usize = 4000;

/// Workbook Deals columns kept as text (`src/data/schemas/deals.js`).
pub const KEYS: [&str; 15] = [
    "payment_due",
    "document_status",
    "documents_url",
    "notes",
    "opened_date",
    "target_close_date",
    "closed_date",
    "outcome_reason",
    "record_check",
    "pipeline_type",
    "pipeline_milestone",
    "current_blocker",
    "next_deal_action",
    "next_action_due",
    "lost_cancelled_reason",
];

/// An object of allowlisted keys with string values; empty strings are dropped.
pub fn parse(value: &Value) -> ApiResult<Map<String, Value>> {
    let Value::Object(map) = value else {
        return Err(ApiError::invalid(DETAILS));
    };
    let mut kept = Map::new();
    for (key, value) in map {
        let Value::String(text) = value else {
            return Err(ApiError::invalid(DETAILS));
        };
        if !KEYS.contains(&key.as_str()) || text.chars().count() > MAX_TEXT_CHARS {
            return Err(ApiError::invalid(DETAILS));
        }
        if !text.trim().is_empty() {
            kept.insert(key.clone(), Value::String(text.clone()));
        }
    }
    let size = serde_json::to_string(&kept).map_or(usize::MAX, |text| text.len());
    (size <= MAX_DETAILS_BYTES)
        .then_some(kept)
        .ok_or(ApiError::invalid(DETAILS))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_allowlisted_text_within_the_cap_is_kept() {
        let kept = parse(&json!({"notes": "Call", "pipeline_type": " ", "next_action_due": "x"}));
        assert_eq!(
            Value::Object(kept.unwrap()),
            json!({"notes": "Call", "next_action_due": "x"})
        );
        for refused in [
            json!({"assignee_id": "x"}),
            json!({"notes": 5}),
            json!({"notes": null}),
            json!({"notes": "x".repeat(4001)}),
            json!([]),
        ] {
            assert_eq!(parse(&refused).unwrap_err().1, DETAILS, "{refused}");
        }
        let big: Map<String, Value> = KEYS[..5]
            .iter()
            .map(|key| (key.to_string(), json!("é".repeat(1800))))
            .collect();
        assert!(parse(&Value::Object(big)).is_err(), "over 16 KB");
    }
}
