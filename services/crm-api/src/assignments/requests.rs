use crate::{
    error::{ApiError, ApiResult},
    records::visibility::ASSIGNABLE,
};
use serde::{Deserialize, Deserializer};
use uuid::Uuid;

pub const MAX_NOTE_CHARS: usize = 1000;
pub const MAX_BULK_RECORDS: usize = 500;
pub const MAX_BULK_BYTES: usize = 64 * 1024;

/// `PUT …/assignee`. `assigneeId` must be present; `null` sends the record to the queue.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssignRequest {
    pub version: i64,
    #[serde(default, deserialize_with = "present")]
    pub assignee_id: Option<Option<Uuid>>,
    pub note: Option<String>,
}

/// `POST …/assignments/bulk`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BulkRequest {
    #[serde(default, deserialize_with = "present")]
    pub to_id: Option<Option<Uuid>>,
    pub note: Option<String>,
    pub records: Vec<BulkRecord>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BulkRecord {
    pub collection: String,
    pub id: Uuid,
    pub version: i64,
}

/// Distinguishes an explicit `null` from a missing key.
fn present<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<Option<Uuid>>, D::Error> {
    Option::<Uuid>::deserialize(deserializer).map(Some)
}

/// The required target: a member, or `None` for the Admin queue.
pub fn target(value: Option<Option<Uuid>>) -> ApiResult<Option<Uuid>> {
    value.ok_or_else(|| ApiError::invalid("Choose who should hold this record."))
}

/// Trims an optional hand-off note; empty means none. Never echoed in errors or logs.
pub fn note(value: Option<String>) -> ApiResult<Option<String>> {
    let Some(text) = value.map(|text| text.trim().to_owned()) else {
        return Ok(None);
    };
    if text.chars().count() > MAX_NOTE_CHARS {
        return Err(ApiError::invalid(
            "Hand-off notes are limited to 1000 characters.",
        ));
    }
    Ok((!text.is_empty()).then_some(text))
}

pub fn ensure_assignable(collection: &str) -> ApiResult<()> {
    if !ASSIGNABLE.contains(&collection) {
        return Err(ApiError::invalid("This record type cannot be assigned."));
    }
    Ok(())
}

pub fn ensure_version(version: i64) -> ApiResult<()> {
    if version < 1 {
        return Err(ApiError::invalid("A positive record version is required."));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_require_a_target_and_bound_their_notes() {
        let queued: AssignRequest =
            serde_json::from_str(r#"{"version":1,"assigneeId":null}"#).unwrap();
        assert_eq!(target(queued.assignee_id).unwrap(), None);
        let missing: AssignRequest = serde_json::from_str(r#"{"version":1}"#).unwrap();
        assert!(target(missing.assignee_id).is_err());
        assert!(serde_json::from_str::<AssignRequest>(r#"{"version":1,"x":1}"#).is_err());
        assert_eq!(note(Some("  ".into())).unwrap(), None);
        assert_eq!(
            note(Some(" Call ".into())).unwrap().as_deref(),
            Some("Call")
        );
        assert!(note(Some("é".repeat(1000))).unwrap().is_some());
        assert!(note(Some("x".repeat(1001))).is_err());
        assert!(ensure_assignable("Viewings").is_err());
        assert!(ensure_assignable("Follow-ups").is_ok());
        assert!(ensure_version(0).is_err());
    }
}
