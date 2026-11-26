//! Property photos and floor plans in private storage (packet F2). A record's media entries
//! name stored files (`file`, and `thumb` for photos); saving the record attaches the
//! caller's new uploads to it and hides files it no longer names, in the record's own
//! transaction. Older inline entries (`src`) stay as they are.
use crate::{error::ApiResult, media::owned};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const KIND: &str = "record";
pub const FIELDS: [&str; 2] = ["media_photos", "media_floorplans"];

/// Every stored file a payload names, in order and without repeats.
pub fn referenced(payload: &Value) -> Vec<Uuid> {
    let mut ids = Vec::new();
    for field in FIELDS {
        for asset in payload
            .get(field)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            for key in ["file", "thumb"] {
                let id = asset
                    .get(key)
                    .and_then(Value::as_str)
                    .and_then(|value| Uuid::parse_str(value).ok());
                if let Some(id) = id.filter(|id| !ids.contains(id)) {
                    ids.push(id);
                }
            }
        }
    }
    ids
}

/// Makes the record's attached files exactly the ones `wanted` names.
pub async fn sync(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    record: Uuid,
    wanted: &[Uuid],
) -> ApiResult<()> {
    let current = owned::ids(tx, KIND, record).await?;
    let new: Vec<Uuid> = wanted
        .iter()
        .filter(|id| !current.contains(id))
        .copied()
        .collect();
    if !new.is_empty() {
        owned::attach(tx, workspace, actor, &new, KIND, record).await?;
    }
    let gone: Vec<Uuid> = current
        .into_iter()
        .filter(|id| !wanted.contains(id))
        .collect();
    if !gone.is_empty() {
        owned::remove_ids(tx, KIND, record, &gone).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::referenced;
    use serde_json::json;

    #[test]
    fn stored_files_are_found_once_and_inline_media_is_ignored() {
        let a = "11111111-1111-4111-8111-111111111111";
        let b = "22222222-2222-4222-8222-222222222222";
        let payload = json!({
            "media_photos": [{"name": "front", "file": a, "thumb": b},
                             {"name": "old", "src": "data:image/jpeg;base64,AAA="}],
            "media_floorplans": [{"name": "plan", "file": a}],
        });
        let ids: Vec<String> = referenced(&payload)
            .iter()
            .map(|id| id.to_string())
            .collect();
        assert_eq!(ids, [a, b]);
    }
}
