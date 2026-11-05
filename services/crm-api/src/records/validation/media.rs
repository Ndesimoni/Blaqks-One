use crate::error::{ApiError, ApiResult};
use serde_json::Value;

/// Each entry is either inline (`name`, `src` data URL) or a stored file (packet F2).
/// Stored entries use a nonempty `name` of at most 200 characters and `file`, optionally
/// `thumb` (photos), `type` and `added`, with nothing else.
pub fn validate(payload: &Value) -> ApiResult<()> {
    for field in ["media_photos", "media_floorplans"] {
        let Some(media) = payload.get(field) else {
            continue;
        };
        let assets = media
            .as_array()
            .filter(|assets| assets.len() <= 20)
            .ok_or_else(|| ApiError::invalid("Media must be a list of at most 20 files."))?;
        let photo = field == "media_photos";
        for asset in assets {
            let name = asset.get("name").and_then(Value::as_str);
            let valid = match asset.get("src").and_then(Value::as_str) {
                Some(src) => name.is_some() && valid_source(src, photo),
                None => name.is_some_and(valid_stored_name) && stored(asset, photo),
            };
            if !valid {
                return Err(ApiError::invalid(
                    "Media must contain supported image or floor-plan assets.",
                ));
            }
        }
    }
    Ok(())
}

fn valid_stored_name(name: &str) -> bool {
    let hidden = |character: char| {
        character.is_control()
            || matches!(
                character,
                '\u{061c}'
                    | '\u{200b}'..='\u{200f}'
                    | '\u{202a}'..='\u{202e}'
                    | '\u{2060}'..='\u{2069}'
                    | '\u{feff}'
            )
    };
    !name.trim().is_empty() && name.chars().count() <= 200 && !name.chars().any(hidden)
}

fn stored(asset: &Value, photo: bool) -> bool {
    let Some(map) = asset.as_object() else {
        return false;
    };
    let id = |key: &str| {
        map.get(key)
            .and_then(Value::as_str)
            .is_some_and(|v| uuid::Uuid::parse_str(v).is_ok())
    };
    let text = |key: &str| {
        map.get(key)
            .is_none_or(|v| v.as_str().is_some_and(|v| v.chars().count() <= 40))
    };
    let known = map
        .keys()
        .all(|key| matches!(key.as_str(), "name" | "file" | "thumb" | "type" | "added"));
    known
        && id("file")
        && (!map.contains_key("thumb") || (photo && id("thumb")))
        && text("type")
        && text("added")
}

fn valid_source(src: &str, photo: bool) -> bool {
    let Some((mime, encoded)) = src.split_once(";base64,") else {
        return false;
    };
    let image = matches!(
        mime,
        "data:image/jpeg" | "data:image/png" | "data:image/webp"
    );
    let supported = image || (!photo && mime == "data:application/pdf");
    supported
        && !encoded.is_empty()
        && encoded.bytes().all(|byte| {
            byte.is_ascii_alphanumeric()
                || matches!(byte, b'+' | b'/' | b'=')
                || byte.is_ascii_whitespace()
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rejects_invalid_media_shapes_and_executable_sources() {
        for assets in [
            json!(null),
            json!({}),
            json!([null]),
            json!([{"name":"image", "src":"javascript:alert(1)"}]),
            json!([{"name":"image", "src":"data:image/svg+xml;base64,AAA="}]),
            json!([{"name":"plan", "src":"data:application/pdf;base64,AAA="}]),
        ] {
            assert!(validate(&json!({"media_photos":assets})).is_err());
        }
        assert!(validate(
            &json!({"media_floorplans":[{"name":"plan", "src":"data:application/pdf;base64,AAA="}]})
        )
        .is_ok());
        assert!(validate(
            &json!({"media_photos":[{"name":"photo", "src":"data:image/jpeg;base64,AAA="}]})
        )
        .is_ok());
    }

    #[test]
    fn stored_files_are_ids_with_known_fields_only() {
        let id = "11111111-1111-4111-8111-111111111111";
        let photo = |asset| validate(&json!({ "media_photos": [asset] }));
        assert!(photo(json!({"name":"front", "file":id, "thumb":id, "type":"image/jpeg"})).is_ok());
        assert!(photo(json!({"name":"front", "file":"not-an-id"})).is_err());
        assert!(photo(json!({"name":"front", "file":id, "url":"https://x.test"})).is_err());
        assert!(photo(json!({"file":id})).is_err());
        let plan = json!({ "media_floorplans": [{"name":"plan", "file":id, "thumb":id}] });
        assert!(validate(&plan).is_err(), "floor plans have no thumbnail");
        let many: Vec<_> = (0..21).map(|_| json!({"name":"p", "file":id})).collect();
        assert!(validate(&json!({ "media_photos": many })).is_err());
        assert!(photo(json!({"name":"n".repeat(200), "file":id})).is_ok());
        assert!(photo(json!({"name":"n".repeat(201), "file":id})).is_err());
        assert!(photo(json!({"name":"واجهة.jpg", "file":id})).is_ok());
        for name in [
            "",
            "  ",
            "bad\nname",
            "report\u{202e}fdp",
            "note\u{2066}pdf",
        ] {
            assert!(photo(json!({"name":name, "file":id})).is_err());
        }
        assert!(photo(json!({
            "name":"n".repeat(201), "src":"data:image/jpeg;base64,AAA="
        }))
        .is_ok());
    }
}
