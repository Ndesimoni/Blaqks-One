//! Recognising an inline media entry saved before packet F2 (`{name, src, type?, added?}`
//! with a base64 data URL) and writing its stored replacement `{name, file, type, added?}`,
//! the shape F2 writes (without `thumb`: the server has no image resizer, and the browser
//! shows `file` when there is no thumbnail).
use base64::{
    alphabet,
    engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig},
    Engine,
};
use serde::Serialize;
use serde_json::{json, Value};
use uuid::Uuid;

/// Why an inline entry stays inline; reported to the operator, never dropped.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Reason {
    /// Not a base64 data URL, or not a JPEG, PNG or WebP photo / PDF floor plan by its bytes.
    Unsupported,
    /// The base64 or the file itself is malformed.
    Unreadable,
    /// Over the upload limits (10 MB photos, 20 MB PDFs).
    TooLarge,
    /// Carries fields a stored entry cannot keep, such as a demo-photo label.
    OtherFields,
    /// Storing it would take the company over its storage cap.
    OverQuota,
    /// The record's media fields, rewritten, would fail the validation a member's save uses
    /// (for example more than 20 entries); the whole record is left as it is.
    Invalid,
}

pub enum Entry<'a> {
    /// Not inline (already stored, or not ours to judge): left exactly as it is.
    Keep,
    Inline(Inline<'a>),
    Left(Reason),
}

pub struct Inline<'a> {
    pub name: &'a str,
    pub encoded: &'a str,
    pub added: Option<&'a str>,
}

/// The fields an inline entry may carry for it to move without losing anything; `type`
/// is replaced by the real type read from the bytes.
const MOVABLE: [&str; 4] = ["name", "src", "type", "added"];
/// Longest base64 text worth decoding: a 20 MB PDF plus line breaks. Longer is too large.
const MAX_ENCODED: usize = 30 * 1024 * 1024;

pub fn classify(asset: &Value) -> Entry<'_> {
    let Some(map) = asset.as_object() else {
        return Entry::Keep;
    };
    let Some(src) = map.get("src") else {
        return Entry::Keep;
    };
    let (Some(src), Some(name)) = (src.as_str(), map.get("name").and_then(Value::as_str)) else {
        return Entry::Left(Reason::Unsupported);
    };
    if map.keys().any(|key| !MOVABLE.contains(&key.as_str())) {
        return Entry::Left(Reason::OtherFields);
    }
    // A stored entry's `added` is a short text (records validation); anything else stays.
    let added = match map.get("added") {
        None => None,
        Some(Value::String(text)) if text.chars().count() <= 40 => Some(text.as_str()),
        Some(_) => return Entry::Left(Reason::OtherFields),
    };
    let encoded = src
        .strip_prefix("data:")
        .and_then(|rest| rest.split_once(";base64,"))
        .map(|(_, encoded)| encoded);
    match encoded {
        Some(encoded) => Entry::Inline(Inline {
            name,
            encoded,
            added,
        }),
        None => Entry::Left(Reason::Unsupported),
    }
}

/// The file's bytes; line breaks and spaces are ignored and padding is optional.
pub fn decode(encoded: &str) -> Result<Vec<u8>, Reason> {
    if encoded.len() > MAX_ENCODED {
        return Err(Reason::TooLarge);
    }
    let compact: Vec<u8> = encoded
        .bytes()
        .filter(|byte| !byte.is_ascii_whitespace())
        .collect();
    let config =
        GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent);
    GeneralPurpose::new(&alphabet::STANDARD, config)
        .decode(compact)
        .map_err(|_| Reason::Unreadable)
}

/// The stored entry that replaces an inline one.
pub fn stored_entry(name: &str, file: Uuid, content_type: &str, added: Option<&str>) -> Value {
    let mut entry = json!({ "name": name, "file": file, "type": content_type });
    if let Some(added) = added {
        entry["added"] = json!(added);
    }
    entry
}

#[cfg(test)]
#[path = "inline_tests.rs"]
mod tests;
