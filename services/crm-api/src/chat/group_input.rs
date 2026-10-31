//! The body of `POST /chat/groups` (packet C3): the chosen colleagues and an optional name.
//! Adding people later (`participants.rs`) reads its colleague list the same way.
use crate::error::{ApiError, ApiResult};
use serde_json::Value;
use std::ops::RangeInclusive;
use uuid::Uuid;

pub const MEMBERS: &str = "Choose 2–20 different colleagues in your company.";
const TITLE: &str = "Use a group name of up to 60 characters.";

/// Distinct colleague IDs, never the actor, as many as `count` allows; else `message`.
pub fn colleagues(
    value: Option<&Value>,
    actor: Uuid,
    count: RangeInclusive<usize>,
    message: &'static str,
) -> ApiResult<Vec<Uuid>> {
    let Some(Value::Array(items)) = value else {
        return Err(ApiError::invalid(message));
    };
    let ids: Vec<Uuid> = items
        .iter()
        .map(|item| item.as_str().and_then(|value| Uuid::parse_str(value).ok()))
        .collect::<Option<Vec<Uuid>>>()
        .filter(|ids| count.contains(&ids.len()) && !ids.contains(&actor))
        .ok_or(ApiError::invalid(message))?;
    let mut unique = ids.clone();
    unique.sort();
    unique.dedup();
    (unique.len() == ids.len())
        .then_some(ids)
        .ok_or(ApiError::invalid(message))
}

/// 2–20 distinct colleague IDs, never the creator (who joins anyway).
pub fn members(value: Option<&Value>, creator: Uuid) -> ApiResult<Vec<Uuid>> {
    colleagues(value, creator, 2..=20, MEMBERS)
}

/// Zero-width and text-direction marks that could disguise a name (C3 review L1).
fn invisible(c: char) -> bool {
    matches!(
        c,
        '\u{00AD}' | '\u{061C}' | '\u{180E}' | '\u{200B}'..='\u{200F}' | '\u{2028}'..='\u{202E}'
            | '\u{2060}'..='\u{2069}' | '\u{FEFF}' | '\u{E0000}'..='\u{E007F}'
    )
}

/// An optional plain name of up to 60 characters; blank means none (the screen then shows
/// the members' names). It may not start with "#", so a group never looks like a channel.
pub fn title(value: Option<&Value>) -> ApiResult<Option<String>> {
    let text = match value {
        None | Some(Value::Null) => return Ok(None),
        Some(Value::String(text)) => text.trim(),
        Some(_) => return Err(ApiError::invalid(TITLE)),
    };
    if text.is_empty() {
        return Ok(None);
    }
    let plain = !text.starts_with('#') && !text.chars().any(|c| c.is_control() || invisible(c));
    (plain && text.chars().count() <= 60)
        .then(|| Some(text.to_owned()))
        .ok_or(ApiError::invalid(TITLE))
}

#[cfg(test)]
mod tests {
    use super::{colleagues, members, title};
    use serde_json::json;
    use uuid::Uuid;

    #[test]
    fn added_colleagues_are_distinct_and_never_the_actor() {
        let (actor, person) = (Uuid::new_v4(), Uuid::new_v4());
        let add = |value| colleagues(Some(&value), actor, 1..=20, "x");
        assert_eq!(add(json!([person])).unwrap(), vec![person]);
        assert!(add(json!([])).is_err());
        assert!(add(json!([person, person])).is_err());
        assert!(add(json!([actor])).is_err());
    }

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
        for bad in [
            json!("x".repeat(61)),
            json!("bell\u{0007}"),
            json!(5),
            json!("\u{200B}"),
            json!("a\u{202E}b"),
            json!("#general"),
        ] {
            assert!(title(Some(&bad)).is_err());
        }
    }
}
