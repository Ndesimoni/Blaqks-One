//! Mentions in channels and groups (packet C3). The sender names colleagues by user ID with
//! the message; the server checks that each may see the room and stores the IDs, never
//! parsing names from the text. A mention counts for its member until they read the room
//! (`counts::MENTIONS`). Direct conversations take no mentions.
use super::access::{Room, Tx};
use crate::error::{ApiError, ApiResult};
use serde_json::{Map, Value};
use uuid::Uuid;

const LIMIT: usize = 20;
pub const INVALID: &str = "Mention up to 20 different colleagues who can see this conversation.";
const DIRECT: &str = "Mentions are for channels and groups.";

/// The mentioned member IDs in a request body; an absent `mentions` means none.
pub fn parse(map: &Map<String, Value>) -> ApiResult<Vec<Uuid>> {
    let ids: Vec<Uuid> = match map.get("mentions") {
        None => return Ok(Vec::new()),
        Some(Value::Array(items)) if items.len() <= LIMIT => items
            .iter()
            .map(|item| item.as_str().and_then(|value| Uuid::parse_str(value).ok()))
            .collect::<Option<Vec<Uuid>>>()
            .ok_or(ApiError::invalid(INVALID))?,
        Some(_) => return Err(ApiError::invalid(INVALID)),
    };
    let mut unique = ids.clone();
    unique.sort();
    unique.dedup();
    if unique.len() != ids.len() {
        return Err(ApiError::invalid(INVALID));
    }
    Ok(ids)
}

/// Call under the company lock: every mentioned member must see the room now — in a
/// channel, any live member of the company; in a group, its live participants.
pub async fn check(tx: &mut Tx<'_>, workspace: &str, room: &Room, ids: &[Uuid]) -> ApiResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    if room.kind == "direct" {
        return Err(ApiError::invalid(DIRECT));
    }
    let valid: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM crm_user_profiles u WHERE u.id=ANY($1) AND u.workspace_id=$2 \
         AND u.active AND u.owner_active AND u.role<>'super-admin' AND ($3='channel' OR \
         EXISTS (SELECT 1 FROM chat.crm_chat_participants p \
                 WHERE p.room_id=$4 AND p.member_id=u.id))",
    )
    .bind(ids)
    .bind(workspace)
    .bind(&room.kind)
    .bind(room.id)
    .fetch_one(&mut **tx)
    .await?;
    if valid != ids.len() as i64 {
        return Err(ApiError::invalid(INVALID));
    }
    Ok(())
}

/// Replaces the message's mentions with `ids` (none removes them).
pub async fn store(tx: &mut Tx<'_>, room: Uuid, message: Uuid, ids: &[Uuid]) -> ApiResult<()> {
    sqlx::query("DELETE FROM chat.crm_chat_mentions WHERE message_id=$1")
        .bind(message)
        .execute(&mut **tx)
        .await?;
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO chat.crm_chat_mentions (message_id,room_id,member_id) \
         SELECT $1,$2,unnest($3::uuid[])",
    )
    .bind(message)
    .bind(room)
    .bind(ids)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The (message, member) pairs for a page of messages, in one query.
pub async fn of(tx: &mut Tx<'_>, messages: &[Uuid]) -> ApiResult<Vec<(Uuid, Uuid)>> {
    Ok(sqlx::query_as(
        "SELECT message_id,member_id FROM chat.crm_chat_mentions \
         WHERE message_id=ANY($1) ORDER BY message_id,member_id",
    )
    .bind(messages)
    .fetch_all(&mut **tx)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::parse;
    use serde_json::{json, Value};

    fn body(value: Value) -> serde_json::Map<String, Value> {
        json!({ "body": "Hi", "mentions": value })
            .as_object()
            .unwrap()
            .clone()
    }

    #[test]
    fn mentions_are_distinct_ids_and_bounded() {
        let id = "8b0e6a52-58f4-4b0c-9a4b-5d1f2f2a7c11";
        assert_eq!(parse(&body(json!([id]))).unwrap().len(), 1);
        assert!(parse(&body(json!([]))).unwrap().is_empty());
        let none = json!({ "body": "Hi" }).as_object().unwrap().clone();
        assert!(parse(&none).unwrap().is_empty());
        let many: Vec<String> = (0..21).map(|_| uuid::Uuid::new_v4().to_string()).collect();
        for bad in [json!([id, id]), json!(["Sam"]), json!(id), json!(many)] {
            assert!(parse(&body(bad)).is_err());
        }
    }
}
