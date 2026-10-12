use crate::error::{ApiError, ApiResult};
use serde_json::Value;

pub const MAX_RECORD_BYTES: usize = 12 * 1024 * 1024;

pub struct ValidatedRecord {
    pub payload: Value,
    pub legacy_id: String,
    pub contact_id: Option<String>,
}

pub fn collection_key(collection: &str) -> ApiResult<&'static str> {
    match collection {
        "Clients" => Ok("client_id"),
        "Contacts" => Ok("contact_id"),
        "Properties" => Ok("property_id"),
        _ => Err(ApiError::invalid("Unsupported record collection.")),
    }
}

pub fn validate(collection: &str, mut payload: Value) -> ApiResult<ValidatedRecord> {
    let id_key = collection_key(collection)?;
    if serde_json::to_vec(&payload)
        .map_err(|_| ApiError::invalid("Invalid record."))?
        .len()
        > MAX_RECORD_BYTES
    {
        return Err(ApiError::invalid("The record exceeds the size limit."));
    }
    let object = payload
        .as_object_mut()
        .ok_or_else(|| ApiError::invalid("Record must be an object."))?;
    for reserved in [
        "id",
        "workspace_id",
        "workspaceId",
        "owner_id",
        "ownerId",
        "actor_id",
        "actorId",
        "version",
        "approval",
        "approved_by",
        "published",
        "audit",
        "created_by",
    ] {
        if object.contains_key(reserved) {
            return Err(ApiError::invalid(
                "Server ownership and publication fields cannot be set.",
            ));
        }
    }
    let legacy_id = object
        .get(id_key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_owned();
    if legacy_id.is_empty() || legacy_id.len() > 128 {
        return Err(ApiError::invalid(
            "A record ID of 1 to 128 characters is required.",
        ));
    }
    object.insert(id_key.into(), Value::String(legacy_id.clone()));
    let contact_id = if collection == "Properties" {
        match object.get("contact_id") {
            None | Some(Value::Null) => None,
            Some(Value::String(value)) if value.trim().is_empty() => None,
            Some(Value::String(value)) if value.len() <= 128 => Some(value.trim().to_owned()),
            _ => return Err(ApiError::invalid("Contact ID must be a string.")),
        }
    } else {
        None
    };
    if let Some(contact) = &contact_id {
        object.insert("contact_id".into(), Value::String(contact.clone()));
    }
    super::validation_numbers::validate(collection, &payload)?;
    super::workbook_fields::validate(collection, &payload)?;
    super::media::validate(&payload)?;
    Ok(ValidatedRecord {
        payload,
        legacy_id,
        contact_id,
    })
}
