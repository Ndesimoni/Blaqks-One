//! `POST /api/crm/workspaces/{workspace}/media`: one raw file with its display name in
//! `X-File-Name` (percent-encoded). The real type comes from the bytes, metadata is
//! removed, and the file is stored under a random key as a pending upload of the caller's.
use super::{
    s3,
    sniff::{clean, detect},
    store::{self, Item},
};
use crate::{
    auth::{protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

const TYPE: &str = "Upload a JPEG, PNG or WebP photo, or a PDF.";
const LARGE: &str = "The file is too large: photos up to 10 MB, PDFs up to 20 MB.";
/// Uploads per member per hour, and stored bytes per company.
const PER_HOUR: i64 = 60;
const COMPANY_BYTES: i64 = 5 * 1024 * 1024 * 1024;
/// Unsent uploads one member may hold, so nobody can fill the company's space (review M2).
const PENDING_BYTES: i64 = 200 * 1024 * 1024;

pub fn unconfigured() -> ApiError {
    ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        "File storage is not set up for this CRM yet.",
        "media_unconfigured",
    )
}

/// The display name: decoded, without paths or control characters, at most 200 characters.
pub fn display_name(header: Option<&str>) -> String {
    let raw = format!("n={}", header.unwrap_or_default());
    let decoded = url::form_urlencoded::parse(raw.as_bytes())
        .next()
        .map(|(_, value)| value.into_owned())
        .unwrap_or_default();
    let base = decoded.rsplit(['/', '\\']).next().unwrap_or_default();
    // Control and direction characters could disguise a type (`report\u{202e}fdp.exe`).
    let hidden = |c: char| {
        c.is_control()
            || matches!(c, '\u{200b}'..='\u{200f}' | '\u{202a}'..='\u{202e}' | '\u{2060}'..='\u{2069}' | '\u{feff}' | '\u{061c}')
    };
    let clean: String = base.chars().filter(|c| !hidden(*c)).take(200).collect();
    let clean = clean.trim();
    if clean.is_empty() {
        "file".into()
    } else {
        clean.to_owned()
    }
}

pub async fn upload(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Bytes,
) -> ApiResult<(StatusCode, Json<Value>)> {
    workspaces::ensure_access(&state, &session, &workspace).await?;
    if session.user.role == "super-admin" || session.user.workspace_id != workspace {
        return Err(ApiError::forbidden());
    }
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let config = state.config.media.clone().ok_or_else(unconfigured)?;
    let kind = detect(&body).ok_or(ApiError::invalid(TYPE))?;
    if body.len() > kind.max_bytes() {
        return Err(ApiError::invalid(LARGE));
    }
    let cleaned = clean(kind, &body).map_err(|_| ApiError::invalid(TYPE))?;
    let name = display_name(
        headers
            .get("x-file-name")
            .and_then(|value| value.to_str().ok()),
    );
    let name = super::naming::typed_name(&name, kind.content_type());
    let mut tx = state.pool.begin().await?;
    let user = workspaces::member(&mut tx, &workspace, session.user.id).await?;
    let (recent, used, pending) = store::usage(&mut tx, &workspace, user.id).await?;
    let size = cleaned.len() as i64;
    if recent >= PER_HOUR || used + size > COMPANY_BYTES || pending + size > PENDING_BYTES {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "The upload limit is reached. Try again later or remove old files.",
            "media_quota",
        ));
    }
    let item = Item {
        id: Uuid::new_v4(),
        name,
        content_type: kind.content_type().to_owned(),
        size: cleaned.len() as i32,
    };
    let key = Uuid::new_v4().simple().to_string();
    store::insert(&mut tx, &workspace, user.id, &key, &item, &cleaned).await?;
    tx.commit().await?;
    // The row exists first, so a failed store is swept, never left untracked in the bucket.
    if s3::put_creating(&config, &key, cleaned, kind.content_type())
        .await
        .is_err()
    {
        store::discard(&state.pool, item.id).await?;
        return Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "The file could not be stored. Try again.",
            "media_unavailable",
        ));
    }
    Ok((StatusCode::CREATED, Json(json!({ "media": item.view() }))))
}

#[cfg(test)]
mod tests {
    use super::display_name;

    #[test]
    fn display_names_are_plain_and_bounded() {
        assert_eq!(display_name(Some("Villa%20photo.jpg")), "Villa photo.jpg");
        assert_eq!(display_name(Some("..%2F..%2Fetc%2Fpasswd")), "passwd");
        assert_eq!(display_name(Some("%E2%80%8Bnote%0A.pdf")), "note.pdf");
        assert_eq!(
            display_name(Some("report%E2%80%AEfdp.exe")),
            "reportfdp.exe"
        );
        assert_eq!(display_name(None), "file");
        assert_eq!(display_name(Some(&"a".repeat(300))).len(), 200);
    }
}
