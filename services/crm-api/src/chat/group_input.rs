//! The body of `POST /chat/groups` (packet C3): the chosen colleagues and an optional name.
use crate::error::{ApiError, ApiResult};
use serde_json::Value;
use uuid::Uuid;

pub const MEMBERS: &str = "Choose 2–20 different colleagues in your company.";
const TITLE: &str = "Use a group name of up to 60 characters.";
/// 2–20 distinct colleague IDs, never the creator (who joins anyway).
pub fn members(value: Option<&Value>, creator: Uuid) -> ApiResult<Vec<Uuid>> {
    let Some(Value::Array(items)) = value else {
        return Err(ApiError::invalid(MEMBERS));
    };
    let ids: Vec<Uuid> = items
        .iter()
        .map(|item| item.as_str().and_then(|value| Uuid::parse_str(value).ok()))
        .collect::<Option<Vec<Uuid>>>()
        .filter(|ids| (2..=20).contains(&ids.len()) && !ids.contains(&creator))
        .ok_or(ApiError::invalid(MEMBERS))?;
    let mut unique = ids.clone();
    unique.sort();
    unique.dedup();
    (unique.len() == ids.len())
        .then_some(ids)
        .ok_or(ApiError::invalid(MEMBERS))
}

/// An optional plain name of up to 60 characters; blank means none (the screen then shows
/// the members' names).
pub fn title(value: Option<&Value>) -> ApiResult<Option<String>> {
    let text = match value {
        None | Some(Value::Null) => return Ok(None),
        Some(Value::String(text)) => text.trim(),
        Some(_) => return Err(ApiError::invalid(TITLE)),
    };
    if text.is_empty() {
        return Ok(None);
    }
    let plain = !text.chars().any(char::is_control);
    (plain && text.chars().count() <= 60)
        .then(|| Some(text.to_owned()))
        .ok_or(ApiError::invalid(TITLE))
}

#[cfg(test)]
mod tests {
    use super::{members, title};
    use serde_json::json;
    use uuid::Uuid;

    #[test]
    fn groups_have_two_to_twenty_distinct_colleagues_and_a_plain_name() {
        let me = Uuid::new_v4();
        let ids: Vec<String> = (0..21).map(|_| Uuid::new_v4().to_string()).collect();
        assert_eq!(members(Some(&json!(ids[..2])), me).unwrap().len(), 2);
        assert_eq!(members(Some(&json!(ids[..20])), me).unwrap().len(), 20);
        for bad in [
            json!(ids[..1]),
            json!(ids),
            json!([ids[0], ids[0]]),
            json!("x"),
        ] {
            assert!(members(Some(&bad), me).is_err());
        }
        assert!(members(Some(&json!([ids[0], me.to_string()])), me).is_err());
        assert_eq!(
            title(Some(&json!("  Marina team "))).unwrap().unwrap(),
            "Marina team"
        );
        assert_eq!(title(Some(&json!("   "))).unwrap(), None);
        assert_eq!(title(None).unwrap(), None);
        for bad in [json!("x".repeat(61)), json!("bell\u{0007}"), json!(5)] {
            assert!(title(Some(&bad)).is_err());
        }
    }
}
