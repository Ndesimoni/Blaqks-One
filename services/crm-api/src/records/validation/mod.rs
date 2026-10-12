pub mod media;
pub mod numbers;
pub mod reserved;
pub mod workbook_fields;
pub mod workflow_fields;

use super::collections::{self, Links};
use crate::error::{ApiError, ApiResult};
use serde_json::{Map, Value};

pub use reserved::RESERVED_KEYS;

pub const MAX_RECORD_BYTES: usize = 12 * 1024 * 1024;

pub struct ValidatedRecord {
    pub payload: Value,
    pub legacy_id: String,
    pub links: Links,
}

pub fn collection_key(collection: &str) -> ApiResult<&'static str> {
    Ok(collections::find(collection)?.id_key)
}

impl ValidatedRecord {
    /// Stores a server-issued ID (L1) in both the payload and the legacy ID.
    pub fn issue_id(&mut self, collection: &str, id: String) -> ApiResult<()> {
        let key = collection_key(collection)?;
        self.payload[key] = Value::String(id.clone());
        self.legacy_id = id;
        Ok(())
    }
}

/// Validates a record whose ID is required (updates and imports).
pub fn validate(collection: &str, payload: Value) -> ApiResult<ValidatedRecord> {
    validate_with(collection, payload, false)
}

/// Create variant: a missing or blank ID leaves `legacy_id` empty for the server to issue.
pub fn validate_new(collection: &str, payload: Value) -> ApiResult<ValidatedRecord> {
    validate_with(collection, payload, true)
}

fn validate_with(
    collection: &str,
    mut payload: Value,
    optional: bool,
) -> ApiResult<ValidatedRecord> {
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
    for reserved in RESERVED_KEYS {
        if object.contains_key(*reserved) {
            return Err(ApiError::invalid(
                "Server ownership and publication fields cannot be set.",
            ));
        }
    }
    let supplied = object.get(id_key).filter(|value| !value.is_null());
    let legacy_id = supplied
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_owned();
    let issued = optional && legacy_id.is_empty() && supplied.is_none_or(Value::is_string);
    if !issued && (legacy_id.is_empty() || legacy_id.len() > 128) {
        return Err(ApiError::invalid(
            "A record ID of 1 to 128 characters is required.",
        ));
    }
    if issued {
        object.remove(id_key);
    } else {
        object.insert(id_key.into(), Value::String(legacy_id.clone()));
    }
    let links = links(collection, object)?;
    if collection == "Clients"
        && !legacy_id.is_empty()
        && links.referral.as_deref() == Some(legacy_id.as_str())
    {
        return Err(ApiError::invalid(
            "A client cannot be recorded as their own referrer.",
        ));
    }
    numbers::validate(collection, &payload)?;
    workbook_fields::validate(collection, &payload)?;
    media::validate(&payload)?;
    Ok(ValidatedRecord {
        payload,
        legacy_id,
        links,
    })
}

fn links(collection: &str, object: &mut Map<String, Value>) -> ApiResult<Links> {
    let mut links = Links::default();
    for link in collections::find(collection)?.links {
        let value = match object.get(link.field) {
            None | Some(Value::Null) => None,
            Some(Value::String(value)) if value.trim().is_empty() => None,
            Some(Value::String(value)) if value.trim().len() <= 128 => {
                Some(value.trim().to_owned())
            }
            _ => return Err(ApiError::invalid("Linked record IDs must be strings.")),
        };
        if let Some(id) = &value {
            object.insert(link.field.into(), Value::String(id.clone()));
        }
        links.set(link.slot, value);
    }
    Ok(links)
}
