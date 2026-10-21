//! Strict request bodies (exact keys, bounded text) and the shared writes for chat.
use super::access::Tx;
use crate::error::{ApiError, ApiResult};
use axum::{extract::rejection::JsonRejection, Json};
use serde_json::{Map, Value};
use uuid::Uuid;

pub const BODY: &str = "Write a message of up to 4,000 characters.";
const FILES: &str = "Attach up to 10 different files.";
pub const STAMP: &str =
    "to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";

pub fn exact(
    body: Result<Json<Value>, JsonRejection>,
    keys: &[&str],
    message: &'static str,
) -> ApiResult<Map<String, Value>> {
    let Ok(Json(Value::Object(map))) = body else {
        return Err(ApiError::invalid(message));
    };
    let complete = map.len() == keys.len() && keys.iter().all(|key| map.contains_key(*key));
    complete.then_some(map).ok_or(ApiError::invalid(message))
}

/// A message text: trimmed at the ends, 1–4,000 characters, no control characters except
/// line breaks and tabs.
pub fn text(map: &Map<String, Value>) -> ApiResult<String> {
    let value = map
        .get("body")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default();
    let clean = !value
        .chars()
        .any(|c| c.is_control() && c != '\n' && c != '\t');
    let sized = (1..=4000).contains(&value.chars().count());
    (clean && sized)
        .then(|| value.to_owned())
        .ok_or(ApiError::invalid(BODY))
}

/// A new message: text, or files, or both (`attachments`: up to 10 upload IDs).
pub fn outgoing(map: &Map<String, Value>) -> ApiResult<(String, Vec<Uuid>)> {
    let ids: Vec<Uuid> = match map.get("attachments") {
        None => Vec::new(),
        Some(Value::Array(items)) if items.len() <= 10 => items
            .iter()
            .map(|item| item.as_str().and_then(|value| Uuid::parse_str(value).ok()))
            .collect::<Option<Vec<Uuid>>>()
            .ok_or(ApiError::invalid(FILES))?,
        Some(_) => return Err(ApiError::invalid(FILES)),
    };
    let mut unique = ids.clone();
    unique.sort();
    unique.dedup();
    if unique.len() != ids.len() {
        return Err(ApiError::invalid(FILES));
    }
    let blank = map
        .get("body")
        .and_then(Value::as_str)
        .is_some_and(|text| text.trim().is_empty());
    if blank && !ids.is_empty() {
        return Ok((String::new(), ids));
    }
    Ok((text(map)?, ids))
}

/// Creates a direct conversation and its two participants in the caller's transaction.
pub async fn open_direct(
    tx: &mut Tx<'_>,
    workspace: &str,
    key: &str,
    actor: Uuid,
    members: [Uuid; 2],
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO chat.crm_chat_rooms (id,workspace_id,kind,direct_key,created_by) \
         VALUES ($1,$2,'direct',$3,$4)",
    )
    .bind(id)
    .bind(workspace)
    .bind(key)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "INSERT INTO chat.crm_chat_participants (room_id,member_id) \
         SELECT $1,unnest($2::uuid[])",
    )
    .bind(id)
    .bind(&members[..])
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn message_text_is_trimmed_bounded_and_plain() {
        let map = |value: Value| json!({ "body": value }).as_object().unwrap().clone();
        assert_eq!(
            text(&map(json!("  Hi team\nline two "))).unwrap(),
            "Hi team\nline two"
        );
        for bad in [
            json!("   "),
            json!("x".repeat(4001)),
            json!("bell\u{0007}"),
            json!(5),
        ] {
            assert!(text(&map(bad)).is_err());
        }
    }
}
