//! Reading another joined member's profile and photo (packet MK1b). Both routes run the same
//! visibility rule and the same read limits, and neither ever returns an email or a phone.
use super::{gate, limits, photo, visibility};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media,
    state::AppState,
};
use axum::{
    extract::{Path, State as AxumState},
    response::Response,
    Json,
};
use serde_json::{json, Value};

pub async fn read(
    AxumState(state): AxumState<AppState>,
    session: Session,
    Path((workspace, member)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let id = limits::missing_id(&member)?;
    limits::consume(&state, session.user.id, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::company_open_or_missing(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let Some(seen) = visibility::visible(&mut tx, id).await? else {
        return Err(ApiError::missing());
    };
    let row = seen.row;
    let licence = row.licence();
    let profile = json!({
        "memberId": row.member_id,
        "name": seen.name,
        "company": seen.company,
        "emirates": row.emirates,
        "communities": row.communities.0.iter()
            .map(|entry| entry.name.clone()).collect::<Vec<_>>(),
        "propertyTypes": row.property_types,
        "experienceYears": row.experience_years,
        "licence": licence,
        "joinedAt": row.joined_at,
        "hasPhoto": row.photo_id.is_some(),
        "declared": true,
    });
    tx.commit().await?;
    Ok(Json(json!({ "profile": profile })))
}

pub async fn serve_photo(
    AxumState(state): AxumState<AppState>,
    session: Session,
    Path((workspace, member)): Path<(String, String)>,
) -> ApiResult<Response> {
    gate::reader(&state, &session, &workspace).await?;
    let id = limits::missing_id(&member)?;
    limits::consume(&state, session.user.id, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::company_open_or_missing(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let Some(seen) = visibility::visible(&mut tx, id).await? else {
        return Err(ApiError::missing());
    };
    let Some(photo_id) = seen.row.photo_id else {
        return Err(ApiError::missing());
    };
    let response = media::serve::file(
        &state,
        &mut tx,
        &seen.row.workspace_id,
        photo::KIND,
        id,
        photo_id,
    )
    .await?;
    tx.commit().await?;
    Ok(response)
}
