//! The profile photo (review amendment 7): an image the caller uploaded in the last day, at
//! most 2 MB and 2048 × 2048 pixels, attached to the member under `market_profile` with the
//! neutral name "profile-photo" (MK1 code review M2, M5). Replacing hides the old file in the
//! same transaction, and the photo is served only after the profile visibility check.
use super::{application, events, gate, profiles};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State as AxumState},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

pub const KIND: &str = "market_profile";
/// Two megabytes, and only the three image types a profile may show.
pub const MAX_BYTES: i32 = 2 * 1024 * 1024;
pub const MAX_SIDE: u32 = 2048;
const TYPES: [&str; 3] = ["image/jpeg", "image/png", "image/webp"];
pub const WRONG: &str = "Upload a JPEG, PNG or WebP photo of at most 2 MB and 2048 × 2048 pixels.";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Photo {
    pub media_id: Uuid,
}

pub async fn put(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Photo>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let Json(request) = body.map_err(|_| ApiError::invalid(WRONG))?;
    // The pixel size comes from storage, before any lock is taken.
    let upload = (request.media_id, MAX_BYTES);
    let size = media::dimensions::of_upload(&state, &workspace, session.user.id, upload).await?;
    let side = 1..=MAX_SIDE;
    if !size.is_some_and(|(width, height)| side.contains(&width) && side.contains(&height)) {
        return Err(ApiError::invalid(WRONG));
    }
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let existing = profiles::load(&mut tx, user.id)
        .await?
        .ok_or_else(|| ApiError::conflict(gate::JOIN_FIRST))?;
    let items = media::owned::attach(
        &mut tx,
        &workspace,
        user.id,
        &[request.media_id],
        KIND,
        user.id,
    )
    .await?;
    // Checked before this transaction commits, so a PDF or an oversized file leaves nothing
    // attached and the old photo untouched.
    let item = items.first().ok_or_else(|| ApiError::invalid(WRONG))?;
    if !TYPES.contains(&item.content_type.as_str()) || item.size > MAX_BYTES {
        return Err(ApiError::invalid(WRONG));
    }
    media::neutral::rename(&mut tx, (KIND, user.id), item.id, "profile-photo").await?;
    if let Some(old) = existing.photo_id {
        media::owned::remove_ids(&mut tx, KIND, user.id, &[old]).await?;
    }
    profiles::set_photo(&mut tx, user.id, Some(item.id)).await?;
    events::append(&mut tx, &workspace, user.id, user.id, "photo_changed").await?;
    tx.commit().await?;
    application::reply(&state, &workspace, user.id, StatusCode::OK).await
}

pub async fn remove(
    AxumState(state): AxumState<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    if profiles::load(&mut tx, user.id).await?.is_none() {
        return Err(ApiError::conflict(gate::JOIN_FIRST));
    }
    media::owned::remove(&mut tx, KIND, user.id).await?;
    profiles::set_photo(&mut tx, user.id, None).await?;
    events::append(&mut tx, &workspace, user.id, user.id, "photo_changed").await?;
    tx.commit().await?;
    application::reply(&state, &workspace, user.id, StatusCode::OK).await
}
