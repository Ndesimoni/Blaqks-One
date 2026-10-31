//! Streaming one stored file to a caller the owning module has already checked (packet
//! F1). Photos display inline and PDFs download; the type is fixed, sniffing is off and
//! nothing is cached outside the browser's private memory.
use super::{owned, s3, store::Stored, upload::unconfigured};
use crate::{error::ApiResult, state::AppState};
use axum::{
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

const MAX_BYTES: usize = 21 * 1024 * 1024;

/// The file `id` of the owning module's item, or not-found.
pub async fn file(
    state: &AppState,
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    kind: &str,
    owner: Uuid,
    id: Uuid,
) -> ApiResult<Response> {
    let config = state.config.media.as_ref().ok_or_else(unconfigured)?;
    let Some(stored) = owned::find(tx, workspace, kind, owner, id).await? else {
        return Ok(StatusCode::NOT_FOUND.into_response());
    };
    let bytes = match s3::get(config, &stored.storage_key, MAX_BYTES).await {
        Ok(bytes) => bytes,
        Err(s3::StorageError::Missing) => return Ok(StatusCode::NOT_FOUND.into_response()),
        Err(s3::StorageError::Unavailable) => {
            return Ok(StatusCode::SERVICE_UNAVAILABLE.into_response())
        }
    };
    Ok(respond(&stored, bytes))
}

fn respond(stored: &Stored, bytes: Vec<u8>) -> Response {
    let inline = stored.content_type.starts_with("image/");
    // RFC 6266: an ASCII fallback plus the UTF-8 name.
    // The name always ends with the stored type's extension (F3 review M3).
    let name = super::naming::typed_name(&stored.file_name, &stored.content_type);
    let ascii: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || " .-_()".contains(c) {
                c
            } else {
                '_'
            }
        })
        .collect();
    let encoded: String = url::form_urlencoded::byte_serialize(name.as_bytes())
        .collect::<String>()
        .replace('+', "%20");
    let disposition = format!(
        "{}; filename=\"{ascii}\"; filename*=UTF-8''{encoded}",
        if inline { "inline" } else { "attachment" }
    );
    let header = |value: &str| {
        HeaderValue::from_str(value).unwrap_or_else(|_| HeaderValue::from_static("attachment"))
    };
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, header(&stored.content_type)),
            (header::CONTENT_DISPOSITION, header(&disposition)),
            (
                header::CACHE_CONTROL,
                HeaderValue::from_static("private, no-store"),
            ),
            (
                header::X_CONTENT_TYPE_OPTIONS,
                HeaderValue::from_static("nosniff"),
            ),
            (
                header::CONTENT_SECURITY_POLICY,
                HeaderValue::from_static("default-src 'none'; sandbox"),
            ),
        ],
        bytes,
    )
        .into_response()
}
