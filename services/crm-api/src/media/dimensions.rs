//! An image's width and height from its header (marketplace MK1 code review M5): a small
//! file can still decode to an enormous picture, so images shown to other companies are
//! checked before they are attached. PNG, JPEG and WebP only; anything unreadable is `None`.
use super::{s3, upload::unconfigured};
use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::http::StatusCode;
use uuid::Uuid;

fn be16(bytes: &[u8], at: usize) -> Option<u32> {
    Some(u32::from(u16::from_be_bytes([
        *bytes.get(at)?,
        *bytes.get(at + 1)?,
    ])))
}

fn le16(bytes: &[u8], at: usize) -> Option<u32> {
    Some(u32::from(u16::from_le_bytes([
        *bytes.get(at)?,
        *bytes.get(at + 1)?,
    ])))
}

fn le24(bytes: &[u8], at: usize) -> Option<u32> {
    let [a, b, c] = [*bytes.get(at)?, *bytes.get(at + 1)?, *bytes.get(at + 2)?];
    Some(u32::from(a) | u32::from(b) << 8 | u32::from(c) << 16)
}

fn png(bytes: &[u8]) -> Option<(u32, u32)> {
    let word = |at: usize| Some(u32::from_be_bytes(bytes.get(at..at + 4)?.try_into().ok()?));
    (bytes.get(12..16)? == b"IHDR").then_some(())?;
    Some((word(16)?, word(20)?))
}

fn jpeg(bytes: &[u8]) -> Option<(u32, u32)> {
    let mut at = 2;
    loop {
        while *bytes.get(at)? == 0xFF && *bytes.get(at + 1)? == 0xFF {
            at += 1;
        }
        (*bytes.get(at)? == 0xFF).then_some(())?;
        let marker = *bytes.get(at + 1)?;
        let frame = matches!(marker, 0xC0..=0xCF) && !matches!(marker, 0xC4 | 0xC8 | 0xCC);
        if frame {
            return Some((be16(bytes, at + 7)?, be16(bytes, at + 5)?));
        }
        if matches!(marker, 0xD0..=0xD9 | 0x01) {
            at += 2;
            continue;
        }
        at += 2 + usize::try_from(be16(bytes, at + 2)?).ok()?;
    }
}

fn webp(bytes: &[u8]) -> Option<(u32, u32)> {
    match bytes.get(12..16)? {
        b"VP8 " => Some((le16(bytes, 26)? & 0x3FFF, le16(bytes, 28)? & 0x3FFF)),
        b"VP8L" => {
            let bits = u32::from_le_bytes(bytes.get(21..25)?.try_into().ok()?);
            Some(((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1))
        }
        b"VP8X" => Some((le24(bytes, 24)? + 1, le24(bytes, 27)? + 1)),
        _ => None,
    }
}

/// The image's width and height, from the header of its stored type.
pub fn of(bytes: &[u8], content_type: &str) -> Option<(u32, u32)> {
    match content_type {
        "image/png" => png(bytes),
        "image/jpeg" => jpeg(bytes),
        "image/webp" => webp(bytes),
        _ => None,
    }
}

/// The size of a stored upload the caller made and has not attached yet, read from storage;
/// `None` when there is no such upload, it is larger than `max_bytes`, or unreadable.
pub async fn of_upload(
    state: &AppState,
    workspace: &str,
    uploader: Uuid,
    (id, max_bytes): (Uuid, i32),
) -> ApiResult<Option<(u32, u32)>> {
    let found: Option<(String, String)> = sqlx::query_as(
        "SELECT storage_key,content_type FROM media.crm_media_objects WHERE id=$1 \
         AND workspace_id=$2 AND uploaded_by=$3 AND origin='upload' AND owner_id IS NULL \
         AND deleted_at IS NULL AND NOT storage_pending AND byte_size<=$4",
    )
    .bind(id)
    .bind(workspace)
    .bind(uploader)
    .bind(max_bytes)
    .fetch_optional(&state.pool)
    .await?;
    let Some((key, content_type)) = found else {
        return Ok(None);
    };
    let config = state.config.media.as_ref().ok_or_else(unconfigured)?;
    let limit = usize::try_from(max_bytes).unwrap_or(0);
    let bytes = s3::get(config, &key, limit).await.map_err(|_| {
        ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "The photo could not be read. Try again.",
            "media_unavailable",
        )
    })?;
    Ok(of(&bytes, &content_type))
}

#[cfg(test)]
#[path = "dimensions_tests.rs"]
mod tests;
