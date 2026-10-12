use crate::error::{ApiError, ApiResult};
use serde_json::Value;

pub fn validate(payload: &Value) -> ApiResult<()> {
    for field in ["media_photos", "media_floorplans"] {
        let Some(media) = payload.get(field) else {
            continue;
        };
        let assets = media
            .as_array()
            .ok_or_else(|| ApiError::invalid("Media must be a list."))?;
        for asset in assets {
            let name = asset.get("name").and_then(Value::as_str);
            let src = asset.get("src").and_then(Value::as_str);
            if name.is_none() || !src.is_some_and(|src| valid_source(src, field == "media_photos"))
            {
                return Err(ApiError::invalid(
                    "Media must contain supported image or floor-plan assets.",
                ));
            }
        }
    }
    Ok(())
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
}
